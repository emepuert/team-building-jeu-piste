// Service Firebase pour gérer la base de données
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
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
        const q = query(
            collection(this.db, DB_COLLECTIONS.TEAMS),
            where('sessionId', '==', this.currentGameSession),
            orderBy('createdAt', 'asc')
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
        await this.updateTeamProgress(teamId, {
            currentCheckpoint: 0,
            foundCheckpoints: [],
            unlockedCheckpoints: [0],
            status: 'active'
        });
    }
}

// Exporter la classe
export default FirebaseService;
