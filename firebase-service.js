// Service Firebase pour gérer la base de données
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    addDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { DB_COLLECTIONS, CHALLENGE_TYPES } from './firebase-config.js';

class FirebaseService {
    constructor(db) {
        this.db = db;
        this.currentGameSession = null;
    }

    // ===== GESTION DES SESSIONS DE JEU =====
    
    async createGameSession() {
        const sessionId = `session_${Date.now()}`;
        const sessionData = {
            id: sessionId,
            createdAt: serverTimestamp(),
            status: 'active',
            teamsCount: 0
        };
        
        await setDoc(doc(this.db, DB_COLLECTIONS.GAME_SESSIONS, sessionId), sessionData);
        this.currentGameSession = sessionId;
        return sessionId;
    }

    // Générer un ID unique pour une équipe
    generateUniqueTeamId() {
        return `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async createTeam(teamData) {
        const teamId = this.generateUniqueTeamId();
        const team = {
            id: teamId,
            name: teamData.name,
            color: teamData.color,
            route: teamData.route,
            currentCheckpoint: 0,
            foundCheckpoints: [],
            unlockedCheckpoints: [0], // Lobby toujours débloqué
            createdAt: serverTimestamp(),
            sessionId: this.currentGameSession,
            status: 'active'
        };
        
        await setDoc(doc(this.db, DB_COLLECTIONS.TEAMS, teamId), team);
        return teamId;
    }

    async getTeam(teamId) {
        const teamDoc = await getDoc(doc(this.db, DB_COLLECTIONS.TEAMS, teamId));
        return teamDoc.exists() ? teamDoc.data() : null;
    }

    async updateTeamProgress(teamId, updates) {
        const teamRef = doc(this.db, DB_COLLECTIONS.TEAMS, teamId);
        await updateDoc(teamRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    }

    // Écouter les changements d'une équipe en temps réel
    onTeamChange(teamId, callback) {
        const teamRef = doc(this.db, DB_COLLECTIONS.TEAMS, teamId);
        return onSnapshot(teamRef, (doc) => {
            if (doc.exists()) {
                callback(doc.data());
            }
        });
    }

    // ===== GESTION DES CHECKPOINTS =====
    
    async initializeCheckpoints(checkpointsData) {
        const batch = [];
        
        for (const checkpoint of checkpointsData) {
            const checkpointRef = doc(this.db, DB_COLLECTIONS.CHECKPOINTS, checkpoint.id.toString());
            batch.push(setDoc(checkpointRef, {
                ...checkpoint,
                createdAt: serverTimestamp()
            }));
        }
        
        await Promise.all(batch);
    }

    async getCheckpoints() {
        const checkpointsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.CHECKPOINTS));
        return checkpointsSnapshot.docs.map(doc => doc.data());
    }

    // ===== GESTION DES VALIDATIONS =====
    
    async createValidationRequest(teamId, checkpointId, type, data) {
        const validationId = `validation_${Date.now()}_${teamId}`;
        const validation = {
            id: validationId,
            teamId,
            checkpointId,
            type, // 'photo', 'object', etc.
            data, // URL photo, description, etc.
            status: 'pending',
            createdAt: serverTimestamp(),
            sessionId: this.currentGameSession
        };
        
        await setDoc(doc(this.db, DB_COLLECTIONS.VALIDATIONS, validationId), validation);
        return validationId;
    }

    async updateValidation(validationId, status, adminNotes = '') {
        const validationRef = doc(this.db, DB_COLLECTIONS.VALIDATIONS, validationId);
        await updateDoc(validationRef, {
            status, // 'approved', 'rejected'
            adminNotes,
            validatedAt: serverTimestamp()
        });
    }

    // Écouter les nouvelles demandes de validation (pour l'admin)
    onValidationRequests(callback) {
        const q = query(
            collection(this.db, DB_COLLECTIONS.VALIDATIONS),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        return onSnapshot(q, (snapshot) => {
            const validations = snapshot.docs.map(doc => doc.data());
            callback(validations);
        });
    }

    // ===== ADMIN - VUE D'ENSEMBLE =====
    
    // Écouter toutes les équipes (pour l'admin)
    onAllTeamsChange(callback) {
        // Pour l'admin, récupérer toutes les équipes sans filtre de session
        const q = query(
            collection(this.db, DB_COLLECTIONS.TEAMS),
            orderBy('createdAt', 'desc')
        );
        
        return onSnapshot(q, (snapshot) => {
            const teams = snapshot.docs.map(doc => doc.data());
            callback(teams);
        });
    }

    // Débloquer manuellement un checkpoint pour une équipe (admin)
    async unlockCheckpointForTeam(teamId, checkpointId) {
        const team = await this.getTeam(teamId);
        if (team && !team.unlockedCheckpoints.includes(checkpointId)) {
            const newUnlocked = [...team.unlockedCheckpoints, checkpointId];
            await this.updateTeamProgress(teamId, {
                unlockedCheckpoints: newUnlocked
            });
        }
    }

    // Reset une équipe (admin)
    async resetTeam(teamId) {
        console.log(`🔄 Firebase: Reset équipe ${teamId}`);
        try {
            await this.updateTeamProgress(teamId, {
                currentCheckpoint: 0,
                foundCheckpoints: [],
                unlockedCheckpoints: [0],
                status: 'active'
            });
            console.log(`✅ Firebase: Équipe ${teamId} resetée avec succès`);
        } catch (error) {
            console.error(`❌ Firebase: Erreur reset équipe ${teamId}:`, error);
            throw error;
        }
    }

    // Obtenir toutes les équipes (pour l'admin)
    async getAllTeams() {
        const teamsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.TEAMS));
        return teamsSnapshot.docs.map(doc => doc.data());
    }

    // Supprimer une équipe (admin)
    async deleteTeam(teamId) {
        await deleteDoc(doc(this.db, DB_COLLECTIONS.TEAMS, teamId));
    }

    // ===== GESTION DES UTILISATEURS =====
    
    async createUser(userData) {
        const userId = userData.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const user = {
            userId: userId,
            name: userData.name,
            password: userData.password, // En production, il faudrait hasher le mot de passe
            teamId: userData.teamId,
            teamName: userData.teamName,
            foundCheckpoints: [],
            unlockedCheckpoints: [0], // Lobby toujours débloqué
            currentCheckpoint: 0,
            createdAt: serverTimestamp(),
            sessionId: this.currentGameSession,
            status: 'active'
        };
        
        await setDoc(doc(this.db, DB_COLLECTIONS.USERS, userId), user);
        return userId;
    }

    async getUser(userId) {
        const userDoc = await getDoc(doc(this.db, DB_COLLECTIONS.USERS, userId));
        return userDoc.exists() ? userDoc.data() : null;
    }

    async authenticateUser(userId, password) {
        try {
            const user = await this.getUser(userId);
            if (user && user.password === password) {
                return user;
            }
            return null;
        } catch (error) {
            console.error('Erreur authentification:', error);
            return null;
        }
    }

    async updateUserProgress(userId, updates) {
        const userRef = doc(this.db, DB_COLLECTIONS.USERS, userId);
        await updateDoc(userRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
        
        // Mettre à jour aussi l'équipe si l'utilisateur a une équipe
        const user = await this.getUser(userId);
        if (user && user.teamId && updates.foundCheckpoints) {
            await this.updateTeamProgress(user.teamId, {
                foundCheckpoints: updates.foundCheckpoints,
                unlockedCheckpoints: updates.unlockedCheckpoints || []
            });
        }
    }

    // Écouter les changements d'un utilisateur
    onUserChange(userId, callback) {
        const userRef = doc(this.db, DB_COLLECTIONS.USERS, userId);
        return onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                callback(doc.data());
            }
        });
    }

    // Obtenir tous les utilisateurs (pour l'admin)
    async getAllUsers() {
        const usersSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.USERS));
        return usersSnapshot.docs.map(doc => doc.data());
    }

    // Écouter tous les utilisateurs (pour l'admin)
    onAllUsersChange(callback) {
        const q = query(
            collection(this.db, DB_COLLECTIONS.USERS),
            orderBy('createdAt', 'asc')
        );
        
        return onSnapshot(q, (snapshot) => {
            const users = snapshot.docs.map(doc => doc.data());
            callback(users);
        });
    }

    // Supprimer un utilisateur (admin)
    async deleteUser(userId) {
        await deleteDoc(doc(this.db, DB_COLLECTIONS.USERS, userId));
    }

    // Reset un utilisateur (admin)
    async resetUser(userId) {
        console.log(`🔄 Firebase: Reset utilisateur ${userId}`);
        try {
            await this.updateUserProgress(userId, {
                foundCheckpoints: [],
                unlockedCheckpoints: [0],
                currentCheckpoint: 0,
                status: 'active'
            });
            console.log(`✅ Firebase: Utilisateur ${userId} reseté avec succès`);
        } catch (error) {
            console.error(`❌ Firebase: Erreur reset utilisateur ${userId}:`, error);
            throw error;
        }
    }

    // ===== GESTION DES CHECKPOINTS =====
    async createCheckpoint(checkpointData) {
        try {
            const docRef = await addDoc(collection(this.db, DB_COLLECTIONS.CHECKPOINTS), {
                ...checkpointData,
                id: Date.now(), // ID unique basé sur timestamp
                createdAt: new Date()
            });
            console.log('✅ Checkpoint créé:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Erreur création checkpoint:', error);
            throw error;
        }
    }

    async getAllCheckpoints() {
        try {
            const querySnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.CHECKPOINTS));
            return querySnapshot.docs.map(doc => ({
                firebaseId: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Erreur récupération checkpoints:', error);
            throw error;
        }
    }

    async deleteCheckpoint(checkpointId) {
        try {
            const q = query(
                collection(this.db, DB_COLLECTIONS.CHECKPOINTS),
                where('id', '==', parseInt(checkpointId))
            );
            const querySnapshot = await getDocs(q);
            
            for (const doc of querySnapshot.docs) {
                await deleteDoc(doc.ref);
            }
            console.log('✅ Checkpoint supprimé:', checkpointId);
        } catch (error) {
            console.error('❌ Erreur suppression checkpoint:', error);
            throw error;
        }
    }

    // ===== GESTION DES PARCOURS =====
    async createRoute(routeData) {
        try {
            const docRef = await addDoc(collection(this.db, 'routes'), {
                ...routeData,
                id: Date.now(),
                createdAt: new Date()
            });
            console.log('✅ Parcours créé:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Erreur création parcours:', error);
            throw error;
        }
    }

    async getAllRoutes() {
        try {
            const querySnapshot = await getDocs(collection(this.db, 'routes'));
            return querySnapshot.docs.map(doc => ({
                firebaseId: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('❌ Erreur récupération parcours:', error);
            throw error;
        }
    }

    async deleteRoute(routeId) {
        try {
            const q = query(
                collection(this.db, 'routes'),
                where('id', '==', parseInt(routeId))
            );
            const querySnapshot = await getDocs(q);
            
            for (const doc of querySnapshot.docs) {
                await deleteDoc(doc.ref);
            }
            console.log('✅ Parcours supprimé:', routeId);
        } catch (error) {
            console.error('❌ Erreur suppression parcours:', error);
            throw error;
        }
    }
}

// Exporter la classe
export default FirebaseService;
