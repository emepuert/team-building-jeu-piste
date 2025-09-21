// Configuration Firebase
// ⚠️ IMPORTANT: Remplacez ces valeurs par vos vraies clés Firebase !

export const firebaseConfig = {
    apiKey: "NOUVELLES_CLES_FIREBASE_ICI",
    authDomain: "inicio-e9f6d.firebaseapp.com",
    projectId: "inicio-e9f6d",
    storageBucket: "inicio-e9f6d.firebasestorage.app",
    messagingSenderId: "NOUVEAU_SENDER_ID",
    appId: "NOUVEAU_APP_ID",
    measurementId: "NOUVEAU_MEASUREMENT_ID"
};

// Structure de la base de données Firestore
export const DB_COLLECTIONS = {
    TEAMS: 'teams',
    CHECKPOINTS: 'checkpoints', 
    GAME_SESSIONS: 'game_sessions',
    VALIDATIONS: 'validations',
    USERS: 'users'
};

// Types d'épreuves
export const CHALLENGE_TYPES = {
    ENIGMA: 'enigma',           // Énigme automatique
    VALIDATION: 'validation',   // Validation manuelle admin
    PHOTO: 'photo',            // Photo à envoyer
    OBJECT: 'object',          // Objet à ramener
    INFO: 'info'               // Information à trouver
};
