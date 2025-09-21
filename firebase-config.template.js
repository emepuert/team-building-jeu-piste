// Configuration Firebase - TEMPLATE
// ⚠️ COPIEZ CE FICHIER VERS firebase-config.js ET REMPLACEZ PAR VOS VRAIES CLÉS

export const firebaseConfig = {
    apiKey: "VOTRE_API_KEY_ICI",
    authDomain: "VOTRE_PROJECT_ID.firebaseapp.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID",
    measurementId: "VOTRE_MEASUREMENT_ID"
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
