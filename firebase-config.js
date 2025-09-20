// Configuration Firebase
// ⚠️ IMPORTANT: Remplacez ces valeurs par vos vraies clés Firebase !

export const firebaseConfig = {
    apiKey: "AIzaSyDy3HT4aQgJV5wRhYYXyJg4IjQppFnL1Mc",
    authDomain: "inicio-e9f6d.firebaseapp.com",
    projectId: "inicio-e9f6d",
    storageBucket: "inicio-e9f6d.firebasestorage.app",
    messagingSenderId: "466666902382",
    appId: "1:466666902382:web:baa7ca423fac6bdd7f677f",
    measurementId: "G-NNS664XG6E"
};

// Structure de la base de données Firestore
export const DB_COLLECTIONS = {
    TEAMS: 'teams',
    CHECKPOINTS: 'checkpoints', 
    GAME_SESSIONS: 'game_sessions',
    VALIDATIONS: 'validations'
};

// Types d'épreuves
export const CHALLENGE_TYPES = {
    ENIGMA: 'enigma',           // Énigme automatique
    VALIDATION: 'validation',   // Validation manuelle admin
    PHOTO: 'photo',            // Photo à envoyer
    OBJECT: 'object',          // Objet à ramener
    INFO: 'info'               // Information à trouver
};
