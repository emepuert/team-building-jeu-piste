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
            password: teamData.password, // Mot de passe pour connexion équipe
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

    async updateTeam(teamId, updateData) {
        try {
            const teamRef = doc(this.db, DB_COLLECTIONS.TEAMS, teamId);
            await updateDoc(teamRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
            console.log(`✅ Équipe ${teamId} mise à jour`);
            return teamId;
        } catch (error) {
            console.error('❌ Erreur mise à jour équipe:', error);
            throw error;
        }
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

    // Écouter les validations résolues pour une équipe (pour notifications user)
    onTeamValidationsResolved(teamId, callback) {
        const q = query(
            collection(this.db, DB_COLLECTIONS.VALIDATIONS),
            where('teamId', '==', teamId),
            where('status', 'in', ['approved', 'rejected']),
            orderBy('validatedAt', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const resolvedValidations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`🔔 Firebase: ${resolvedValidations.length} validations résolues pour équipe ${teamId}:`, resolvedValidations.map(v => ({ id: v.id, status: v.status, adminNotes: v.adminNotes })));
            callback(resolvedValidations);
        });
    }

    // ===== SYSTÈME D'AIDE =====
    
    // Créer une demande d'aide
    async createHelpRequest(teamId, checkpointId, type, message = '') {
        const helpData = {
            id: `help_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            teamId,
            checkpointId,
            type, // 'location' (demande localisation) ou 'riddle' (résoudre énigme)
            message, // Message optionnel de l'équipe
            status: 'pending',
            createdAt: serverTimestamp(),
            resolvedAt: null,
            adminNotes: ''
        };
        
        await setDoc(doc(this.db, DB_COLLECTIONS.HELP_REQUESTS, helpData.id), helpData);
        return helpData.id;
    }

    // Résoudre une demande d'aide (pour l'admin)
    async resolveHelpRequest(helpId, action, adminNotes = '') {
        const helpRef = doc(this.db, DB_COLLECTIONS.HELP_REQUESTS, helpId);
        const helpDoc = await getDoc(helpRef);
        
        if (!helpDoc.exists()) {
            throw new Error('Demande d\'aide non trouvée');
        }
        
        const helpData = helpDoc.data();
        
        // Marquer la demande comme résolue
        await updateDoc(helpRef, {
            status: 'resolved',
            action, // 'granted' (accordée) ou 'denied' (refusée)
            adminNotes,
            resolvedAt: serverTimestamp()
        });
        
        // Si accordée, effectuer l'action correspondante
        if (action === 'granted') {
            if (helpData.type === 'location') {
                // Débloquer le checkpoint (le rendre accessible)
                await this.unlockCheckpointForTeam(helpData.teamId, helpData.checkpointId);
            } else if (helpData.type === 'riddle') {
                // Marquer l'énigme comme résolue (ajouter aux trouvés)
                const team = await this.getTeam(helpData.teamId);
                if (team) {
                    const foundCheckpoints = team.foundCheckpoints || [];
                    if (!foundCheckpoints.includes(helpData.checkpointId)) {
                        foundCheckpoints.push(helpData.checkpointId);
                        
                        // Débloquer aussi le prochain checkpoint selon la route
                        const teamRoute = team.route || [];
                        const currentIndex = teamRoute.indexOf(helpData.checkpointId);
                        const nextCheckpointId = currentIndex >= 0 && currentIndex < teamRoute.length - 1 
                            ? teamRoute[currentIndex + 1] 
                            : null;
                        
                        const unlockedCheckpoints = team.unlockedCheckpoints || [];
                        if (nextCheckpointId && !unlockedCheckpoints.includes(nextCheckpointId)) {
                            unlockedCheckpoints.push(nextCheckpointId);
                        }
                        
                        await this.updateTeamProgress(helpData.teamId, {
                            foundCheckpoints,
                            unlockedCheckpoints
                        });
                    }
                }
            } else if (helpData.type === 'photo') {
                // Forcer la validation de la photo (même logique que riddle)
                const team = await this.getTeam(helpData.teamId);
                if (team) {
                    const foundCheckpoints = team.foundCheckpoints || [];
                    if (!foundCheckpoints.includes(helpData.checkpointId)) {
                        foundCheckpoints.push(helpData.checkpointId);
                        
                        // Débloquer aussi le prochain checkpoint selon la route
                        const teamRoute = team.route || [];
                        const currentIndex = teamRoute.indexOf(helpData.checkpointId);
                        const nextCheckpointId = currentIndex >= 0 && currentIndex < teamRoute.length - 1 
                            ? teamRoute[currentIndex + 1] 
                            : null;
                        
                        const unlockedCheckpoints = team.unlockedCheckpoints || [];
                        if (nextCheckpointId && !unlockedCheckpoints.includes(nextCheckpointId)) {
                            unlockedCheckpoints.push(nextCheckpointId);
                        }
                        
                        await this.updateTeamProgress(helpData.teamId, {
                            foundCheckpoints,
                            unlockedCheckpoints
                        });
                        
                        console.log(`📸 Validation forcée photo pour équipe ${team.name}`);
                    }
                }
            }
        }
        
        return helpData;
    }

    // Écouter les nouvelles demandes d'aide (pour l'admin)
    onHelpRequests(callback) {
        const q = query(
            collection(this.db, DB_COLLECTIONS.HELP_REQUESTS),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        return onSnapshot(q, (snapshot) => {
            const helpRequests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(helpRequests);
        });
    }

    // Obtenir les demandes d'aide d'une équipe
    async getTeamHelpRequests(teamId) {
        const q = query(
            collection(this.db, DB_COLLECTIONS.HELP_REQUESTS),
            where('teamId', '==', teamId),
            where('status', '==', 'pending')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // Écouter les demandes d'aide résolues pour une équipe (pour notifications user)
    onTeamHelpRequestsResolved(teamId, callback) {
        const q = query(
            collection(this.db, DB_COLLECTIONS.HELP_REQUESTS),
            where('teamId', '==', teamId),
            where('status', '==', 'resolved'),
            orderBy('resolvedAt', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const resolvedRequests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(resolvedRequests);
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
            // 1. Reset les données de l'équipe
            await this.updateTeamProgress(teamId, {
                currentCheckpoint: 0,
                foundCheckpoints: [],
                unlockedCheckpoints: [0],
                status: 'active'
            });
            
            // 2. Supprimer toutes les demandes d'aide de cette équipe
            const helpRequestsQuery = query(
                collection(this.db, DB_COLLECTIONS.HELP_REQUESTS),
                where('teamId', '==', teamId)
            );
            const helpRequestsSnapshot = await getDocs(helpRequestsQuery);
            
            let deletedHelpRequests = 0;
            for (const doc of helpRequestsSnapshot.docs) {
                await deleteDoc(doc.ref);
                deletedHelpRequests++;
            }
            
            // 3. Supprimer toutes les validations de cette équipe
            const validationsQuery = query(
                collection(this.db, DB_COLLECTIONS.VALIDATIONS),
                where('teamId', '==', teamId)
            );
            const validationsSnapshot = await getDocs(validationsQuery);
            
            let deletedValidations = 0;
            for (const doc of validationsSnapshot.docs) {
                await deleteDoc(doc.ref);
                deletedValidations++;
            }
            
            console.log(`✅ Firebase: Équipe ${teamId} resetée avec succès`);
            console.log(`🧹 Nettoyé: ${deletedHelpRequests} demandes d'aide, ${deletedValidations} validations`);
            
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
        try {
            console.log(`🗑️ Suppression en cascade de l'équipe ${teamId}`);
            
            // 1. Trouver l'équipe à supprimer
            const team = await this.getTeam(teamId);
            if (!team) {
                console.log(`⚠️ Équipe ${teamId} non trouvée`);
                return { team: teamId, affectedUsers: 0 };
            }
            
            // 2. Trouver tous les utilisateurs de cette équipe
            const allUsers = await this.getAllUsers();
            const affectedUsers = allUsers.filter(user => user.teamId === teamId);
            
            console.log(`👤 ${affectedUsers.length} utilisateurs affectés:`, affectedUsers.map(u => u.name));
            
            // 3. Supprimer tous les utilisateurs de l'équipe
            for (const user of affectedUsers) {
                await deleteDoc(doc(this.db, DB_COLLECTIONS.USERS, user.userId));
                console.log(`🗑️ Utilisateur "${user.name}" supprimé`);
            }
            
            // 4. Supprimer l'équipe
            await deleteDoc(doc(this.db, DB_COLLECTIONS.TEAMS, teamId));
            
            console.log(`✅ Équipe "${team.name}" et ses ${affectedUsers.length} utilisateurs supprimés`);
            return {
                team: teamId,
                teamName: team.name,
                affectedUsers: affectedUsers.length
            };
            
        } catch (error) {
            console.error('❌ Erreur suppression équipe en cascade:', error);
            throw error;
        }
    }

    // ===== NETTOYAGE FIREBASE (ADMIN) =====
    
    async fixTeamDataConsistency() {
        try {
            console.log('🔧 Correction de la cohérence des données équipes...');
            const allTeams = await this.getAllTeams();
            
            let fixedCount = 0;
            for (const team of allTeams) {
                let needsUpdate = false;
                const updates = {};
                
                // NOUVELLE RÈGLE : foundCheckpoints DOIVENT TOUJOURS être dans unlockedCheckpoints
                const foundCheckpoints = team.foundCheckpoints || [];
                let unlockedCheckpoints = team.unlockedCheckpoints || [0];
                
                console.log(`🔧 Équipe ${team.name}: analyse cohérence`, {
                    found: foundCheckpoints,
                    unlocked: unlockedCheckpoints
                });
                
                // S'assurer que TOUS les checkpoints trouvés sont aussi débloqués
                const missingFromUnlocked = foundCheckpoints.filter(id => !unlockedCheckpoints.includes(id));
                
                if (missingFromUnlocked.length > 0) {
                    const correctedUnlocked = [...new Set([...unlockedCheckpoints, ...foundCheckpoints, 0])]; // Merge + dédoublonner + lobby
                    updates.unlockedCheckpoints = correctedUnlocked;
                    needsUpdate = true;
                    console.log(`🔧 Équipe ${team.name}: ajout checkpoints trouvés manquants`, {
                        avant: unlockedCheckpoints,
                        après: correctedUnlocked,
                        ajoutés: missingFromUnlocked
                    });
                }
                
                // S'assurer que le lobby est toujours débloqué
                const finalUnlocked = updates.unlockedCheckpoints || unlockedCheckpoints;
                if (!finalUnlocked.includes(0)) {
                    updates.unlockedCheckpoints = [0, ...finalUnlocked];
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    await this.updateTeamProgress(team.id, updates);
                    fixedCount++;
                    console.log(`✅ Équipe ${team.name} corrigée`);
                }
            }
            
            console.log(`✅ ${fixedCount} équipes corrigées`);
            return fixedCount;
            
        } catch (error) {
            console.error('❌ Erreur correction cohérence:', error);
            throw error;
        }
    }
    
    async cleanupAllUsers() {
        try {
            console.log('🧹 Nettoyage de tous les utilisateurs Firebase...');
            const usersSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.USERS));
            
            let deletedCount = 0;
            for (const userDoc of usersSnapshot.docs) {
                await deleteDoc(userDoc.ref);
                deletedCount++;
                console.log(`🗑️ Utilisateur supprimé: ${userDoc.id}`);
            }
            
            console.log(`✅ ${deletedCount} utilisateurs supprimés de Firebase`);
            return deletedCount;
        } catch (error) {
            console.error('❌ Erreur nettoyage utilisateurs:', error);
            throw error;
        }
    }
    
    async cleanupAllData() {
        try {
            console.log('🧹 Nettoyage complet de Firebase...');
            
            // Supprimer tous les utilisateurs
            const usersCount = await this.cleanupAllUsers();
            
            // Supprimer toutes les équipes
            const teamsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.TEAMS));
            let teamsCount = 0;
            for (const teamDoc of teamsSnapshot.docs) {
                await deleteDoc(teamDoc.ref);
                teamsCount++;
                console.log(`🗑️ Équipe supprimée: ${teamDoc.id}`);
            }
            
            // Supprimer tous les checkpoints
            const checkpointsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.CHECKPOINTS));
            let checkpointsCount = 0;
            for (const checkpointDoc of checkpointsSnapshot.docs) {
                await deleteDoc(checkpointDoc.ref);
                checkpointsCount++;
                console.log(`🗑️ Checkpoint supprimé: ${checkpointDoc.id}`);
            }
            
            // Supprimer toutes les demandes d'aide
            const helpRequestsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.HELP_REQUESTS));
            let helpRequestsCount = 0;
            for (const helpDoc of helpRequestsSnapshot.docs) {
                await deleteDoc(helpDoc.ref);
                helpRequestsCount++;
                console.log(`🗑️ Demande d'aide supprimée: ${helpDoc.id}`);
            }
            
            // Supprimer toutes les validations
            const validationsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.VALIDATIONS));
            let validationsCount = 0;
            for (const validationDoc of validationsSnapshot.docs) {
                await deleteDoc(validationDoc.ref);
                validationsCount++;
                console.log(`🗑️ Validation supprimée: ${validationDoc.id}`);
            }
            
            // Supprimer toutes les routes
            const routesSnapshot = await getDocs(collection(this.db, 'routes'));
            let routesCount = 0;
            for (const routeDoc of routesSnapshot.docs) {
                await deleteDoc(routeDoc.ref);
                routesCount++;
                console.log(`🗑️ Route supprimée: ${routeDoc.id}`);
            }
            
            console.log(`✅ Nettoyage terminé: ${usersCount} users, ${teamsCount} teams, ${helpRequestsCount} help requests, ${validationsCount} validations, ${checkpointsCount} checkpoints, ${routesCount} routes`);
            return {
                users: usersCount,
                teams: teamsCount,
                helpRequests: helpRequestsCount,
                validations: validationsCount,
                checkpoints: checkpointsCount,
                routes: routesCount
            };
            
        } catch (error) {
            console.error('❌ Erreur nettoyage complet:', error);
            throw error;
        }
    }

    // Nettoyer seulement les demandes d'aide et validations (pour les tests)
    async cleanupHelpAndValidations() {
        console.log('🧹 Nettoyage des demandes d\'aide et validations...');
        
        try {
            let helpRequestsCount = 0;
            let validationsCount = 0;
            
            // Supprimer toutes les demandes d'aide
            const helpRequestsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.HELP_REQUESTS));
            for (const helpDoc of helpRequestsSnapshot.docs) {
                await deleteDoc(helpDoc.ref);
                helpRequestsCount++;
                console.log(`🗑️ Demande d'aide supprimée: ${helpDoc.id}`);
            }
            
            // Supprimer toutes les validations
            const validationsSnapshot = await getDocs(collection(this.db, DB_COLLECTIONS.VALIDATIONS));
            for (const validationDoc of validationsSnapshot.docs) {
                await deleteDoc(validationDoc.ref);
                validationsCount++;
                console.log(`🗑️ Validation supprimée: ${validationDoc.id}`);
            }
            
            console.log(`✅ Nettoyage terminé: ${helpRequestsCount} demandes d'aide, ${validationsCount} validations`);
            return {
                helpRequests: helpRequestsCount,
                validations: validationsCount
            };
            
        } catch (error) {
            console.error('❌ Erreur nettoyage demandes/validations:', error);
            throw error;
        }
    }

    // ===== GESTION DES ÉQUIPES - AUTHENTIFICATION =====
    
    async authenticateTeam(teamName, password) {
        try {
            const q = query(
                collection(this.db, DB_COLLECTIONS.TEAMS),
                where('name', '==', teamName),
                where('password', '==', password),
                where('sessionId', '==', this.currentGameSession)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const teamDoc = querySnapshot.docs[0];
                return { id: teamDoc.id, ...teamDoc.data() };
            }
            
            return null;
        } catch (error) {
            console.error('Erreur authentification équipe:', error);
            return null;
        }
    }

    // ===== GESTION DES UTILISATEURS (DEPRECATED - 1 équipe = 1 joueur) =====
    
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

    async updateCheckpoint(checkpointId, checkpointData) {
        try {
            // Trouver le document Firebase par l'ID du checkpoint
            const querySnapshot = await getDocs(
                query(collection(this.db, DB_COLLECTIONS.CHECKPOINTS), 
                      where('id', '==', parseInt(checkpointId)))
            );
            
            if (querySnapshot.empty) {
                throw new Error(`Checkpoint avec ID ${checkpointId} non trouvé`);
            }
            
            const docRef = querySnapshot.docs[0].ref;
            await updateDoc(docRef, {
                ...checkpointData,
                updatedAt: new Date()
            });
            
            console.log('✅ Checkpoint mis à jour:', checkpointId);
            return true;
        } catch (error) {
            console.error('❌ Erreur mise à jour checkpoint:', error);
            throw error;
        }
    }

    async deleteCheckpoint(checkpointId) {
        try {
            const checkpointIdInt = parseInt(checkpointId);
            console.log(`🗑️ Suppression en cascade du checkpoint ${checkpointId}`);
            
            // 1. Trouver toutes les routes qui utilisent ce checkpoint
            const allRoutes = await this.getAllRoutes();
            const affectedRoutes = allRoutes.filter(route => 
                route.route.includes(checkpointIdInt)
            );
            
            console.log(`📍 ${affectedRoutes.length} routes affectées:`, affectedRoutes.map(r => r.name));
            
            // 2. Trouver toutes les équipes qui utilisent ces routes
            const allTeams = await this.getAllTeams();
            const affectedTeams = allTeams.filter(team => 
                team.route && team.route.includes(checkpointIdInt)
            );
            
            console.log(`👥 ${affectedTeams.length} équipes affectées:`, affectedTeams.map(t => t.name));
            
            // 3. Trouver tous les utilisateurs de ces équipes
            const allUsers = await this.getAllUsers();
            const affectedUsers = allUsers.filter(user => 
                affectedTeams.some(team => team.id === user.teamId)
            );
            
            console.log(`👤 ${affectedUsers.length} utilisateurs affectés:`, affectedUsers.map(u => u.name));
            
            // 4. Nettoyer les progressions des utilisateurs
            for (const user of affectedUsers) {
                const cleanFoundCheckpoints = user.foundCheckpoints?.filter(id => id !== checkpointIdInt) || [];
                const cleanUnlockedCheckpoints = user.unlockedCheckpoints?.filter(id => id !== checkpointIdInt) || [0];
                
                await this.updateUserProgress(user.userId, {
                    foundCheckpoints: cleanFoundCheckpoints,
                    unlockedCheckpoints: cleanUnlockedCheckpoints
                });
                console.log(`🧹 Progression nettoyée pour ${user.name}`);
            }
            
            // 5. Nettoyer les routes des équipes
            for (const team of affectedTeams) {
                const cleanRoute = team.route?.filter(id => id !== checkpointIdInt) || [];
                const cleanFoundCheckpoints = team.foundCheckpoints?.filter(id => id !== checkpointIdInt) || [];
                const cleanUnlockedCheckpoints = team.unlockedCheckpoints?.filter(id => id !== checkpointIdInt) || [0];
                
                await this.updateTeamProgress(team.id, {
                    route: cleanRoute,
                    foundCheckpoints: cleanFoundCheckpoints,
                    unlockedCheckpoints: cleanUnlockedCheckpoints
                });
                console.log(`🧹 Route nettoyée pour l'équipe ${team.name}`);
            }
            
            // 6. Nettoyer les routes dans la collection routes
            for (const route of affectedRoutes) {
                const cleanRouteArray = route.route.filter(id => id !== checkpointIdInt);
                
                if (cleanRouteArray.length === 0) {
                    // Si la route devient vide, la supprimer
                    await this.deleteRoute(route.id);
                    console.log(`🗑️ Route "${route.name}" supprimée (devenue vide)`);
                } else {
                    // Sinon, mettre à jour la route
                    const q = query(
                        collection(this.db, 'routes'),
                        where('id', '==', route.id)
                    );
                    const querySnapshot = await getDocs(q);
                    
                    for (const doc of querySnapshot.docs) {
                        await updateDoc(doc.ref, {
                            route: cleanRouteArray,
                            updatedAt: serverTimestamp()
                        });
                    }
                    console.log(`🧹 Route "${route.name}" mise à jour`);
                }
            }
            
            // 7. Enfin, supprimer le checkpoint
            const q = query(
                collection(this.db, DB_COLLECTIONS.CHECKPOINTS),
                where('id', '==', checkpointIdInt)
            );
            const querySnapshot = await getDocs(q);
            
            for (const doc of querySnapshot.docs) {
                await deleteDoc(doc.ref);
            }
            
            console.log(`✅ Checkpoint ${checkpointId} et toutes ses dépendances supprimés`);
            return {
                checkpoint: checkpointId,
                affectedRoutes: affectedRoutes.length,
                affectedTeams: affectedTeams.length,
                affectedUsers: affectedUsers.length
            };
            
        } catch (error) {
            console.error('❌ Erreur suppression checkpoint en cascade:', error);
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

    async updateRoute(routeId, updateData) {
        try {
            const q = query(
                collection(this.db, 'routes'),
                where('id', '==', parseInt(routeId))
            );
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                throw new Error('Parcours non trouvé');
            }
            
            for (const docSnapshot of querySnapshot.docs) {
                await updateDoc(docSnapshot.ref, updateData);
            }
            
            console.log(`✅ Parcours ${routeId} mis à jour`);
            return routeId;
        } catch (error) {
            console.error('❌ Erreur mise à jour parcours:', error);
            throw error;
        }
    }

    async deleteRoute(routeId) {
        try {
            const routeIdInt = parseInt(routeId);
            console.log(`🗑️ Suppression en cascade de la route ${routeId}`);
            
            // 1. Trouver la route à supprimer
            const allRoutes = await this.getAllRoutes();
            const routeToDelete = allRoutes.find(route => route.id === routeIdInt);
            
            if (!routeToDelete) {
                console.log(`⚠️ Route ${routeId} non trouvée`);
                return { route: routeId, affectedTeams: 0, affectedUsers: 0 };
            }
            
            // 2. Trouver toutes les équipes qui utilisent cette route
            const allTeams = await this.getAllTeams();
            const affectedTeams = allTeams.filter(team => 
                team.route && JSON.stringify(team.route) === JSON.stringify(routeToDelete.route)
            );
            
            console.log(`👥 ${affectedTeams.length} équipes affectées:`, affectedTeams.map(t => t.name));
            
            // 3. Trouver tous les utilisateurs de ces équipes
            const allUsers = await this.getAllUsers();
            const affectedUsers = allUsers.filter(user => 
                affectedTeams.some(team => team.id === user.teamId)
            );
            
            console.log(`👤 ${affectedUsers.length} utilisateurs affectés:`, affectedUsers.map(u => u.name));
            
            // 4. Réinitialiser les équipes affectées au lobby
            for (const team of affectedTeams) {
                await this.updateTeamProgress(team.id, {
                    route: [0], // Seulement le lobby
                    foundCheckpoints: [],
                    unlockedCheckpoints: [0],
                    currentCheckpoint: 0,
                    status: 'inactive' // Marquer comme inactive
                });
                console.log(`🏠 Équipe "${team.name}" réinitialisée au lobby`);
            }
            
            // 5. Réinitialiser les utilisateurs affectés
            for (const user of affectedUsers) {
                await this.updateUserProgress(user.userId, {
                    foundCheckpoints: [],
                    unlockedCheckpoints: [0],
                    currentCheckpoint: 0,
                    status: 'inactive'
                });
                console.log(`🏠 Utilisateur "${user.name}" réinitialisé au lobby`);
            }
            
            // 6. Supprimer la route
            const q = query(
                collection(this.db, 'routes'),
                where('id', '==', routeIdInt)
            );
            const querySnapshot = await getDocs(q);
            
            for (const doc of querySnapshot.docs) {
                await deleteDoc(doc.ref);
            }
            
            console.log(`✅ Route "${routeToDelete.name}" et toutes ses dépendances supprimées`);
            return {
                route: routeId,
                routeName: routeToDelete.name,
                affectedTeams: affectedTeams.length,
                affectedUsers: affectedUsers.length
            };
            
        } catch (error) {
            console.error('❌ Erreur suppression route en cascade:', error);
            throw error;
        }
    }
}

// Exporter la classe
export default FirebaseService;
