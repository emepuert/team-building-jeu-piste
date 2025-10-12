#!/usr/bin/env node
/**
 * Script de build pour injecter les variables d'environnement
 * Utilisé par Netlify pour générer firebase-config.js à partir des variables d'env
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Build: Génération de firebase-config.js...');

// Lire les variables d'environnement Netlify
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID
};

// Vérifier que toutes les variables sont définies
const missingVars = Object.entries(firebaseConfig)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

if (missingVars.length > 0) {
    console.error('❌ Variables d\'environnement manquantes:', missingVars.join(', '));
    console.error('ℹ️  Configurez-les dans Netlify: Site settings > Environment variables');
    process.exit(1);
}

// Lire le template
const templatePath = path.join(__dirname, 'firebase-config.template.js');
const template = fs.readFileSync(templatePath, 'utf8');

// Remplacer les valeurs
let config = template
    .replace('"VOTRE_API_KEY_ICI"', `"${firebaseConfig.apiKey}"`)
    .replace('"VOTRE_PROJECT_ID.firebaseapp.com"', `"${firebaseConfig.authDomain}"`)
    .replace(/"VOTRE_PROJECT_ID"/g, `"${firebaseConfig.projectId}"`)
    .replace('"VOTRE_PROJECT_ID.firebasestorage.app"', `"${firebaseConfig.storageBucket}"`)
    .replace('"VOTRE_SENDER_ID"', `"${firebaseConfig.messagingSenderId}"`)
    .replace('"VOTRE_APP_ID"', `"${firebaseConfig.appId}"`)
    .replace('"VOTRE_MEASUREMENT_ID"', `"${firebaseConfig.measurementId}"`);

// Écrire le fichier
const outputPath = path.join(__dirname, 'firebase-config.js');
fs.writeFileSync(outputPath, config);

console.log('✅ firebase-config.js généré avec succès');
console.log('📝 Configuration:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain
});

