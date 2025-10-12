/**
 * Configuration des variables d'environnement pour le navigateur
 * Ce fichier peut être commité - il ne contient pas de secrets
 */

// Fonction pour récupérer les variables d'environnement
// En développement local, elles viennent de .env
// Sur Netlify, elles sont injectées au build time
export const ENV_CONFIG = {
    // API OpenRouteService - peut être remplacée par une variable d'environnement
    orsApiKey: import.meta?.env?.VITE_OPENROUTESERVICE_API_KEY || 
               window.ENV?.OPENROUTESERVICE_API_KEY || 
               '', // Sera définie via Netlify
    
    // Autres configs non sensibles
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    isProduction: window.location.hostname.includes('netlify.app') || window.location.hostname.includes('firebaseapp.com')
};

// Pour debug (ne pas afficher en production)
if (ENV_CONFIG.isDevelopment) {
    console.log('🔧 ENV_CONFIG:', ENV_CONFIG);
}

