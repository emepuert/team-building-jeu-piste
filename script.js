// Configuration du jeu de piste - Version Test
const GAME_CONFIG = {
    // Centre de la zone de test
    center: [49.0928, 6.1907],
    zoom: 16,
    // Distance en mètres pour déclencher un indice
    proximityThreshold: 50,
    // Clé API OpenRouteService
    orsApiKey: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjgxYzE2ZTJjN2NiODQ3YjY5ZTdhYjU5MzdjNTNjMjlmIiwiaCI6Im11cm11cjY0In0=',
    // Points d'intérêt avec coordonnées et indices
    checkpoints: [] // Maintenant chargés depuis Firebase via l'admin
};

// Variables globales
let map;
let userMarker;
let userPosition = null;
let foundCheckpoints = [];
let checkpointMarkers = [];
let unlockedCheckpoints = [0]; // Le lobby est toujours accessible
let currentRoute = null; // Route actuelle affichée
let routeControl = null; // Contrôle de navigation
let currentTeam = null; // Équipe connectée
let currentTeamId = null; // ID unique de l'équipe dans Firebase
let currentDestination = null; // Destination actuelle pour recalcul auto
let lastRecalculateTime = 0; // Timestamp du dernier recalcul pour éviter les spams
let firebaseService = null; // Service Firebase
let isMapInitialized = false; // Vérifier si la carte est déjà initialisée
let isGameStarted = false; // Vérifier si le jeu est déjà démarré

// Variables pour l'épreuve audio
let currentAudioCheckpoint = null;
let audioContext = null;
let audioStream = null;
let audioAnalyser = null;
let audioDataArray = null;
let audioProgress = 0;
let audioStartTime = null;
let isAudioChallengeActive = false;
let audioAnimationId = null;

// Variables pour le QCM
let currentQCMCheckpoint = null;
let selectedAnswers = [];

// ===== SYSTÈME DE MONITORING =====
let errorLog = [];
let performanceMetrics = {
    startTime: Date.now(),
    errors: 0,
    apiCalls: 0,
    geolocationAttempts: 0
};

// ===== FONCTIONS DE MONITORING =====

// Gestionnaire d'erreurs global
function logError(error, context = 'Unknown', critical = false) {
    const errorInfo = {
        timestamp: new Date().toISOString(),
        context: context,
        message: error.message || error,
        stack: error.stack,
        critical: critical,
        userAgent: navigator.userAgent,
        url: window.location.href,
        teamId: currentTeamId,
        teamName: currentTeam?.name
    };
    
    errorLog.push(errorInfo);
    performanceMetrics.errors++;
    
    // Log dans la console avec emoji selon la criticité
    const emoji = critical ? '💥' : '⚠️';
    console.error(`${emoji} [${context}]`, error);
    
    // Garder seulement les 50 dernières erreurs
    if (errorLog.length > 50) {
        errorLog.shift();
    }
    
    // Si erreur critique, envoyer notification
    if (critical) {
        showNotification(`Erreur critique: ${context}`, 'error');
    }
    
    return errorInfo;
}

// Health check du système
function healthCheck() {
    const checks = {
        timestamp: new Date().toISOString(),
        firebase: !!window.firebaseService,
        geolocation: !!navigator.geolocation,
        network: navigator.onLine,
        localStorage: (() => {
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch (e) {
                return false;
            }
        })(),
        map: !!map,
        team: !!currentTeam,
        checkpoints: GAME_CONFIG.checkpoints?.length || 0,
        userPosition: !!userPosition,
        errors: performanceMetrics.errors,
        uptime: Math.round((Date.now() - performanceMetrics.startTime) / 1000)
    };
    
    console.log('🏥 Health Check:', checks);
    return checks;
}

// Exécution sécurisée avec fallback
function safeExecute(fn, fallback, context = 'Unknown') {
    try {
        return fn();
    } catch (error) {
        logError(error, context, false);
        return fallback;
    }
}

// Wrapper pour les appels API
async function safeApiCall(apiCall, context = 'API Call') {
    performanceMetrics.apiCalls++;
    try {
        const result = await apiCall();
        console.log(`✅ [${context}] Succès`);
        return result;
    } catch (error) {
        logError(error, context, true);
        throw error;
    }
}

// Afficher les métriques (pour debug)
function showMetrics() {
    const metrics = {
        ...performanceMetrics,
        uptime: Math.round((Date.now() - performanceMetrics.startTime) / 1000),
        recentErrors: errorLog.slice(-5),
        health: healthCheck()
    };
    
    console.table(metrics);
    return metrics;
}

// Activer le mode debug (triple-clic sur le titre)
function enableDebugMode() {
    document.getElementById('debug-panel').style.display = 'block';
    console.log('🔧 Mode debug activé ! Utilisez les boutons en haut à droite.');
    showNotification('🔧 Mode debug activé !', 'success');
}

// Triple-clic sur le titre pour activer le debug
let titleClickCount = 0;
let touchStartTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    const title = document.querySelector('h1');
    if (title) {
        // Triple-clic pour menu debug unifié (desktop)
        title.addEventListener('click', () => {
            titleClickCount++;
            if (titleClickCount >= 3) {
                showUnifiedDebugMenu();
                showNotification('🛠️ Menu debug activé !', 'success');
                titleClickCount = 0;
            }
            setTimeout(() => titleClickCount = 0, 2000);
        });
        
        // Appui long pour menu debug unifié
        title.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
        });
        
        title.addEventListener('touchend', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration >= 1000) { // Appui long de 1 seconde
                e.preventDefault();
                showUnifiedDebugMenu();
                showNotification('🛠️ Menu debug activé !', 'success');
            }
        });
        
        // Empêcher le menu contextuel sur appui long
        title.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
});

// ===== PROTECTION ANTI-RECHARGEMENT =====
let gameStarted = false;
let gameProtectionActive = false;

// Activer la protection quand le jeu commence
function enableGameProtection() {
    if (gameProtectionActive) return;
    
    gameProtectionActive = true;
    console.log('🛡️ Protection anti-rechargement activée');
    
    // Protection rechargement/fermeture de page
    window.addEventListener('beforeunload', (event) => {
        if (gameStarted && currentTeam) {
            const message = '⚠️ Êtes-vous sûr de vouloir quitter ? Votre progression sera sauvegardée mais vous devrez vous reconnecter.';
            event.preventDefault();
            event.returnValue = message; // Chrome
            return message; // Firefox/Safari
        }
    });
    
    // Protection navigation arrière (mobile)
    window.addEventListener('popstate', (event) => {
        if (gameStarted && currentTeam) {
            const confirmLeave = confirm('⚠️ Voulez-vous vraiment quitter le jeu ? Votre progression sera sauvegardée.');
            if (!confirmLeave) {
                // Remettre l'état dans l'historique
                history.pushState(null, null, window.location.href);
            }
        }
    });
    
    // Ajouter un état dans l'historique pour capturer le retour
    history.pushState(null, null, window.location.href);
}

// Désactiver la protection (fin de jeu)
function disableGameProtection() {
    gameProtectionActive = false;
    gameStarted = false;
    console.log('🔓 Protection anti-rechargement désactivée');
}

// Déconnexion propre de l'équipe
function disconnectTeam() {
    console.log('🚪 Déconnexion de l\'équipe...');
    
    try {
        // Désactiver la protection avant de déconnecter
        disableGameProtection();
        
        // Nettoyer les données locales
        safeLocalStorage().removeItem('currentTeamId');
        
        // Réinitialiser les variables
        currentTeam = null;
        currentTeamId = null;
        foundCheckpoints = [];
        unlockedCheckpoints = [0];
        gameStarted = false;
        
        // Nettoyer la carte
        if (map) {
            checkpointMarkers.forEach(markerData => {
                if (markerData.marker) {
                    map.removeLayer(markerData.marker);
                }
                if (markerData.circle) {
                    map.removeLayer(markerData.circle);
                }
            });
            checkpointMarkers = [];
            
            if (currentRoute) {
                map.removeLayer(currentRoute);
                currentRoute = null;
            }
        }
        
        // Masquer les infos équipe
        document.getElementById('team-info').style.display = 'none';
        
        // Réafficher le modal de connexion
        showTeamLoginModal();
        
        // Notification de déconnexion
        showNotification('🚪 Déconnexion réussie', 'success');
        
        console.log('✅ Déconnexion terminée');
        
    } catch (error) {
        logError(error, 'Team Disconnect', true);
        showNotification('Erreur lors de la déconnexion', 'error');
    }
}

// Exposer les fonctions de monitoring globalement
window.healthCheck = healthCheck;
window.showMetrics = showMetrics;
window.errorLog = errorLog;
window.enableDebugMode = enableDebugMode;
window.disableGameProtection = disableGameProtection;

// Fonction pour décoder une polyline encodée
function decodePolyline(encoded) {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
        let b;
        let shift = 0;
        let result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        poly.push([lng / 1e5, lat / 1e5]);
    }
    return poly;
}

// Configuration des équipes
const TEAMS = {
    team1: {
        name: "🔴 Équipe Rouge",
        color: "#e74c3c",
        route: [1, 2] // Ordre des checkpoints pour cette équipe
    },
    team2: {
        name: "🔵 Équipe Bleue", 
        color: "#3498db",
        route: [2, 1] // Ordre différent pour cette équipe
    },
    team3: {
        name: "🟢 Équipe Verte",
        color: "#27ae60", 
        route: [1, 2] // Même que rouge pour l'instant
    },
    team4: {
        name: "🟡 Équipe Jaune",
        color: "#f1c40f",
        route: [2, 1] // Même que bleue pour l'instant
    }
};

// Initialisation de l'application
// ===== INITIALISATION DU MONITORING =====

// Gestionnaire d'erreurs global
window.addEventListener('error', (event) => {
    logError(event.error || event.message, 'Global Error Handler', true);
});

// Gestionnaire d'erreurs pour les promesses non catchées
window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, 'Unhandled Promise Rejection', true);
});

// Health check automatique toutes les 30 secondes
setInterval(() => {
    const health = healthCheck();
    // Si trop d'erreurs, alerter
    if (health.errors > 10) {
        console.warn('🚨 Trop d\'erreurs détectées:', health.errors);
    }
}, 30000);

// Enregistrer le Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('✅ Service Worker enregistré:', registration.scope);
                
                // Écouter les mises à jour
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showNotification('🔄 Mise à jour disponible ! Rechargez la page.', 'info');
                        }
                    });
                });
            })
            .catch(error => {
                logError(error, 'Service Worker Registration', false);
            });
    });
}

// Détecter les changements de connexion
window.addEventListener('online', () => {
    console.log('🌐 Connexion rétablie');
    showNotification('🌐 Connexion rétablie', 'success');
    performanceMetrics.networkStatus = 'online';
});

window.addEventListener('offline', () => {
    console.log('📴 Mode hors ligne');
    showNotification('📴 Mode hors ligne - Fonctionnalités limitées', 'warning');
    performanceMetrics.networkStatus = 'offline';
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Démarrage du jeu avec monitoring activé');
    initializeApp();
});

function initializeApp() {
    // Éviter la double initialisation
    if (window.appInitialized) {
        console.log('⚠️ App déjà initialisée, on ignore');
        return;
    }
    window.appInitialized = true;
    
    console.log('🚀 Initialisation du jeu de piste...');
    
    // Initialiser Firebase Service
    if (window.firebaseService) {
        firebaseService = window.firebaseService;
        console.log('✅ Firebase Service initialisé');
    } else {
        console.warn('⚠️ Firebase Service non disponible - mode hors ligne');
    }
    
    // Vérifier si une équipe est connectée
    checkTeamLogin();
}

function checkTeamLogin() {
    // Vérifier si une équipe est déjà connectée avec gestion d'erreurs
    const savedTeamId = safeExecute(
        () => localStorage.getItem('currentTeamId'),
        null,
        'LocalStorage Read'
    );
    
    if (savedTeamId) {
        // Équipe déjà connectée, charger ses données
        loadTeamData(savedTeamId);
    } else {
        // Pas d'équipe connectée, afficher le modal de connexion
        showTeamLoginModal();
    }
}

// Wrapper sécurisé pour localStorage
function safeLocalStorage() {
    return {
        getItem: (key) => safeExecute(
            () => localStorage.getItem(key),
            null,
            `LocalStorage.getItem(${key})`
        ),
        setItem: (key, value) => safeExecute(
            () => localStorage.setItem(key, value),
            false,
            `LocalStorage.setItem(${key})`
        ),
        removeItem: (key) => safeExecute(
            () => localStorage.removeItem(key),
            false,
            `LocalStorage.removeItem(${key})`
        ),
        isAvailable: () => {
            try {
                const test = 'localStorage_test';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        }
    };
}

function showTeamLoginModal() {
    const modal = document.getElementById('user-login-modal'); // On garde le même modal pour l'instant
    modal.style.display = 'block';
    
    // Configurer les événements de connexion
    setupLoginEvents();
}

function setupLoginEvents() {
    const userIdInput = document.getElementById('user-id');
    const passwordInput = document.getElementById('user-password');
    const loginBtn = document.getElementById('login-btn');
    
    // Activer/désactiver le bouton selon les champs
    function updateLoginButton() {
        const hasUserId = userIdInput.value.trim().length > 0;
        const hasPassword = passwordInput.value.length > 0;
        loginBtn.disabled = !(hasUserId && hasPassword);
    }
    
    userIdInput.addEventListener('input', updateLoginButton);
    passwordInput.addEventListener('input', updateLoginButton);
    
    // Connexion avec Enter
    [userIdInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !loginBtn.disabled) {
                handleUserLogin();
            }
        });
    });
    
    // Connexion avec le bouton
    loginBtn.addEventListener('click', handleUserLogin);
}

// Gestion de la connexion équipe (plus de users !)
async function handleUserLogin() {
    const teamName = document.getElementById('user-id').value.trim();
    const password = document.getElementById('user-password').value;
    const errorDiv = document.getElementById('login-error');
    const loadingDiv = document.getElementById('login-loading');
    
    try {
        // Afficher le loading
        errorDiv.style.display = 'none';
        loadingDiv.style.display = 'block';
        
        // Vérifier les identifiants de l'équipe dans Firebase
        const team = await safeApiCall(
            () => firebaseService.authenticateTeam(teamName, password),
            'Team Authentication'
        );
        
        if (team) {
            // Connexion réussie
            currentTeam = team;
            currentTeamId = team.id;
            safeLocalStorage().setItem('currentTeamId', team.id);
            
            // Cacher le modal et démarrer le jeu
            document.getElementById('user-login-modal').style.display = 'none';
            
            // Charger les données de l'équipe
            await loadTeamGameData();
            
            showNotification(`Bienvenue équipe ${team.name} !`, 'success');
            
        } else {
            showLoginError('Nom d\'équipe ou mot de passe incorrect');
        }
        
    } catch (error) {
        logError(error, 'Team Login', true);
        showLoginError('Erreur de connexion. Veuillez réessayer.');
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Charger les données équipe depuis Firebase
async function loadTeamData(teamId) {
    try {
        const team = await firebaseService.getTeam(teamId);
        if (team) {
            currentTeam = team;
            currentTeamId = teamId;
            await loadTeamGameData();
        } else {
            // Équipe non trouvée, déconnecter
            safeLocalStorage().removeItem('currentTeamId');
            showTeamLoginModal();
        }
    } catch (error) {
        logError(error, 'Load Team Data', true);
        safeLocalStorage().removeItem('currentTeamId');
        showTeamLoginModal();
    }
}

// Charger les données de jeu de l'équipe
async function loadTeamGameData() {
    if (!currentTeam) {
        console.error('❌ Aucune équipe actuelle pour charger les données de jeu');
        return;
    }
    
    try {
        // Vérifier que l'équipe a une route valide
        if (!currentTeam.route || currentTeam.route.length === 0) {
            console.error('❌ L\'équipe n\'a pas de parcours défini:', currentTeam);
            showNotification('❌ Parcours non configuré pour votre équipe. Contactez l\'administrateur.', 'error');
            return;
        }
        
        // Restaurer la progression avec des valeurs par défaut sûres
        foundCheckpoints = currentTeam.foundCheckpoints || [];
        unlockedCheckpoints = currentTeam.unlockedCheckpoints || [0];
        
        // Vérifier la cohérence des données
        if (!Array.isArray(foundCheckpoints)) foundCheckpoints = [];
        if (!Array.isArray(unlockedCheckpoints)) unlockedCheckpoints = [0];
        
        // S'assurer que le lobby (0) est toujours débloqué
        if (!unlockedCheckpoints.includes(0)) {
            unlockedCheckpoints.unshift(0);
        }
        
        // Afficher les infos de l'équipe
        showTeamInfo();
        
        // Démarrer le jeu (attendre que les checkpoints soient chargés)
        await startGame();
        
        // Démarrer la synchronisation temps réel avec l'équipe
        startTeamSync();
        
        // Activer la protection anti-rechargement maintenant que le jeu a commencé
        gameStarted = true;
        enableGameProtection();
        // Notification discrète dans la console seulement
        console.log('🛡️ Protection anti-rechargement activée - Le jeu vous demandera confirmation avant de quitter');
        
        console.log(`✅ Équipe ${currentTeam.name} connectée`, {
            foundCheckpoints,
            unlockedCheckpoints,
            teamRoute: currentTeam.route
        });
        
    } catch (error) {
        console.error('❌ Erreur lors du chargement des données de jeu:', error);
        showNotification('❌ Erreur de chargement. Rechargez la page.', 'error');
    }
}

// Afficher les informations équipe
function showTeamInfo() {
    const teamInfo = document.getElementById('team-info');
    const currentTeamSpan = document.getElementById('current-team');
    
    if (currentTeam && teamInfo && currentTeamSpan) {
        currentTeamSpan.textContent = `Équipe ${currentTeam.name}`;
        currentTeamSpan.style.color = currentTeam.color || '#3498db';
        teamInfo.style.display = 'block';
    }
}

// Afficher une erreur de connexion
function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Vider les champs
    document.getElementById('user-id').value = '';
    document.getElementById('user-password').value = '';
}

// Fonction supprimée - doublon avec la fonction showTeamInfo() ligne 270

async function startGame() {
    // Vérifier si le jeu est déjà démarré
    if (isGameStarted) {
        console.log('⚠️ Jeu déjà démarré, on ignore');
        return;
    }
    
    // Initialiser la carte
    initializeMap();
    
    // Demander la géolocalisation
    requestGeolocation();
    
    // Configurer les événements
    setupEventListeners();
    
    // Synchroniser et ajouter les checkpoints depuis Firebase AVANT de continuer
    await syncCheckpoints();
    
    // Mettre à jour l'interface
    updateUI();
    
    isGameStarted = true;
}

function initializeMap() {
    console.log('🗺️ Initialisation de la carte...');
    
    // Vérifier si la carte est déjà initialisée
    if (isMapInitialized) {
        console.log('⚠️ Carte déjà initialisée, on ignore');
        return;
    }
    
    // Créer la carte centrée sur Turin
    map = L.map('map').setView(GAME_CONFIG.center, GAME_CONFIG.zoom);
    isMapInitialized = true;
    
    // Ajouter les tuiles OpenStreetMap (gratuit)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Personnaliser les contrôles
    map.zoomControl.setPosition('bottomright');
    
    // Ajouter le bouton de localisation
    addLocationControl();
    
    console.log('✅ Carte initialisée avec succès');
}

// Ajouter le contrôle de localisation sur la carte
function addLocationControl() {
    // Créer le contrôle personnalisé
    const LocationControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            
            container.style.backgroundColor = 'white';
            container.style.backgroundImage = 'none';
            container.style.width = '34px';
            container.style.height = '34px';
            container.style.cursor = 'pointer';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.fontSize = '16px';
            container.innerHTML = '📍';
            container.title = 'Me localiser';
            
            container.onclick = function() {
                locateUser();
            };
            
            // Empêcher la propagation des événements
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        }
    });
    
    // Ajouter le contrôle à la carte
    map.addControl(new LocationControl());
}

// Fonction pour localiser l'utilisateur
function locateUser() {
    console.log('🎯 Localisation demandée via bouton carte');
    
    if (!navigator.geolocation) {
        showNotification('Géolocalisation non supportée', 'error');
        return;
    }
    
    // Afficher un indicateur de chargement
    showNotification('📍 Localisation en cours...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Centrer la carte sur la position
            map.setView([lat, lng], 16);
            
            // Mettre à jour la position utilisateur
            userPosition = {
                lat: lat,
                lng: lng,
                accuracy: position.coords.accuracy
            };
            
            updateUserMarker();
            checkProximityToCheckpoints();
            
            showNotification('📍 Position trouvée !', 'success');
            console.log('✅ Localisation réussie:', lat, lng);
        },
        (error) => {
            logError(error, 'Manual Location Request', false);
            
            let message = 'Erreur de localisation';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Géolocalisation refusée';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Position indisponible';
                    break;
                case error.TIMEOUT:
                    message = 'Délai dépassé';
                    break;
            }
            
            showNotification(message, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

function requestGeolocation() {
    console.log('📍 Demande de géolocalisation...');
    performanceMetrics.geolocationAttempts++;
    
    if (!navigator.geolocation) {
        logError('Géolocalisation non supportée', 'Geolocation Check', true);
        showNotification('Géolocalisation non supportée par votre navigateur', 'error');
        updateStatus('Géolocalisation non disponible');
        return;
    }
    
    updateStatus('Localisation en cours...');
    
    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 2000  // Rafraîchissement plus fréquent (2 secondes)
    };
    
    navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        onLocationError,
        options
    );
    
    // Surveiller la position en continu
    navigator.geolocation.watchPosition(
        onLocationUpdate,
        onLocationError,
        options
    );
}


function onLocationSuccess(position) {
    console.log('✅ Position obtenue:', position.coords);
    
    userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
    };
    
    updateUserMarker();
    updateStatus('Position trouvée !');
    checkProximityToCheckpoints();
    updateHint();
    
    showNotification('Position détectée avec succès !');
}

function getNextAccessibleCheckpoint() {
    return GAME_CONFIG.checkpoints.find(cp => {
        const isFound = foundCheckpoints.includes(cp.id);
        const isUnlocked = unlockedCheckpoints.includes(cp.id);
        const isAccessible = !cp.locked || isUnlocked;
        return !isFound && isAccessible;
    });
}

function getNextCheckpointForTeam() {
    if (!currentTeam || !currentTeam.route) return null;
    
    const teamRoute = currentTeam.route;
    const nonLobbyFound = foundCheckpoints.filter(id => {
        const cp = GAME_CONFIG.checkpoints.find(c => c.id === id);
        return cp && !cp.isLobby;
    });
    
    // Déterminer quel est le prochain checkpoint dans l'ordre de l'équipe
    // On commence à l'index 1 pour ignorer le lobby (index 0)
    const nextIndex = nonLobbyFound.length + 1;
    
    if (nextIndex < teamRoute.length) {
        return teamRoute[nextIndex];
    }
    
    return null; // Tous les checkpoints sont terminés
}

function getTeamColor() {
    return currentTeam?.color || '#3498db';
}

// Fonction pour mettre à jour la progression sur la route (grignotage + recalcul auto)
function updateRouteProgress() {
    if (!currentRoute || !userPosition) {
        console.log('⚠️ updateRouteProgress: pas de route ou position', {currentRoute: !!currentRoute, userPosition: !!userPosition});
        return;
    }
    
    console.log('🔄 Mise à jour progression GPS...');
    
    const userLatLng = L.latLng(userPosition.lat, userPosition.lng);
    const progressThreshold = 20; // Distance en mètres pour considérer qu'on a "mangé" un segment
    const recalculateThreshold = 50; // Distance en mètres pour recalculer la route
    
    // Récupérer les coordonnées de la route
    const routeCoords = [];
    currentRoute.eachLayer(function(layer) {
        if (layer.feature && layer.feature.geometry && layer.feature.geometry.coordinates) {
            layer.feature.geometry.coordinates.forEach(coord => {
                routeCoords.push(L.latLng(coord[1], coord[0])); // Inverser lng/lat
            });
        }
    });
    
    if (routeCoords.length === 0) return;
    
    // Trouver le point le plus proche sur la route
    let closestDistance = Infinity;
    let closestIndex = 0;
    
    routeCoords.forEach((coord, index) => {
        const distance = userLatLng.distanceTo(coord);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
        }
    });
    
    // Si on est assez proche, "manger" la partie de route déjà parcourue
    if (closestDistance < progressThreshold && closestIndex > 0) {
        const remainingCoords = routeCoords.slice(closestIndex);
        
        if (remainingCoords.length > 1) {
            // Supprimer l'ancienne route
            map.removeLayer(currentRoute);
            
            // Créer une nouvelle route avec seulement la partie restante
            const remainingGeoJSON = {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: remainingCoords.map(coord => [coord.lng, coord.lat])
                }
            };
            
            currentRoute = L.geoJSON(remainingGeoJSON, {
                style: {
                    color: getTeamColor(),
                    weight: 5,
                    opacity: 0.8,
                    dashArray: '10, 5'
                }
            }).addTo(map);
        }
    }
    // Si on est trop loin du trajet, recalculer automatiquement
    else if (closestDistance > recalculateThreshold && currentDestination) {
        const now = Date.now();
        const minRecalculateInterval = 10000; // Minimum 10 secondes entre recalculs
        
        if (now - lastRecalculateTime > minRecalculateInterval) {
            console.log(`🔄 Recalcul automatique - Distance du trajet: ${Math.round(closestDistance)}m`);
            showNotification('🔄 Recalcul du trajet GPS...');
            lastRecalculateTime = now;
            
            // Recalculer la route vers la même destination
            setTimeout(() => {
                calculateRoute(userPosition, currentDestination);
            }, 1000);
        }
    }
}

function onLocationUpdate(position) {
    userPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
    };
    
    updateUserMarker();
    checkProximityToCheckpoints();
    
    // Mettre à jour la route si elle existe (grignotage)
    if (currentRoute) {
        updateRouteProgress();
    }
}

function onLocationError(error) {
    logError(error, 'Geolocation Error', true);
    
    let message = 'Erreur de géolocalisation';
    let showFallback = false;
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Géolocalisation refusée. Vous pouvez continuer en mode manuel.';
            showFallback = true;
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Position indisponible. Mode manuel disponible.';
            showFallback = true;
            break;
        case error.TIMEOUT:
            message = 'Délai de géolocalisation dépassé. Réessai automatique...';
            // Réessayer après 5 secondes
            setTimeout(() => {
                console.log('🔄 Nouvel essai de géolocalisation...');
                requestGeolocation();
            }, 5000);
            break;
    }
    
    updateStatus(message);
    showNotification(message, 'error');
    
    // Afficher le mode fallback si nécessaire
    if (showFallback) {
        showGeolocationFallback();
    }
}

// Mode fallback pour la géolocalisation
function showGeolocationFallback() {
    const fallbackHTML = `
        <div id="geolocation-fallback" style="
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000; max-width: 90%; text-align: center;
        ">
            <h3>🗺️ Mode Manuel</h3>
            <p>La géolocalisation n'est pas disponible.<br>Vous pouvez continuer en mode manuel :</p>
            
            <div style="margin: 1rem 0;">
                <button onclick="simulatePosition(49.0928, 6.1907)" style="
                    background: #3498db; color: white; border: none; padding: 0.8rem 1rem;
                    border-radius: 8px; margin: 0.5rem; cursor: pointer;
                ">📍 Position Luxembourg Centre</button>
                
                <button onclick="simulatePosition(49.6116, 6.1319)" style="
                    background: #27ae60; color: white; border: none; padding: 0.8rem 1rem;
                    border-radius: 8px; margin: 0.5rem; cursor: pointer;
                ">📍 Position Luxembourg Ville</button>
            </div>
            
            <div style="margin: 1rem 0;">
                <input type="number" id="manual-lat" placeholder="Latitude" step="any" style="
                    padding: 0.5rem; margin: 0.2rem; border: 1px solid #ddd; border-radius: 4px; width: 120px;
                ">
                <input type="number" id="manual-lng" placeholder="Longitude" step="any" style="
                    padding: 0.5rem; margin: 0.2rem; border: 1px solid #ddd; border-radius: 4px; width: 120px;
                ">
                <button onclick="setManualPosition()" style="
                    background: #f39c12; color: white; border: none; padding: 0.5rem 1rem;
                    border-radius: 4px; margin: 0.2rem; cursor: pointer;
                ">✅ Valider</button>
            </div>
            
            <button onclick="closeGeolocationFallback()" style="
                background: #e74c3c; color: white; border: none; padding: 0.5rem 1rem;
                border-radius: 4px; cursor: pointer;
            ">❌ Fermer</button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', fallbackHTML);
}

function setManualPosition() {
    const lat = parseFloat(document.getElementById('manual-lat').value);
    const lng = parseFloat(document.getElementById('manual-lng').value);
    
    if (isNaN(lat) || isNaN(lng)) {
        showNotification('Coordonnées invalides', 'error');
        return;
    }
    
    // Simuler une position
    simulatePosition(lat, lng);
    closeGeolocationFallback();
}

function closeGeolocationFallback() {
    const fallback = document.getElementById('geolocation-fallback');
    if (fallback) {
        fallback.remove();
    }
}

function updateUserMarker() {
    if (!userPosition) return;
    
    const userLatLng = [userPosition.lat, userPosition.lng];
    
    if (userMarker) {
        userMarker.setLatLng(userLatLng);
    } else {
        // Créer un marqueur personnalisé pour l'utilisateur
        const userIcon = L.divIcon({
            className: 'user-marker',
            html: '📍',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        userMarker = L.marker(userLatLng, { icon: userIcon })
            .addTo(map)
            .bindPopup('Votre position actuelle');
    }
    
    // Centrer la carte sur l'utilisateur (seulement la première fois)
    if (!map.hasUserCentered) {
        map.setView(userLatLng, GAME_CONFIG.zoom);
        map.hasUserCentered = true;
    }
}

function addCheckpointsToMap() {
    console.log('📍 Ajout des checkpoints sur la carte...');
    
    GAME_CONFIG.checkpoints.forEach(checkpoint => {
        const isFound = foundCheckpoints.includes(checkpoint.id);
        const isUnlocked = unlockedCheckpoints.includes(checkpoint.id);
        const isLocked = checkpoint.locked && !isUnlocked;
        
        // Ne pas afficher les points verrouillés sur la carte
        if (isLocked) {
            // Stocker le checkpoint pour l'ajouter plus tard
            checkpointMarkers.push({
                id: checkpoint.id,
                marker: null,
                circle: null,
                checkpoint: checkpoint,
                hidden: true
            });
            return;
        }
        
        // Ajouter le cercle de proximité (buffer de 50m)
        const circle = L.circle(checkpoint.coordinates, {
            color: isFound ? '#27ae60' : '#3498db',
            fillColor: isFound ? '#27ae60' : '#3498db',
            fillOpacity: 0.1,
            radius: GAME_CONFIG.proximityThreshold,
            weight: 2,
            opacity: 0.6
        }).addTo(map);
        
        let markerClass = 'checkpoint-marker';
        if (isFound) markerClass += ' found';
        
        const markerIcon = L.divIcon({
            className: markerClass,
            html: checkpoint.emoji,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Créer le contenu du popup
        let popupContent = `
            <div style="text-align: center;">
                <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                <p>${isFound ? '✅ Découvert !' : checkpoint.isLobby ? '🏠 Lobby' : '🔍 À découvrir'}</p>
                ${!isFound ? `<p><em>${checkpoint.hint}</em></p>` : ''}
                <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
        `;
        
        // Ajouter le bouton GPS pour tous les points visibles
        if (userPosition) {
            let buttonText = '🧭 Calculer l\'itinéraire GPS';
            let targetId = checkpoint.id;
            
            // Tous les points (y compris le lobby) ont un bouton GPS vers eux-mêmes
            if (checkpoint.isLobby) {
                buttonText = '🧭 GPS vers Lobby';
            }
            
            popupContent += `
                <br>
                <button onclick="calculateRouteFromPopup(${targetId})" 
                        style="background: linear-gradient(135deg, ${getTeamColor()} 0%, ${getTeamColor()} 100%); 
                               color: white; border: none; padding: 0.5rem 1rem; 
                               border-radius: 20px; font-size: 0.9rem; cursor: pointer; 
                               margin-top: 0.5rem;">
                    ${buttonText}
                </button>
            `;
        }
        
        popupContent += '</div>';
        
        const marker = L.marker(checkpoint.coordinates, { icon: markerIcon })
            .addTo(map)
            .bindPopup(popupContent);
        
        // Ajouter un événement de clic pour les épreuves audio non réussies
        marker.on('click', function() {
            // Si c'est un checkpoint audio et qu'il n'est pas encore trouvé, permettre de relancer l'épreuve
            if (checkpoint.type === 'audio' && !foundCheckpoints.includes(checkpoint.id)) {
                showAudioChallenge(checkpoint);
            }
        });
        
        checkpointMarkers.push({
            id: checkpoint.id,
            marker: marker,
            circle: circle,
            checkpoint: checkpoint,
            hidden: false
        });
    });
    
    console.log(`✅ ${checkpointMarkers.filter(m => !m.hidden).length} checkpoints visibles ajoutés`);
}

function checkProximityToCheckpoints() {
    if (!userPosition) return;
    
    // Vérifier seulement les checkpoints visibles sur la carte
    checkpointMarkers.forEach(markerData => {
        if (markerData.hidden || !markerData.marker) return;
        if (foundCheckpoints.includes(markerData.checkpoint.id)) return;
        
        const checkpoint = markerData.checkpoint;
        const distance = calculateDistance(
            userPosition.lat,
            userPosition.lng,
            checkpoint.coordinates[0],
            checkpoint.coordinates[1]
        );
        
        if (distance <= GAME_CONFIG.proximityThreshold) {
            console.log(`🎯 Checkpoint ${checkpoint.name} trouvé ! Distance: ${distance.toFixed(1)}m`);
            // Validation anti-triche basique
            validateCheckpointProximity(checkpoint, distance);
        }
    });
}

// Validation serveur de la proximité (anti-triche basique)
async function validateCheckpointProximity(checkpoint, distance) {
    const validationData = {
        checkpointId: checkpoint.id,
        teamId: currentTeamId,
        userPosition: userPosition,
        distance: distance,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        accuracy: userPosition.accuracy || 0
    };
    
    try {
        // Log de la tentative de validation
        console.log('🔍 Validation proximité:', validationData);
        
        // Vérifications anti-triche basiques
        const suspiciousActivity = detectSuspiciousActivity(validationData);
        if (suspiciousActivity) {
            logError(`Activité suspecte détectée: ${suspiciousActivity}`, 'Anti-Cheat', true);
            showNotification('⚠️ Activité suspecte détectée', 'warning');
            return;
        }
        
        // Si tout est OK, marquer comme trouvé
        foundCheckpoint(checkpoint);
        
        // Optionnel: Envoyer à Firebase pour audit
        if (firebaseService) {
            await safeApiCall(
                () => firebaseService.logCheckpointValidation?.(validationData),
                'Checkpoint Validation Log'
            );
        }
        
    } catch (error) {
        logError(error, 'Checkpoint Validation', true);
    }
}

// Détection d'activité suspecte basique
function detectSuspiciousActivity(data) {
    // Vérifier la précision GPS
    if (data.accuracy > 100) {
        return 'Précision GPS trop faible';
    }
    
    // Vérifier les mouvements impossibles
    const lastValidation = performanceMetrics.lastValidation;
    if (lastValidation) {
        const timeDiff = data.timestamp - lastValidation.timestamp;
        const distanceDiff = calculateDistance(
            data.userPosition.lat, data.userPosition.lng,
            lastValidation.userPosition.lat, lastValidation.userPosition.lng
        );
        
        // Vitesse impossible (>200 km/h)
        const speed = (distanceDiff / 1000) / (timeDiff / 3600000); // km/h
        if (speed > 200) {
            return `Vitesse impossible: ${speed.toFixed(1)} km/h`;
        }
    }
    
    performanceMetrics.lastValidation = data;
    return null;
}

function foundCheckpoint(checkpoint) {
    if (foundCheckpoints.includes(checkpoint.id)) return;
    
    // Pour les checkpoints photo et audio, ne pas marquer comme trouvé immédiatement
    // Photo : attendre la validation admin
    // Audio : attendre la réussite de l'épreuve
    if (checkpoint.type !== 'photo' && checkpoint.type !== 'audio') {
        foundCheckpoints.push(checkpoint.id);
    }
    
    // Supprimer la route actuelle puisque le point est atteint
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    
    // Mettre à jour le marqueur et le cercle (sauf pour les épreuves audio non réussies)
    const markerData = checkpointMarkers.find(m => m.id === checkpoint.id);
    if (markerData && checkpoint.type !== 'audio') {
        const newIcon = L.divIcon({
            className: 'checkpoint-marker found',
            html: checkpoint.emoji,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        markerData.marker.setIcon(newIcon);
        
        // Contenu du popup différent pour le lobby
        let popupContent;
        if (checkpoint.isLobby) {
            popupContent = `
                <div style="text-align: center;">
                    <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                    <p>✅ Visité !</p>
                    <p><em>${checkpoint.hint}</em></p>
                    <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
                    <br>
                    <button onclick="calculateRouteFromPopup(0)" 
                            style="background: linear-gradient(135deg, ${getTeamColor()} 0%, ${getTeamColor()} 100%); 
                                   color: white; border: none; padding: 0.5rem 1rem; 
                                   border-radius: 20px; font-size: 0.9rem; cursor: pointer; 
                                   margin-top: 0.5rem;">
                        🧭 GPS vers Lobby
                    </button>
                </div>
            `;
        } else {
            popupContent = `
                <div style="text-align: center;">
                    <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                    <p>✅ Découvert !</p>
                    <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
                    <br>
                    <button onclick="calculateRouteFromPopup(${checkpoint.id})" 
                            style="background: linear-gradient(135deg, ${getTeamColor()} 0%, ${getTeamColor()} 100%); 
                                   color: white; border: none; padding: 0.5rem 1rem; 
                                   border-radius: 20px; font-size: 0.9rem; cursor: pointer; 
                                   margin-top: 0.5rem;">
                        🧭 Calculer l'itinéraire GPS
                    </button>
                </div>
            `;
        }
        
        markerData.marker.setPopupContent(popupContent);
        
        // Mettre à jour le cercle en vert (sauf pour les épreuves audio non réussies)
        if (checkpoint.type !== 'audio') {
            markerData.circle.setStyle({
                color: '#27ae60',
                fillColor: '#27ae60'
            });
        }
    }
    
    // Afficher l'indice (sauf pour le lobby et sauf si c'est la fin du jeu)
    if (!checkpoint.isLobby) {
        // Vérifier si c'est le dernier checkpoint
        const teamRoute = currentTeam?.route || [];
        const nonLobbyRoute = teamRoute.filter(id => id !== 0);
        const nonLobbyFound = foundCheckpoints.filter(id => id !== 0);
        const isGameComplete = nonLobbyFound.length >= nonLobbyRoute.length && nonLobbyRoute.length > 0;
        
        if (!isGameComplete) {
            showClue(checkpoint.clue, checkpoint);
        } else {
            console.log('🏁 Dernier checkpoint - pas d\'indice, seulement modal de victoire');
        }
    } else {
        // Pour le lobby, débloquer le premier checkpoint selon l'équipe
        setTimeout(() => {
            console.log('🏠 Lobby trouvé, recherche du premier checkpoint...');
            console.log('👥 currentTeam:', currentTeam);
            console.log('🛤️ teamRoute:', currentTeam?.route);
            
            const firstCheckpointId = getNextCheckpointForTeam();
            console.log('🎯 Premier checkpoint ID:', firstCheckpointId);
            
            if (firstCheckpointId) {
                console.log('🔓 Débloquage du checkpoint:', firstCheckpointId);
                unlockCheckpoint(firstCheckpointId);
            } else {
                console.log('❌ Aucun checkpoint à débloquer trouvé');
            }
        }, 1000);
    }
    
    // Sauvegarder la progression dans Firebase (équipe seulement)
    // Mais PAS pour les checkpoints photo (attendre validation admin)
    // Ni pour les checkpoints audio (attendre réussite épreuve)
    if (firebaseService && currentTeam && currentTeamId && checkpoint.type !== 'photo' && checkpoint.type !== 'audio') {
        // Plus besoin d'utilisateurs - équipe directement
        
        // Mettre à jour l'équipe aussi pour que l'admin voit les changements
        firebaseService.updateTeamProgress(currentTeamId, {
            foundCheckpoints: foundCheckpoints,
            unlockedCheckpoints: unlockedCheckpoints
        });
        
        console.log('💾 Progression sauvegardée (utilisateur + équipe):', {
            teamId: currentTeamId,
            foundCheckpoints, 
            unlockedCheckpoints
        });
    } else if (checkpoint.type === 'photo') {
        console.log('📸 Checkpoint photo - attente validation admin');
    } else if (checkpoint.type === 'audio') {
        console.log('🎤 Checkpoint audio - attente réussite épreuve');
    }
    
    // Mettre à jour l'interface
    updateUI();
    
    // Vérifier si l'équipe a terminé son parcours (exclure le lobby du compte)
    const teamRoute = currentTeam?.route || [];
    const nonLobbyRoute = teamRoute.filter(id => id !== 0); // Exclure le lobby
    const nonLobbyFound = foundCheckpoints.filter(id => id !== 0); // Exclure le lobby
    
    console.log('🏁 Vérification fin de jeu:', {
        teamRoute: teamRoute,
        nonLobbyRoute: nonLobbyRoute,
        nonLobbyFound: nonLobbyFound,
        isComplete: nonLobbyFound.length >= nonLobbyRoute.length
    });
    
    const isGameComplete = nonLobbyFound.length >= nonLobbyRoute.length && nonLobbyRoute.length > 0;
    
    if (isGameComplete) {
        console.log(`🎉 Équipe ${currentTeam?.name} a terminé son parcours !`);
        // Pour le dernier checkpoint, afficher seulement le modal de victoire
        setTimeout(() => {
            showSuccessModal();
        }, 1000);
    } else {
        // Notification normale seulement si ce n'est pas la fin
        const message = checkpoint.isLobby ? `🏠 Bienvenue au ${checkpoint.name} !` : `🎉 ${checkpoint.name} découvert !`;
        showNotification(message);
    }
}

function showClue(clue, checkpoint = null) {
    // Si c'est un checkpoint photo, afficher le modal photo
    if (checkpoint && checkpoint.type === 'photo') {
        showPhotoChallenge(checkpoint);
        return;
    }
    
    // Si c'est un checkpoint audio, afficher le modal audio
    if (checkpoint && checkpoint.type === 'audio') {
        showAudioChallenge(checkpoint);
        return;
    }
    
    // Si c'est un checkpoint QCM, afficher le modal QCM
    if (checkpoint && checkpoint.type === 'qcm') {
        showQCMChallenge(checkpoint);
        return;
    }
    
    // Si l'indice contient une énigme, afficher la modal d'énigme
    if (clue.riddle) {
        showRiddle(clue);
        return;
    }
    
    // Sinon, afficher la modal d'indice normale
    const modal = document.getElementById('clue-modal');
    const title = document.getElementById('clue-title');
    const text = document.getElementById('clue-text');
    const image = document.getElementById('clue-image');
    
    title.textContent = clue.title;
    text.textContent = clue.text;
    
    if (clue.image) {
        image.innerHTML = `<img src="${clue.image}" alt="${clue.title}">`;
    } else {
        image.innerHTML = '';
    }
    
    modal.style.display = 'block';
}

function showRiddle(clue) {
    const modal = document.getElementById('riddle-modal');
    const question = document.getElementById('riddle-question');
    const answerInput = document.getElementById('riddle-answer');
    const hintElement = document.getElementById('riddle-hint');
    const feedback = document.getElementById('riddle-feedback');
    
    question.textContent = clue.riddle.question;
    hintElement.textContent = clue.riddle.hint;
    hintElement.style.display = 'none';
    answerInput.value = '';
    feedback.innerHTML = '';
    feedback.className = '';
    
    modal.style.display = 'block';
    answerInput.focus();
}

function checkRiddleAnswer() {
    const answerInput = document.getElementById('riddle-answer');
    const hintElement = document.getElementById('riddle-hint');
    const feedback = document.getElementById('riddle-feedback');
    const userAnswer = answerInput.value.trim().toLowerCase();
    
    // Récupérer l'énigme du checkpoint actuel depuis la modal
    const riddleQuestion = document.getElementById('riddle-question').textContent;
    
    // Trouver le checkpoint correspondant à cette énigme
    const currentCheckpoint = GAME_CONFIG.checkpoints.find(cp => 
        cp.clue && cp.clue.riddle && cp.clue.riddle.question === riddleQuestion
    );
    
    if (!currentCheckpoint || !currentCheckpoint.clue || !currentCheckpoint.clue.riddle) {
        console.error('❌ Impossible de trouver l\'énigme actuelle');
        feedback.innerHTML = '❌ Erreur système. Veuillez recharger la page.';
        feedback.className = 'error';
        return;
    }
    
    const correctAnswer = currentCheckpoint.clue.riddle.answer.toLowerCase();
    
    if (userAnswer === correctAnswer) {
        // Bonne réponse !
        const successMessage = currentCheckpoint.clue.text || '🎉 Correct ! Énigme résolue !';
        feedback.innerHTML = successMessage;
        feedback.className = 'success';
        
        // Débloquer le prochain point selon l'équipe
        const nextCheckpointId = getNextCheckpointForTeam();
        if (nextCheckpointId) {
            unlockCheckpoint(nextCheckpointId);
            
            // Message personnalisé selon le prochain checkpoint
            const nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
            const nextName = nextCheckpoint ? nextCheckpoint.name : 'prochain point';
            feedback.innerHTML = `🎉 Correct ! "${nextName}" est maintenant débloqué !`;
        } else {
            feedback.innerHTML = '🎉 Correct ! Vous avez terminé votre parcours !';
        }
        
        setTimeout(() => {
            document.getElementById('riddle-modal').style.display = 'none';
            
            // Zoomer sur le nouveau point débloqué
            if (nextCheckpointId) {
                const unlockedCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
                if (unlockedCheckpoint) {
                    console.log('🎯 Zoom vers le checkpoint débloqué:', unlockedCheckpoint.name);
                    centerMapOnCheckpoint(unlockedCheckpoint);
                    showNotification(`🎯 "${unlockedCheckpoint.name}" débloqué ! Suivez la carte.`);
                } else {
                    console.warn('⚠️ Checkpoint débloqué non trouvé:', nextCheckpointId);
                    showNotification('🎯 Prochain défi débloqué ! Navigation GPS activée.');
                }
            } else {
                showNotification('🏆 Parcours terminé ! Félicitations !');
            }
        }, 2000);
        
    } else {
        // Mauvaise réponse
        feedback.innerHTML = '❌ Réponse incorrecte. Essayez encore !';
        feedback.className = 'error';
        hintElement.style.display = 'block';
        answerInput.value = '';
        answerInput.focus();
    }
}

function unlockCheckpoint(checkpointId) {
    if (unlockedCheckpoints.includes(checkpointId)) return;
    
    unlockedCheckpoints.push(checkpointId);
    
    // Trouver le checkpoint dans la liste
    const markerData = checkpointMarkers.find(m => m.id === checkpointId);
    if (markerData && markerData.hidden) {
        const checkpoint = markerData.checkpoint;
        
        // RÉVÉLER le point sur la carte (il était caché)
        console.log(`🎭 Révélation du checkpoint ${checkpoint.name} sur la carte`);
        
        // Créer le cercle de proximité
        const circle = L.circle(checkpoint.coordinates, {
            color: '#3498db',
            fillColor: '#3498db',
            fillOpacity: 0.1,
            radius: GAME_CONFIG.proximityThreshold,
            weight: 2,
            opacity: 0.6
        }).addTo(map);
        
        // Créer le marqueur
        const markerIcon = L.divIcon({
            className: 'checkpoint-marker',
            html: checkpoint.emoji,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Créer le contenu du popup avec bouton GPS
        let popupContent = `
            <div style="text-align: center;">
                <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                <p>🔍 À découvrir</p>
                <p><em>${checkpoint.hint}</em></p>
                <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
        `;
        
        // Ajouter le bouton GPS
        if (userPosition) {
            popupContent += `
                <br>
                <button onclick="calculateRouteFromPopup(${checkpoint.id})" 
                        style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); 
                               color: white; border: none; padding: 0.5rem 1rem; 
                               border-radius: 20px; font-size: 0.9rem; cursor: pointer; 
                               margin-top: 0.5rem;">
                    🧭 Calculer l'itinéraire GPS
                </button>
            `;
        }
        
        popupContent += '</div>';
        
        const marker = L.marker(checkpoint.coordinates, { icon: markerIcon })
            .addTo(map)
            .bindPopup(popupContent);
        
        // Mettre à jour les données du marqueur
        markerData.marker = marker;
        markerData.circle = circle;
        markerData.hidden = false;
        
        // Centrer la carte sur le nouveau point débloqué
        centerMapOnCheckpoint(checkpoint);
    }
    
    // Sauvegarder la progression dans Firebase (équipe seulement)
    if (firebaseService && currentTeam && currentTeamId) {
        // Plus besoin d'utilisateurs - équipe directement
        
        // Mettre à jour l'équipe aussi pour que l'admin voit les changements
        firebaseService.updateTeamProgress(currentTeamId, {
            foundCheckpoints: foundCheckpoints,
            unlockedCheckpoints: unlockedCheckpoints
        });
        
        console.log('💾 Progression sauvegardée (utilisateur + équipe):', {
            teamId: currentTeamId,
            teamId: currentTeamId,
            foundCheckpoints, 
            unlockedCheckpoints
        });
    }
    
    updateHint();
    console.log(`🔓 Checkpoint ${checkpointId} débloqué et révélé !`);
    
    // Forcer une notification pour vérifier la synchronisation
    setTimeout(() => {
        console.log('🔍 Vérification synchronisation après débloquage:', {
            checkpointId,
            foundCheckpoints,
            unlockedCheckpoints,
            currentTeam: currentTeam?.name,
            currentTeamId
        });
    }, 1000);
}

function centerMapOnCheckpoint(checkpoint) {
    console.log(`🎯 Centrage de la carte sur ${checkpoint.name}`);
    
    // Animation fluide vers le nouveau point
    map.flyTo(checkpoint.coordinates, GAME_CONFIG.zoom, {
        animate: true,
        duration: 2 // 2 secondes d'animation
    });
    
    // Ouvrir le popup automatiquement après l'animation pour montrer le bouton GPS
    setTimeout(() => {
        const markerData = checkpointMarkers.find(m => m.id === checkpoint.id);
        if (markerData) {
            markerData.marker.openPopup();
        }
    }, 2500); // Ouvrir le popup après l'animation
}

async function calculateRoute(from, toCheckpoint) {
    console.log(`🗺️ Calcul de l'itinéraire vers ${toCheckpoint.name}`);
    
    // Stocker la destination pour le recalcul automatique
    currentDestination = toCheckpoint;
    
    // Afficher une notification de chargement
    showNotification('⏳ Calcul de l\'itinéraire en cours...');
    
    try {
        // Supprimer l'ancienne route
        if (currentRoute) {
            map.removeLayer(currentRoute);
            currentRoute = null;
        }
        
        // Coordonnées au format [longitude, latitude] pour ORS
        const start = [from.lng, from.lat];
        const end = [toCheckpoint.coordinates[1], toCheckpoint.coordinates[0]];
        
        console.log('📍 Coordonnées:', { start, end });
        
        // Appel à l'API OpenRouteService
        const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Authorization': GAME_CONFIG.orsApiKey,
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                coordinates: [start, end],
                format: 'geojson',
                instructions: true,
                language: 'fr'
            })
        });
        
        console.log('📡 Réponse ORS:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erreur ORS:', errorText);
            throw new Error(`Erreur ORS: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📊 Données reçues:', data);
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            console.log('🛣️ Route data:', route);
            
            // Vérifier si on a une géométrie valide
            if (route.geometry) {
                let routeGeoJSON;
                
                // Si c'est une chaîne encodée (polyline), on la décode
                if (typeof route.geometry === 'string') {
                    console.log('🔄 Décodage de la polyline:', route.geometry);
                    const coordinates = decodePolyline(route.geometry);
                    console.log('📍 Coordonnées décodées:', coordinates);
                    routeGeoJSON = {
                        type: "Feature",
                        geometry: {
                            type: "LineString",
                            coordinates: coordinates
                        },
                        properties: route
                    };
                } else if (route.geometry.coordinates) {
                    // Si c'est déjà un GeoJSON
                    routeGeoJSON = {
                        type: "Feature",
                        geometry: {
                            type: "LineString",
                            coordinates: route.geometry.coordinates
                        },
                        properties: route
                    };
                }
                
                console.log('📍 GeoJSON créé:', routeGeoJSON);
                
                // Vérifier que le GeoJSON a été créé correctement
                if (routeGeoJSON && routeGeoJSON.geometry && routeGeoJSON.geometry.coordinates && routeGeoJSON.geometry.coordinates.length > 0) {
                    // Afficher la route sur la carte
                    currentRoute = L.geoJSON(routeGeoJSON, {
                    style: {
                        color: getTeamColor(),
                        weight: 5,
                        opacity: 0.8,
                        dashArray: '10, 5'
                    }
                }).addTo(map);
                
                // Extraire les instructions si disponibles
                if (route.segments && route.segments[0] && route.segments[0].steps) {
                    const instructions = route.segments[0].steps;
                    displayNavigationInstructions(instructions, route.summary);
                } else {
                    // Instructions basiques si pas de segments détaillés
                    displayBasicNavigation(route.summary);
                }
                
                    console.log('✅ Itinéraire calculé et affiché');
                    showNotification('🧭 Itinéraire GPS calculé !');
                } else {
                    console.error('❌ Impossible de créer le GeoJSON:', routeGeoJSON);
                    showNotification('Erreur: Format de route invalide', 'error');
                }
            } else {
                console.error('❌ Pas de géométrie dans la route:', route);
                showNotification('Erreur: Pas de géométrie de route', 'error');
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur lors du calcul de l\'itinéraire:', error);
        showNotification('Impossible de calculer l\'itinéraire GPS', 'error');
    }
}

function displayNavigationInstructions(steps, summary) {
    const hintText = document.getElementById('hint-text');
    
    // Informations générales
    const distance = (summary.distance / 1000).toFixed(2);
    const duration = Math.round(summary.duration / 60);
    
    // Première instruction
    const firstStep = steps[1] || steps[0]; // Ignorer "Départ"
    const instruction = firstStep ? firstStep.instruction : 'Suivez l\'itinéraire sur la carte';
    
    hintText.innerHTML = `
        <div style="background: #e8f5e8; padding: 1rem; border-radius: 10px; border-left: 4px solid ${getTeamColor()};">
            <h4 style="margin: 0 0 0.5rem 0; color: ${getTeamColor()};">🧭 Navigation GPS</h4>
            <p style="margin: 0 0 0.5rem 0; font-weight: bold;">${instruction}</p>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #666;">
                <span>📍 ${distance} km</span>
                <span>🚶 ${duration} min</span>
            </div>
        </div>
    `;
}

function displayBasicNavigation(summary) {
    const hintText = document.getElementById('hint-text');
    
    // Informations générales
    const distance = (summary.distance / 1000).toFixed(2);
    const duration = Math.round(summary.duration / 60);
    
    hintText.innerHTML = `
        <div style="background: #e8f5e8; padding: 1rem; border-radius: 10px; border-left: 4px solid ${getTeamColor()};">
            <h4 style="margin: 0 0 0.5rem 0; color: ${getTeamColor()};">🧭 Navigation GPS</h4>
            <p style="margin: 0 0 0.5rem 0; font-weight: bold;">Suivez l'itinéraire tracé sur la carte</p>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #666;">
                <span>📍 ${distance} km</span>
                <span>🚶 ${duration} min</span>
            </div>
        </div>
    `;
}

function showSuccessModal() {
    const modal = document.getElementById('success-modal');
    const messageEl = document.getElementById('success-message');
    const teamInfoEl = document.getElementById('success-team-info');
    
    // Personnaliser le message selon l'équipe
    if (currentTeam && currentTeam.name) {
        messageEl.textContent = `L'équipe "${currentTeam.name}" a terminé son parcours !`;
        teamInfoEl.textContent = `Félicitations équipe ${currentTeam.name} ! Vous avez relevé tous les défis de votre parcours. Tous les points restent accessibles pour continuer l'exploration.`;
    } else {
        messageEl.textContent = 'Vous avez terminé le jeu de piste !';
        teamInfoEl.textContent = 'Bravo pour cette belle aventure ! Vous pouvez continuer à explorer.';
    }
    
    modal.style.display = 'block';
    console.log(`🏆 Modal de succès affiché pour l'équipe ${currentTeam?.name}`);
    console.log('📋 Contenu du modal:', {
        message: messageEl.textContent,
        teamInfo: teamInfoEl.textContent
    });
}

function updateUI() {
    updateProgress();
    updatePlayerRouteProgress();
    updateHint();
    // updateHelpUI(); // Plus nécessaire - boutons intégrés dans le parcours
}

function updatePlayerRouteProgress() {
    const routeListElement = document.getElementById('player-route-list');
    
    if (!currentTeam || !currentTeam.route) {
        routeListElement.innerHTML = '<p style="color: #e74c3c;">❌ Aucun parcours défini</p>';
        return;
    }
    
    // Vérifier que les checkpoints sont chargés
    if (!GAME_CONFIG.checkpoints || GAME_CONFIG.checkpoints.length === 0) {
        console.warn('⚠️ updatePlayerRouteProgress appelé avant le chargement des checkpoints');
        routeListElement.innerHTML = '<p style="color: #f39c12;">🔄 Chargement des points...</p>';
        return;
    }
    
    const teamRoute = currentTeam.route;
    let progressHTML = '';
    
    teamRoute.forEach((checkpointId, index) => {
        // Utiliser les données de l'équipe directement pour éviter les désynchronisations
        const teamFoundCheckpoints = currentTeam.foundCheckpoints || [];
        const teamUnlockedCheckpoints = currentTeam.unlockedCheckpoints || [0];
        
        const isFound = teamFoundCheckpoints.includes(checkpointId);
        const isUnlocked = teamUnlockedCheckpoints.includes(checkpointId);
        
        // Debug pour voir l'état de chaque checkpoint
        console.log(`🔍 Checkpoint ${checkpointId} état:`, {
            isFound,
            isUnlocked,
            teamFoundCheckpoints,
            teamUnlockedCheckpoints
        });
        
        // Trouver les infos du checkpoint
        const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `Point ${checkpointId}`;
        
        // Debug pour voir si le checkpoint est trouvé
        if (!checkpoint) {
            console.warn(`⚠️ Checkpoint ${checkpointId} non trouvé dans GAME_CONFIG.checkpoints:`, 
                GAME_CONFIG.checkpoints.map(cp => cp.id));
        }
        
        // Déterminer le statut et la couleur
        let statusIcon, statusText, statusColor, clickable = false;
        
        if (isFound) {
            statusIcon = '✅';
            statusText = 'trouvé';
            statusColor = '#27ae60';
        } else if (isUnlocked) {
            // Vérifier si c'est un checkpoint photo en attente de validation
            if (checkpoint?.type === 'photo') {
                // TODO: Vérifier s'il y a une validation en attente pour ce checkpoint
                statusIcon = '📸';
                statusText = 'en attente validation';
                statusColor = '#e67e22';
                clickable = true; // Peut cliquer pour zoomer
            } else {
            statusIcon = '🎯';
            statusText = 'accessible';
            statusColor = '#f39c12';
            clickable = true; // Peut cliquer pour zoomer
            }
        } else {
            statusIcon = '🔒';
            statusText = 'verrouillé';
            statusColor = '#95a5a6';
        }
        
        const clickHandler = clickable && userPosition ? `onclick="zoomToCheckpoint(${checkpointId})"` : '';
        const cursorStyle = clickable && userPosition ? 'cursor: pointer;' : '';
        
        // Déterminer les boutons d'aide selon le statut
        let helpButtons = '';
        if (!isFound && !isUnlocked) {
            // Checkpoint verrouillé → bouton demander localisation
            helpButtons = `<button class="help-btn-small help-location" onclick="requestLocationHelpFor(${checkpointId})" title="Demander la localisation">📍</button>`;
        } else if (isUnlocked && !isFound) {
            // Checkpoint débloqué mais pas trouvé → vérifier le type et s'il a une énigme
            console.log(`🔍 Debug checkpoint ${checkpointId}:`, {
                checkpoint,
                type: checkpoint?.type,
                hasClue: !!checkpoint?.clue,
                hasRiddle: !!checkpoint?.clue?.riddle,
                riddleData: checkpoint?.clue?.riddle
            });
            
            if (checkpoint?.type === 'final') {
                // Point d'arrivée → toujours bouton localisation (pas d'épreuve)
                helpButtons = `<button class="help-btn-small help-location" onclick="requestLocationHelpFor(${checkpointId})" title="Demander l'aide pour trouver le point d'arrivée">🏁</button>`;
            } else if (checkpoint?.type === 'photo') {
                // Checkpoint photo accessible → boutons reprendre + validation forcée
                helpButtons = `
                    <button class="help-btn-small photo-location" onclick="showPhotoChallenge(GAME_CONFIG.checkpoints.find(cp => cp.id === ${checkpointId}))" title="Reprendre une photo">📸</button>
                    <button class="help-btn-small help-resolution" onclick="requestPhotoHelpFor(${checkpointId})" title="Forcer la validation photo">🆘</button>
                `;
            } else if (checkpoint?.type === 'audio') {
                // Épreuve audio → bouton aide résolution
                helpButtons = `<button class="help-btn-small help-resolution" onclick="requestAudioHelpFor(${checkpointId})" title="Demander l'aide pour l'épreuve audio">🆘</button>`;
            } else if (checkpoint?.type === 'qcm') {
                // Épreuve QCM → bouton aide résolution
                helpButtons = `<button class="help-btn-small help-resolution" onclick="requestQCMHelpFor(${checkpointId})" title="Demander l'aide pour le QCM">🆘</button>`;
            } else if (checkpoint?.clue?.riddle) {
                // Avec énigme → bouton aide résolution
                helpButtons = `<button class="help-btn-small help-resolution" onclick="requestRiddleHelpFor(${checkpointId})" title="Demander l'aide pour l'énigme">🆘</button>`;
            } else {
                // Sans énigme → bouton aide localisation
                helpButtons = `<button class="help-btn-small help-location" onclick="requestLocationHelpFor(${checkpointId})" title="Demander de l'aide pour trouver ce point">📍</button>`;
            }
        }
        
        progressHTML += `
            <div class="player-checkpoint-item" 
                 style="color: ${statusColor}; ${cursorStyle}" 
                 ${clickHandler}>
                <div class="checkpoint-info">
                ${statusIcon} ${index + 1}. ${checkpointName} 
                <small>(${statusText})</small>
                ${clickable && userPosition ? ' 🧭' : ''}
                </div>
                <div class="checkpoint-actions">
                    ${helpButtons}
                </div>
            </div>
        `;
    });
    
    routeListElement.innerHTML = progressHTML;
}

// Fonction pour zoomer sur un checkpoint spécifique
function zoomToCheckpoint(checkpointId) {
    const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
    if (checkpoint && userPosition) {
        // Fermer tous les popups ouverts
        map.closePopup();
        
        // Centrer la carte sur le checkpoint
        map.flyTo(checkpoint.coordinates, GAME_CONFIG.zoom, {
            animate: true,
            duration: 1.5
        });
        
        // Ouvrir le popup du checkpoint après l'animation
        setTimeout(() => {
            const markerData = checkpointMarkers.find(m => m.id === checkpointId);
            if (markerData && markerData.marker) {
                markerData.marker.openPopup();
            }
        }, 2000);
        
        showNotification(`🎯 Zoom vers ${checkpoint.name}`, 'info');
    }
}

// Exposer la fonction globalement
window.zoomToCheckpoint = zoomToCheckpoint;

function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (!currentTeam) {
        progressFill.style.width = '0%';
        progressText.textContent = '0 / 0 défis résolus';
        return;
    }
    
    // 🎯 UTILISER LA MÊME LOGIQUE QUE L'ADMIN (getTeamProgress)
    const nonLobbyFound = currentTeam.foundCheckpoints.filter(id => {
        const cp = GAME_CONFIG.checkpoints.find(c => c.id === id);
        return cp && !cp.isLobby;
    });
    
    const nonLobbyTotal = currentTeam.route.filter(id => {
        const cp = GAME_CONFIG.checkpoints.find(c => c.id === id);
        return cp && !cp.isLobby;
    }).length;
    
    const percentage = nonLobbyTotal === 0 ? 0 : Math.round((nonLobbyFound.length / nonLobbyTotal) * 100);
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${nonLobbyFound.length} / ${nonLobbyTotal} défis résolus`;
    
    console.log('📊 Progression mise à jour (logique admin):', {
        foundCheckpoints: currentTeam.foundCheckpoints,
        nonLobbyFound: nonLobbyFound,
        nonLobbyTotal: nonLobbyTotal,
        percentage: percentage
    });
}

function updateHint() {
    const hintText = document.getElementById('hint-text');
    const gpsBtn = document.getElementById('gps-route-btn');
    
    if (!userPosition) {
        hintText.textContent = 'Trouvez votre position pour commencer l\'aventure !';
        gpsBtn.style.display = 'none';
        return;
    }
    
    // Vérifier si l'équipe a terminé SON parcours (pas tous les checkpoints du jeu)
    const teamRoute = currentTeam?.route || [];
    const nonLobbyRoute = teamRoute.filter(id => id !== 0); // Exclure le lobby
    const nonLobbyFound = foundCheckpoints.filter(id => id !== 0); // Exclure le lobby
    const isTeamGameComplete = nonLobbyRoute.length > 0 && nonLobbyFound.length >= nonLobbyRoute.length;
    
    if (isTeamGameComplete) {
        hintText.textContent = `🎉 Félicitations ! Équipe ${currentTeam?.name || 'votre équipe'} a terminé son parcours !`;
        gpsBtn.style.display = 'none';
        console.log('🏆 Affichage message fin de jeu:', {
            équipe: currentTeam?.name,
            route: nonLobbyRoute,
            trouvés: nonLobbyFound,
            message: 'Parcours équipe terminé'
        });
        return;
    }
    
    // Trouver le prochain checkpoint dans la route de l'équipe (débloqué mais pas trouvé)
    // Réutiliser la variable teamRoute déjà déclarée
    let nextCheckpoint = null;
    
    for (const checkpointId of teamRoute) {
        if (checkpointId === 0) continue; // Ignorer le lobby
        
        const isFound = foundCheckpoints.includes(checkpointId);
        const isUnlocked = unlockedCheckpoints.includes(checkpointId);
        
        if (isUnlocked && !isFound) {
            nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
            break;
        }
    }
    
    console.log('🎯 Prochain checkpoint pour hint:', {
        teamRoute,
        foundCheckpoints,
        unlockedCheckpoints,
        nextCheckpoint: nextCheckpoint?.name || 'Aucun'
    });
    
    if (nextCheckpoint) {
        const distance = calculateDistance(
            userPosition.lat,
            userPosition.lng,
            nextCheckpoint.coordinates[0],
            nextCheckpoint.coordinates[1]
        );
        
        hintText.innerHTML = `
            <strong>${nextCheckpoint.hint}</strong><br>
            <small>Distance approximative: ${distance > 1000 ? 
                (distance/1000).toFixed(1) + ' km' : 
                Math.round(distance) + ' m'}</small><br>
            <small style="color: #666;">💡 Cliquez sur le marqueur ${nextCheckpoint.emoji} pour obtenir l'itinéraire GPS</small>
        `;
        
    } else {
        // Tous les checkpoints débloqués sont trouvés, mais il y en a peut-être des verrouillés
        const lockedCheckpoint = GAME_CONFIG.checkpoints.find(cp => 
            cp.locked && !unlockedCheckpoints.includes(cp.id)
        );
        
        if (lockedCheckpoint) {
            hintText.innerHTML = `<strong>${lockedCheckpoint.hint}</strong>`;
        }
    }
    
    // Cacher le bouton GPS du panneau principal
    gpsBtn.style.display = 'none';
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}


function setupEventListeners() {
    // Fermer les modales
    document.querySelector('#clue-modal .close').addEventListener('click', () => {
        document.getElementById('clue-modal').style.display = 'none';
    });
    
    document.getElementById('clue-close-btn').addEventListener('click', () => {
        document.getElementById('clue-modal').style.display = 'none';
    });
    
    // Événements pour le modal photo
    document.querySelector('#photo-modal .close').addEventListener('click', () => {
        document.getElementById('photo-modal').style.display = 'none';
        resetPhotoInterface();
    });
    
    document.getElementById('start-camera-btn').addEventListener('click', startCamera);
    document.getElementById('take-photo-btn').addEventListener('click', takePhoto);
    document.getElementById('retake-photo-btn').addEventListener('click', retakePhoto);
    document.getElementById('submit-photo-btn').addEventListener('click', submitPhoto);
    
    // Événements pour le modal audio
    document.querySelector('#audio-modal .close').addEventListener('click', () => {
        document.getElementById('audio-modal').style.display = 'none';
        resetAudioInterface();
    });
    
    document.getElementById('start-audio-btn').addEventListener('click', startAudioChallenge);
    document.getElementById('stop-audio-btn').addEventListener('click', stopAudioChallenge);
    
    // Événements pour le modal QCM
    document.querySelector('#qcm-modal .close').addEventListener('click', () => {
        document.getElementById('qcm-modal').style.display = 'none';
    });
    
    document.getElementById('qcm-submit-btn').addEventListener('click', submitQCMAnswer);
    
    document.getElementById('close-success-btn').addEventListener('click', () => {
        document.getElementById('success-modal').style.display = 'none';
        console.log('🎮 Modal de succès fermé - exploration continue');
    });
    
    // Bouton de déconnexion sécurisé
    document.getElementById('disconnect-btn').addEventListener('click', () => {
        const confirmDisconnect = confirm(
            '🚪 Êtes-vous sûr de vouloir vous déconnecter ?\n\n' +
            '✅ Votre progression sera sauvegardée\n' +
            '⚠️ Vous devrez vous reconnecter pour continuer'
        );
        
        if (confirmDisconnect) {
            disconnectTeam();
        }
    });
    
    
    // Événements pour la modal d'énigme
    document.getElementById('riddle-submit').addEventListener('click', () => {
        checkRiddleAnswer();
    });
    
    document.getElementById('riddle-answer').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            checkRiddleAnswer();
        }
    });
    
    // Anciens boutons d'aide supprimés - maintenant intégrés dans le parcours
    
    // Fermer les modales en cliquant à l'extérieur
    window.addEventListener('click', (event) => {
        const clueModal = document.getElementById('clue-modal');
        const riddleModal = document.getElementById('riddle-modal');
        const successModal = document.getElementById('success-modal');
        
        if (event.target === clueModal) {
            clueModal.style.display = 'none';
        }
        if (event.target === riddleModal) {
            riddleModal.style.display = 'none';
        }
        if (event.target === successModal) {
            successModal.style.display = 'none';
        }
    });
}

// FONCTION OBSOLÈTE - Plus utilisée depuis la modification du système de victoire
// Les équipes gardent maintenant tous leurs points après la victoire
function restartGame() {
    console.log(`🔄 Restart demandé pour l'équipe ${currentTeam?.name} - FONCTION OBSOLÈTE`);
    
    // Reset local
    foundCheckpoints = [];
    unlockedCheckpoints = [0]; // Remettre au lobby
    document.getElementById('success-modal').style.display = 'none';
    
    // Sauvegarder le reset dans Firebase
    if (firebaseService && currentTeam && currentTeamId) {
        firebaseService.updateTeamProgress(currentTeamId, {
            foundCheckpoints: foundCheckpoints,
            unlockedCheckpoints: unlockedCheckpoints
        });
        console.log('💾 Reset sauvegardé dans Firebase');
    }
    
    // Remettre à jour tous les marqueurs et cercles
    checkpointMarkers.forEach(markerData => {
        const checkpoint = markerData.checkpoint;
        const isUnlocked = unlockedCheckpoints.includes(checkpoint.id);
        const isLocked = checkpoint.locked && !isUnlocked;
        
        let markerClass = 'checkpoint-marker';
        if (isLocked) markerClass += ' locked';
        
        const newIcon = L.divIcon({
            className: markerClass,
            html: isLocked ? '🔒' : checkpoint.emoji,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        markerData.marker.setIcon(newIcon);
        markerData.marker.setPopupContent(`
            <div style="text-align: center;">
                <h3>${isLocked ? '🔒' : checkpoint.emoji} ${checkpoint.name}</h3>
                <p>${isLocked ? '🔒 Verrouillé' : '🔍 À découvrir'}</p>
                <p><em>${checkpoint.hint}</em></p>
                <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
            </div>
        `);
        
        // Remettre à jour le cercle
        markerData.circle.setStyle({
            color: isLocked ? '#95a5a6' : '#3498db',
            fillColor: isLocked ? '#95a5a6' : '#3498db'
        });
    });
    
    updateUI();
    showNotification('Jeu redémarré ! Bonne chance !');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Fonction utilitaire pour calculer la distance entre deux points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance en mètres
}

// Debug: Fonction pour simuler une position (utile pour les tests)
function simulatePosition(lat, lng) {
    console.log(`🧪 Simulation de position: ${lat}, ${lng}`);
    
    userPosition = { lat, lng, accuracy: 10 };
    updateUserMarker();
    checkProximityToCheckpoints();
    updateHint();
    updateStatus('Position simulée');
}

// ===== MENU DEBUG UNIFIÉ =====
function showUnifiedDebugMenu() {
    const existingPanel = document.getElementById('unified-debug-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'unified-debug-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #5D2DE6;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        width: 90vw;
        max-width: 450px;
        text-align: center;
        max-height: 80vh;
        overflow-y: auto;
    `;

    panel.innerHTML = `
        <h3 style="margin-bottom: 15px; color: #333;">🛠️ Menu Debug</h3>
        
        <!-- Section Position -->
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left;">
            <h4 style="margin-bottom: 10px; color: #5D2DE6;">📍 Gestion Position</h4>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; font-size: 12px;">Latitude:</label>
                <input type="number" id="debug-lat" step="0.000001" placeholder="49.0956" 
                       style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; font-size: 12px;">Longitude:</label>
                <input type="number" id="debug-lng" step="0.000001" placeholder="6.1893" 
                       style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            </div>
            
            <div style="text-align: center; margin-bottom: 10px;">
                <button onclick="setDebugPosition()" 
                        style="background: #5D2DE6; color: white; border: none; padding: 8px 15px; border-radius: 4px; margin: 2px; font-size: 12px;">
                    📍 Définir Position
                </button>
                <button onclick="getCurrentDebugPosition()" 
                        style="background: #568AC2; color: white; border: none; padding: 8px 15px; border-radius: 4px; margin: 2px; font-size: 12px;">
                    📱 Position Actuelle
                </button>
            </div>
            
            <div style="text-align: center;">
                <strong style="font-size: 12px; margin-bottom: 8px; display: block;">🎯 Positions Rapides</strong>
                <div id="debug-quick-positions">
                    <!-- Les positions seront générées dynamiquement -->
                </div>
            </div>
        </div>
        
        <!-- Section Outils Debug -->
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="margin-bottom: 10px; color: #5D2DE6;">🔧 Outils Debug</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
                <button onclick="window.showMetrics()" 
                        style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
                    📊 Métriques
                </button>
                <button onclick="window.healthCheck()" 
                        style="background: #27ae60; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
                    🏥 Santé
                </button>
                <button onclick="showGameState()" 
                        style="background: #f39c12; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
                    🎮 État Jeu
                </button>
                <button onclick="toggleDebugMode()" 
                        style="background: #9b59b6; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
                    🔍 Debug Mode
                </button>
            </div>
        </div>
        
        <button onclick="closeUnifiedDebugMenu()" 
                style="background: #e74c3c; color: white; border: none; padding: 10px 20px; border-radius: 4px;">
            ❌ Fermer
        </button>
    `;

    document.body.appendChild(panel);
    
    // Générer les positions rapides dynamiquement
    generateQuickPositions();
}

function generateQuickPositions() {
    const container = document.getElementById('debug-quick-positions');
    if (!container) return;
    
    let buttonsHTML = '';
    
    // Positions fixes par défaut
    const defaultPositions = [
        { name: '🏠 Luxembourg', lat: 49.095684, lng: 6.189308, color: '#008000' },
        { name: '🗼 Paris', lat: 48.8566, lng: 2.3522, color: '#008000' },
        { name: '🇧🇪 Bruxelles', lat: 50.8503, lng: 4.3517, color: '#008000' }
    ];
    
    // Ajouter les positions des checkpoints du jeu en cours
    if (GAME_CONFIG && GAME_CONFIG.checkpoints && GAME_CONFIG.checkpoints.length > 0) {
        buttonsHTML += '<div style="margin-bottom: 8px;"><strong style="font-size: 11px; color: #5D2DE6;">📍 Checkpoints du Jeu:</strong></div>';
        
        GAME_CONFIG.checkpoints.forEach((checkpoint, index) => {
            // Les coordonnées sont dans checkpoint.coordinates [lat, lng]
            if (checkpoint.coordinates && checkpoint.coordinates.length >= 2) {
                const lat = checkpoint.coordinates[0];
                const lng = checkpoint.coordinates[1];
                const isFound = foundCheckpoints.includes(checkpoint.id);
                const isUnlocked = unlockedCheckpoints.includes(checkpoint.id);
                
                let icon = checkpoint.emoji || '📍';
                let color = '#568AC2';
                let status = '';
                
                // Icônes selon le type si pas d'emoji
                if (!checkpoint.emoji) {
                    switch(checkpoint.type) {
                        case 'lobby': icon = '🏠'; break;
                        case 'enigma': icon = '🧩'; break;
                        case 'photo': icon = '📸'; break;
                        case 'audio': icon = '🎤'; break;
                        case 'qcm': icon = '📋'; break;
                        case 'info': icon = 'ℹ️'; break;
                        case 'final': icon = '🏆'; break;
                    }
                }
                
                // Couleur selon le statut
                if (isFound) {
                    color = '#27ae60';
                    status = ' ✅';
                } else if (isUnlocked) {
                    color = '#f39c12';
                    status = ' 🔓';
                } else {
                    color = '#95a5a6';
                    status = ' 🔒';
                }
                
                const shortName = checkpoint.name && checkpoint.name.length > 12 ? 
                    checkpoint.name.substring(0, 12) + '...' : 
                    (checkpoint.name || `Point ${index + 1}`);
                
                buttonsHTML += `
                    <button onclick="simulatePosition(${lat}, ${lng})" 
                            style="background: ${color}; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin: 1px; font-size: 10px; max-width: 120px; overflow: hidden;">
                        ${icon} ${shortName}${status}
                    </button>
                `;
            }
        });
        
        buttonsHTML += '<div style="margin: 8px 0;"><strong style="font-size: 11px; color: #008000;">🌍 Positions Fixes:</strong></div>';
    } else {
        // Pas de checkpoints chargés
        buttonsHTML += '<div style="margin-bottom: 8px; color: #f39c12; font-size: 11px;">⏳ Checkpoints en cours de chargement...</div>';
        buttonsHTML += '<div style="margin: 8px 0;"><strong style="font-size: 11px; color: #008000;">🌍 Positions Fixes:</strong></div>';
    }
    
    // Ajouter les positions fixes
    defaultPositions.forEach(pos => {
        buttonsHTML += `
            <button onclick="simulatePosition(${pos.lat}, ${pos.lng})" 
                    style="background: ${pos.color}; color: white; border: none; padding: 6px 10px; border-radius: 4px; margin: 2px; font-size: 11px;">
                ${pos.name}
            </button>
        `;
    });
    
    container.innerHTML = buttonsHTML;
}

function setDebugPosition() {
    const lat = parseFloat(document.getElementById('debug-lat').value);
    const lng = parseFloat(document.getElementById('debug-lng').value);
    
    if (isNaN(lat) || isNaN(lng)) {
        alert('⚠️ Coordonnées invalides !');
        return;
    }
    
    simulatePosition(lat, lng);
    showNotification(`📍 Position définie: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
}

function getCurrentDebugPosition() {
    if (userPosition) {
        document.getElementById('debug-lat').value = userPosition.lat.toFixed(6);
        document.getElementById('debug-lng').value = userPosition.lng.toFixed(6);
        showNotification('📱 Position actuelle chargée', 'info');
    } else {
        showNotification('❌ Aucune position disponible', 'error');
    }
}

function closeUnifiedDebugMenu() {
    const panel = document.getElementById('unified-debug-panel');
    if (panel) {
        panel.remove();
    }
}

function showGameState() {
    const state = {
        currentTeam: currentTeam?.name || 'Aucune',
        foundCheckpoints: foundCheckpoints.length,
        unlockedCheckpoints: unlockedCheckpoints.length,
        userPosition: userPosition ? `${userPosition.lat.toFixed(6)}, ${userPosition.lng.toFixed(6)}` : 'Aucune',
        gameStarted: gameStarted,
        totalCheckpoints: GAME_CONFIG.checkpoints?.length || 0
    };
    
    alert(`🎮 État du Jeu:\n\n` +
          `👥 Équipe: ${state.currentTeam}\n` +
          `✅ Trouvés: ${state.foundCheckpoints}/${state.totalCheckpoints}\n` +
          `🔓 Débloqués: ${state.unlockedCheckpoints}\n` +
          `📍 Position: ${state.userPosition}\n` +
          `🚀 Jeu démarré: ${state.gameStarted ? 'Oui' : 'Non'}`);
}

function toggleDebugMode() {
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel.style.display === 'none') {
        enableDebugMode();
        showNotification('🔧 Mode debug desktop activé !', 'success');
    } else {
        debugPanel.style.display = 'none';
        showNotification('🔧 Mode debug desktop désactivé', 'info');
    }
}

// Exposition globale pour les boutons et console
window.setDebugPosition = setDebugPosition;
window.getCurrentDebugPosition = getCurrentDebugPosition;
window.closeUnifiedDebugMenu = closeUnifiedDebugMenu;
window.showUnifiedDebugMenu = showUnifiedDebugMenu;
window.simulatePosition = simulatePosition;
window.showGameState = showGameState;
window.toggleDebugMode = toggleDebugMode;
window.generateQuickPositions = generateQuickPositions;

// Fonction appelée depuis le popup du marqueur
function calculateRouteFromPopup(checkpointId) {
    const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
    if (checkpoint && userPosition) {
        // Fermer tous les popups ouverts
        map.closePopup();
        
        calculateRoute(userPosition, checkpoint);
    }
}

// Exposer les fonctions pour les tests et les popups
window.simulatePosition = simulatePosition;
window.calculateRouteFromPopup = calculateRouteFromPopup;
window.requestLocationHelpFor = requestLocationHelpFor;
window.requestRiddleHelpFor = requestRiddleHelpFor;
window.requestAudioHelpFor = requestAudioHelpFor;
window.requestPhotoHelpFor = requestPhotoHelpFor;
window.requestQCMHelpFor = requestQCMHelpFor;
window.showPhotoChallenge = showPhotoChallenge;

// Fonction supprimée - les checkpoints sont maintenant créés via l'admin

// Démarrer la synchronisation temps réel avec l'équipe
function startTeamSync() {
    if (!firebaseService || !currentTeamId) {
        console.warn('⚠️ Impossible de démarrer la synchronisation équipe:', {firebaseService: !!firebaseService, currentTeamId});
        return;
    }
    
    console.log('🔄 Démarrage synchronisation temps réel équipe:', currentTeamId);
    
    firebaseService.onTeamChange(currentTeamId, (teamData) => {
        console.log('📡 Mise à jour reçue de l\'équipe:', teamData);
        
        if (!teamData) {
            console.warn('⚠️ Données d\'équipe vides reçues');
            return;
        }
        
        // Mettre à jour les données de l'équipe
        currentTeam = teamData;
        
        // Vérifier si les checkpoints débloqués ont changé (action admin)
        const newUnlockedCheckpoints = teamData.unlockedCheckpoints || [0];
        const currentUnlocked = unlockedCheckpoints || [0];
        
        const hasNewUnlocked = newUnlockedCheckpoints.some(id => !currentUnlocked.includes(id));
        
        if (hasNewUnlocked) {
            console.log('🔓 Nouveaux checkpoints débloqués par admin:', {
                avant: currentUnlocked,
                après: newUnlockedCheckpoints,
                nouveaux: newUnlockedCheckpoints.filter(id => !currentUnlocked.includes(id))
            });
            
            // Mettre à jour les checkpoints débloqués
            unlockedCheckpoints = [...newUnlockedCheckpoints];
            
            // Révéler les nouveaux checkpoints sur la carte
            const newlyUnlocked = newUnlockedCheckpoints.filter(id => !currentUnlocked.includes(id));
            newlyUnlocked.forEach(checkpointId => {
                if (checkpointId !== 0) { // Ignorer le lobby
                    revealCheckpointOnMap(checkpointId);
                }
            });
            
            // Mettre à jour l'interface
            updateUI();
            
            // Notification à l'utilisateur
            if (newlyUnlocked.length > 0) {
                const checkpointNames = newlyUnlocked.map(id => {
                    const cp = GAME_CONFIG.checkpoints.find(c => c.id === id);
                    return cp ? cp.name : `Point ${id}`;
                }).join(', ');
                
                showNotification(`🎯 Admin a débloqué : ${checkpointNames}`, 'success');
            }
        }
        
        // 1 ÉQUIPE = 1 JOUEUR : Synchroniser foundCheckpoints avec Firebase
        const firebaseFoundCheckpoints = teamData.foundCheckpoints || [];
        const localFoundCheckpoints = foundCheckpoints || [];
        
        // Vérifier s'il y a des différences (pas juste la longueur)
        const firebaseSet = new Set(firebaseFoundCheckpoints);
        const localSet = new Set(localFoundCheckpoints);
        const hasNewFromFirebase = firebaseFoundCheckpoints.some(id => !localSet.has(id));
        const hasDifferentLength = firebaseFoundCheckpoints.length !== localFoundCheckpoints.length;
        
        if (hasNewFromFirebase || hasDifferentLength) {
            console.log('🔄 Synchronisation foundCheckpoints depuis Firebase:', {
                local: localFoundCheckpoints,
                firebase: firebaseFoundCheckpoints,
                nouveaux: firebaseFoundCheckpoints.filter(id => !localSet.has(id)),
                longueurDifférente: hasDifferentLength
            });
            foundCheckpoints = [...firebaseFoundCheckpoints];
            
            // ⚡ MISE À JOUR IMMÉDIATE de l'affichage après synchronisation
            updatePlayerRouteProgress();
            updateProgress();
            updateUI(); // Force la mise à jour complète
            
            console.log('✅ Interface mise à jour après sync foundCheckpoints');
        } else {
            console.log('📱 foundCheckpoints locaux à jour:', {
                local: localFoundCheckpoints,
                firebase: firebaseFoundCheckpoints
            });
        }
        
        // Mettre à jour les infos d'équipe
        showTeamInfo();
        updateProgress();
        updatePlayerRouteProgress(); // S'assurer que l'affichage est toujours à jour
        
        // Plus besoin de vérifier les demandes d'aide - intégrées dans le parcours
    });
    
    // Écouter les notifications de refus d'aide/validation
    setupNotificationListeners();
}

// Révéler un checkpoint sur la carte (appelé quand l'admin débloque)
function revealCheckpointOnMap(checkpointId) {
    const markerData = checkpointMarkers.find(m => m.id === checkpointId);
    
    if (markerData && markerData.hidden) {
        const checkpoint = markerData.checkpoint;
        
        console.log(`🎭 Révélation du checkpoint ${checkpoint.name} (débloqué par admin)`);
        
        // Créer le cercle de proximité
        const circle = L.circle(checkpoint.coordinates, {
            color: '#f39c12', // Orange pour indiquer débloqué par admin
            fillColor: '#f39c12',
            fillOpacity: 0.1,
            radius: GAME_CONFIG.proximityThreshold,
            weight: 2,
            opacity: 0.6
        }).addTo(map);
        
        // Créer le marqueur
        const markerIcon = L.divIcon({
            className: 'checkpoint-marker admin-unlocked',
            html: checkpoint.emoji,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Créer le contenu du popup
        let popupContent = `
            <div style="text-align: center;">
                <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                <p>🔓 Débloqué par l'admin</p>
                <p><em>${checkpoint.hint}</em></p>
                <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
        `;
        
        // Ajouter le bouton GPS
        if (userPosition) {
            popupContent += `
                <br>
                <button onclick="calculateRouteFromPopup(${checkpoint.id})" 
                        style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); 
                               color: white; border: none; padding: 0.5rem 1rem; 
                               border-radius: 20px; font-size: 0.9rem; cursor: pointer; 
                               margin-top: 0.5rem;">
                    🧭 Calculer l'itinéraire GPS
                </button>
            `;
        }
        
        popupContent += '</div>';
        
        const marker = L.marker(checkpoint.coordinates, { icon: markerIcon })
            .addTo(map)
            .bindPopup(popupContent);
        
        // Ajouter un événement de clic pour les épreuves audio non réussies
        marker.on('click', function() {
            // Si c'est un checkpoint audio et qu'il n'est pas encore trouvé, permettre de relancer l'épreuve
            if (checkpoint.type === 'audio' && !foundCheckpoints.includes(checkpoint.id)) {
                showAudioChallenge(checkpoint);
            }
        });
        
        // Mettre à jour les données du marqueur
        markerData.marker = marker;
        markerData.circle = circle;
        markerData.hidden = false;
        
        // Animation de zoom vers le nouveau checkpoint
        setTimeout(() => {
            centerMapOnCheckpoint(checkpoint);
        }, 500);
    }
}

// Synchronisation temps réel des checkpoints
async function syncCheckpoints() {
    if (!firebaseService) {
        console.warn('⚠️ Firebase Service non disponible pour la synchronisation des checkpoints');
        return;
    }
    
    console.log('🔄 Synchronisation des checkpoints...');
    
    try {
        const checkpoints = await firebaseService.getCheckpoints();
        console.log('🔄 Checkpoints synchronisés:', checkpoints);
        
        if (!checkpoints || checkpoints.length === 0) {
            console.warn('⚠️ Aucun checkpoint trouvé dans Firebase');
            showNotification('⚠️ Aucun checkpoint configuré. Contactez l\'administrateur.', 'error');
            return;
        }
        
        // Vérifier qu'il y a au moins un lobby
        const hasLobby = checkpoints.some(cp => cp.isLobby || cp.type === 'lobby');
        if (!hasLobby) {
            console.warn('⚠️ Aucun lobby trouvé dans les checkpoints');
            showNotification('⚠️ Configuration incomplète. Contactez l\'administrateur.', 'error');
        }
        
        GAME_CONFIG.checkpoints = checkpoints;
        
        // Ajouter les checkpoints à la carte seulement si on a une carte initialisée
        if (isMapInitialized) {
            addCheckpointsToMap();
        }
        
        // Mettre à jour l'affichage du parcours maintenant que les checkpoints sont chargés
        updatePlayerRouteProgress();
        updateUI();
        
        // Rafraîchir le menu debug s'il est ouvert
        const debugPanel = document.getElementById('unified-debug-panel');
        if (debugPanel) {
            generateQuickPositions();
        }
    } catch (error) {
        console.error('❌ Erreur lors de la synchronisation des checkpoints:', error);
        showNotification('❌ Erreur de chargement des points. Rechargez la page.', 'error');
    }
}

// ===== SYSTÈME D'AIDE =====

// Variables pour le système d'aide
let currentHelpRequests = [];
let processedNotifications = new Set(); // Pour éviter les doublons

// ===== SYSTÈME DE PHOTOS =====

// Variables pour la gestion des photos
let currentPhotoCheckpoint = null;
let cameraStream = null;
let capturedPhotoBlob = null;

// Appeler la synchronisation après l'initialisation
// syncTeamData(); // Fonction supprimée - synchronisation gérée dans loadTeamGameData()

// Demander l'aide pour la localisation d'un checkpoint spécifique
async function requestLocationHelpFor(checkpointId) {
    if (!firebaseService || !currentTeamId) {
        showNotification('Erreur: service non disponible', 'error');
        return;
    }
    
    try {
        const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${checkpointId}`;
        const message = `L'équipe ${currentTeam?.name || 'inconnue'} demande la localisation de "${checkpointName}".`;
        
        await firebaseService.createHelpRequest(
            currentTeamId,
            checkpointId,
            'location',
            message
        );
        
        showNotification(`📍 Demande de localisation envoyée pour "${checkpointName}"`, 'success');
        
        // Actualiser l'interface
        updateUI();
        
    } catch (error) {
        console.error('❌ Erreur demande d\'aide localisation:', error);
        showNotification('Erreur lors de l\'envoi de la demande', 'error');
    }
}

// Demander l'aide pour forcer la validation d'une photo
async function requestPhotoHelpFor(checkpointId) {
    if (!firebaseService || !currentTeamId) {
        showNotification('Erreur: service non disponible', 'error');
        return;
    }
    
    try {
        const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${checkpointId}`;
        const message = `L'équipe ${currentTeam?.name || 'inconnue'} demande la validation forcée de la photo "${checkpointName}".`;
        
        await firebaseService.createHelpRequest(currentTeamId, checkpointId, 'photo', message);
        showNotification(`Demande d'aide envoyée pour la photo "${checkpointName}"`, 'success');
        console.log(`📸 Demande validation forcée envoyée pour: ${checkpointName}`);
        
    } catch (error) {
        console.error('❌ Erreur envoi demande aide photo:', error);
        showNotification('Erreur lors de l\'envoi de la demande', 'error');
    }
}

// Demander l'aide pour résoudre une énigme spécifique
async function requestRiddleHelpFor(checkpointId) {
    if (!firebaseService || !currentTeamId) {
        showNotification('Erreur: service non disponible', 'error');
        return;
    }
    
    try {
        const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${checkpointId}`;
        const message = `L'équipe ${currentTeam?.name || 'inconnue'} demande l'aide pour l'énigme "${checkpointName}".`;
        
        await firebaseService.createHelpRequest(
            currentTeamId,
            checkpointId,
            'riddle',
            message
        );
        
        showNotification(`🧩 Demande d'aide envoyée pour l'énigme "${checkpointName}"`, 'success');
        
        // Actualiser l'interface
        updateUI();
        
    } catch (error) {
        console.error('❌ Erreur demande d\'aide énigme:', error);
        showNotification('Erreur lors de l\'envoi de la demande', 'error');
    }
}

// Demander l'aide pour une épreuve audio spécifique
async function requestAudioHelpFor(checkpointId) {
    if (!firebaseService || !currentTeamId) {
        showNotification('Erreur: service non disponible', 'error');
        return;
    }
    
    try {
        const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${checkpointId}`;
        const message = `L'équipe ${currentTeam?.name || 'inconnue'} demande l'aide pour l'épreuve audio "${checkpointName}" (problème de microphone ou de bruit).`;
        
        await firebaseService.createHelpRequest(
            currentTeamId,
            checkpointId,
            'audio',
            message
        );
        
        showNotification(`🎤 Demande d'aide envoyée pour l'épreuve audio "${checkpointName}"`, 'success');
        
        // Actualiser l'interface
        updateUI();
        
    } catch (error) {
        console.error('❌ Erreur demande d\'aide audio:', error);
        showNotification('Erreur lors de l\'envoi de la demande', 'error');
    }
}

// Demander l'aide pour un QCM spécifique
async function requestQCMHelpFor(checkpointId) {
    if (!firebaseService || !currentTeamId) {
        showNotification('Erreur: service non disponible', 'error');
        return;
    }
    
    try {
        const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${checkpointId}`;
        const message = `L'équipe ${currentTeam?.name || 'inconnue'} demande l'aide pour le QCM "${checkpointName}" (question trop difficile).`;
        
        await firebaseService.createHelpRequest(
            currentTeamId,
            checkpointId,
            'qcm',
            message
        );
        
        showNotification(`📋 Demande d'aide envoyée pour le QCM "${checkpointName}"`, 'success');
        
        // Actualiser l'interface
        updateUI();
        
    } catch (error) {
        console.error('❌ Erreur demande d\'aide QCM:', error);
        showNotification('Erreur lors de l\'envoi de la demande', 'error');
    }
}

// ===== FONCTIONS PHOTOS =====

// Afficher le modal photo pour un checkpoint
function showPhotoChallenge(checkpoint) {
    if (!checkpoint || checkpoint.type !== 'photo') {
        console.error('❌ Checkpoint invalide pour défi photo:', checkpoint);
        return;
    }
    
    currentPhotoCheckpoint = checkpoint;
    
    // Afficher les instructions
    document.getElementById('photo-instructions').textContent = checkpoint.clue.text || 'Prenez une photo selon les instructions.';
    
    // Réinitialiser l'interface
    resetPhotoInterface();
    
    // Afficher le modal
    document.getElementById('photo-modal').style.display = 'flex';
    
    console.log('📸 Modal photo ouvert pour:', checkpoint.name);
}

// Convertir le seuil de volume en description compréhensible
function getVolumeHint(threshold) {
    if (threshold <= 30) {
        return `${threshold}/100 (~40-50 dB) - Chuchotement ou parler très doucement`;
    } else if (threshold <= 50) {
        return `${threshold}/100 (~50-60 dB) - Conversation calme`;
    } else if (threshold <= 70) {
        return `${threshold}/100 (~60-70 dB) - Conversation normale`;
    } else if (threshold <= 90) {
        return `${threshold}/100 (~70-80 dB) - Parler fort ou crier`;
    } else {
        return `${threshold}/100 (~80+ dB) - Crier très fort, applaudir, taper des mains`;
    }
}

// Afficher le défi audio
function showAudioChallenge(checkpoint) {
    if (!checkpoint || checkpoint.type !== 'audio') {
        console.error('❌ Checkpoint invalide pour défi audio:', checkpoint);
        return;
    }
    
    if (!checkpoint.clue.audioChallenge) {
        console.error('❌ Configuration audio manquante:', checkpoint);
        return;
    }
    
    currentAudioCheckpoint = checkpoint;
    const audioConfig = checkpoint.clue.audioChallenge;
    
    // Afficher les instructions
    document.getElementById('audio-instructions').textContent = audioConfig.instructions || 'Faites du bruit pour débloquer ce checkpoint !';
    
    // Ajouter une indication du niveau requis
    const thresholdHint = getVolumeHint(audioConfig.threshold);
    const instructionsElement = document.getElementById('audio-instructions');
    instructionsElement.innerHTML = `
        ${audioConfig.instructions || 'Faites du bruit pour débloquer ce checkpoint !'}
        <br><br>
        <small style="color: #666; font-style: italic;">
            💡 Niveau requis : ${thresholdHint} pendant ${audioConfig.duration} seconde${audioConfig.duration > 1 ? 's' : ''}
        </small>
    `;
    
    // Réinitialiser l'interface
    resetAudioInterface();
    
    // Afficher le modal
    document.getElementById('audio-modal').style.display = 'flex';
    
    console.log('🎤 Modal audio ouvert pour:', checkpoint.name, 'Config:', audioConfig);
}

// Afficher le défi QCM
function showQCMChallenge(checkpoint) {
    if (!checkpoint || checkpoint.type !== 'qcm') {
        console.error('❌ Checkpoint invalide pour défi QCM:', checkpoint);
        return;
    }
    
    if (!checkpoint.clue.qcm) {
        console.error('❌ Configuration QCM manquante:', checkpoint);
        return;
    }
    
    currentQCMCheckpoint = checkpoint;
    const qcmConfig = checkpoint.clue.qcm;
    
    // Afficher la question
    document.getElementById('qcm-question').textContent = qcmConfig.question;
    
    // Générer les réponses
    const answersContainer = document.getElementById('qcm-answers-container');
    answersContainer.innerHTML = '';
    selectedAnswers = [];
    
    qcmConfig.answers.forEach((answer, index) => {
        const answerDiv = document.createElement('div');
        answerDiv.className = 'qcm-answer-option';
        answerDiv.innerHTML = `
            <input type="checkbox" id="qcm-answer-${index}" value="${index}">
            <label for="qcm-answer-${index}">${answer}</label>
        `;
        
        // Ajouter l'événement de clic
        answerDiv.addEventListener('click', () => toggleQCMAnswer(index));
        
        answersContainer.appendChild(answerDiv);
    });
    
    // Réinitialiser le feedback
    const feedback = document.getElementById('qcm-feedback');
    feedback.style.display = 'none';
    feedback.className = 'qcm-feedback';
    
    // Réactiver le bouton
    document.getElementById('qcm-submit-btn').disabled = false;
    
    // Afficher le modal
    document.getElementById('qcm-modal').style.display = 'flex';
    
    console.log('📋 Modal QCM ouvert pour:', checkpoint.name, 'Config:', qcmConfig);
}

// Basculer la sélection d'une réponse QCM
function toggleQCMAnswer(answerIndex) {
    const checkbox = document.getElementById(`qcm-answer-${answerIndex}`);
    const answerDiv = checkbox.closest('.qcm-answer-option');
    
    if (selectedAnswers.includes(answerIndex)) {
        // Désélectionner
        selectedAnswers = selectedAnswers.filter(i => i !== answerIndex);
        checkbox.checked = false;
        answerDiv.classList.remove('selected');
    } else {
        // Sélectionner
        selectedAnswers.push(answerIndex);
        checkbox.checked = true;
        answerDiv.classList.add('selected');
    }
    
    console.log('📋 Réponses sélectionnées:', selectedAnswers);
}

// Valider les réponses du QCM
function submitQCMAnswer() {
    if (!currentQCMCheckpoint || !currentQCMCheckpoint.clue.qcm) {
        console.error('❌ Configuration QCM manquante');
        return;
    }
    
    const qcmConfig = currentQCMCheckpoint.clue.qcm;
    const correctAnswers = qcmConfig.correctAnswers;
    
    // Vérifier si les réponses sont correctes
    const isCorrect = selectedAnswers.length === correctAnswers.length &&
                     selectedAnswers.every(answer => correctAnswers.includes(answer)) &&
                     correctAnswers.every(answer => selectedAnswers.includes(answer));
    
    // Désactiver le bouton
    document.getElementById('qcm-submit-btn').disabled = true;
    
    // Afficher les résultats visuellement
    const answersContainer = document.getElementById('qcm-answers-container');
    const answerDivs = answersContainer.querySelectorAll('.qcm-answer-option');
    
    answerDivs.forEach((div, index) => {
        const isCorrectAnswer = correctAnswers.includes(index);
        const wasSelected = selectedAnswers.includes(index);
        
        if (isCorrectAnswer) {
            div.classList.add('correct');
        } else if (wasSelected) {
            div.classList.add('incorrect');
        }
        
        // Désactiver les clics
        div.style.pointerEvents = 'none';
    });
    
    // Afficher le feedback
    const feedback = document.getElementById('qcm-feedback');
    feedback.style.display = 'block';
    
    if (isCorrect) {
        feedback.className = 'qcm-feedback success';
        feedback.innerHTML = `
            <div>✅ ${qcmConfig.successMessage || 'Bravo ! Bonne réponse !'}</div>
            ${qcmConfig.explanation ? `<div class="qcm-explanation">💡 ${qcmConfig.explanation}</div>` : ''}
        `;
        
        console.log('🎉 QCM réussi !');
        
        // Débloquer le prochain checkpoint après un délai
        setTimeout(() => {
            document.getElementById('qcm-modal').style.display = 'none';
            
            // Débloquer le prochain point selon l'équipe
            const nextCheckpointId = getNextCheckpointForTeam();
            if (nextCheckpointId) {
                unlockCheckpoint(nextCheckpointId);
                
                // Message personnalisé selon le prochain checkpoint
                const nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
                const nextName = nextCheckpoint ? nextCheckpoint.name : 'prochain point';
                showNotification(`🎉 "${nextName}" est maintenant débloqué !`);
                
                // Zoomer sur le nouveau point débloqué
                if (nextCheckpoint) {
                    console.log('🎯 Zoom vers le checkpoint débloqué:', nextCheckpoint.name);
                    centerMapOnCheckpoint(nextCheckpoint);
                }
            } else {
                showNotification('🏆 Parcours terminé ! Félicitations !');
            }
            
        }, 3000);
        
    } else {
        feedback.className = 'qcm-feedback error';
        feedback.innerHTML = `
            <div>❌ Réponse incorrecte. Essayez encore !</div>
            ${qcmConfig.explanation ? `<div class="qcm-explanation">💡 ${qcmConfig.explanation}</div>` : ''}
        `;
        
        // Permettre de réessayer après un délai
        setTimeout(() => {
            // Réinitialiser l'interface
            answerDivs.forEach(div => {
                div.classList.remove('correct', 'incorrect');
                div.style.pointerEvents = 'auto';
            });
            
            selectedAnswers = [];
            answerDivs.forEach((div, index) => {
                const checkbox = div.querySelector('input[type="checkbox"]');
                checkbox.checked = false;
                div.classList.remove('selected');
            });
            
            feedback.style.display = 'none';
            document.getElementById('qcm-submit-btn').disabled = false;
        }, 2000);
    }
}

// Réinitialiser l'interface audio
function resetAudioInterface() {
    // Arrêter l'audio si actif
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    // Réinitialiser les éléments
    document.getElementById('audio-status-text').textContent = 'Appuyez sur le bouton pour commencer';
    document.getElementById('audio-progress-container').style.display = 'none';
    document.getElementById('start-audio-btn').style.display = 'block';
    document.getElementById('stop-audio-btn').style.display = 'none';
    document.getElementById('audio-feedback').innerHTML = '';
    document.getElementById('audio-progress-fill').style.width = '0%';
    document.getElementById('audio-timer').textContent = '0s';
    document.getElementById('audio-level').textContent = 'Volume: 0%';
    
    // Réinitialiser les variables
    audioProgress = 0;
    audioStartTime = null;
    isAudioChallengeActive = false;
    audioAnimationId = null;
}

// Démarrer l'épreuve audio
async function startAudioChallenge() {
    if (!currentAudioCheckpoint || !currentAudioCheckpoint.clue.audioChallenge) {
        console.error('❌ Configuration audio manquante');
        return;
    }
    
    try {
        // Demander l'accès au microphone
        audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        
        // Créer le contexte audio
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(audioStream);
        
        // Créer l'analyseur
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 256;
        const bufferLength = audioAnalyser.frequencyBinCount;
        audioDataArray = new Uint8Array(bufferLength);
        
        source.connect(audioAnalyser);
        
        // Démarrer le défi
        isAudioChallengeActive = true;
        audioStartTime = Date.now();
        audioProgress = 0;
        
        // Mettre à jour l'interface
        document.getElementById('audio-status-text').textContent = 'Épreuve en cours... Faites du bruit !';
        document.getElementById('audio-progress-container').style.display = 'block';
        document.getElementById('start-audio-btn').style.display = 'none';
        document.getElementById('stop-audio-btn').style.display = 'block';
        
        // Démarrer l'animation
        updateAudioProgress();
        
        console.log('🎤 Épreuve audio démarrée');
        
    } catch (error) {
        console.error('❌ Erreur accès microphone:', error);
        showAudioFeedback('Impossible d\'accéder au microphone. Vérifiez les permissions.', 'error');
    }
}

// Arrêter l'épreuve audio
function stopAudioChallenge() {
    isAudioChallengeActive = false;
    
    if (audioAnimationId) {
        cancelAnimationFrame(audioAnimationId);
        audioAnimationId = null;
    }
    
    resetAudioInterface();
    console.log('🎤 Épreuve audio arrêtée');
}

// Mettre à jour la progression audio
function updateAudioProgress() {
    if (!isAudioChallengeActive || !audioAnalyser || !currentAudioCheckpoint) {
        return;
    }
    
    const audioConfig = currentAudioCheckpoint.clue.audioChallenge;
    const requiredDuration = audioConfig.duration * 1000; // en millisecondes
    const threshold = audioConfig.threshold;
    
    // Analyser le niveau audio
    audioAnalyser.getByteFrequencyData(audioDataArray);
    
    // Calculer le niveau moyen
    let sum = 0;
    for (let i = 0; i < audioDataArray.length; i++) {
        sum += audioDataArray[i];
    }
    const average = sum / audioDataArray.length;
    const volumeLevel = Math.round((average / 255) * 100);
    
    // Mettre à jour l'affichage du volume
    document.getElementById('audio-level').textContent = `Volume: ${volumeLevel}%`;
    
    // Vérifier si le seuil est atteint
    if (volumeLevel >= threshold) {
        audioProgress += 16; // ~60fps, donc environ 16ms par frame
        
        // Mettre à jour la jauge
        const progressPercent = Math.min((audioProgress / requiredDuration) * 100, 100);
        document.getElementById('audio-progress-fill').style.width = `${progressPercent}%`;
        
        // Mettre à jour le timer
        const elapsedSeconds = Math.floor(audioProgress / 1000);
        const requiredSeconds = Math.floor(requiredDuration / 1000);
        document.getElementById('audio-timer').textContent = `${elapsedSeconds}s / ${requiredSeconds}s`;
        
        // Vérifier si l'épreuve est réussie
        if (audioProgress >= requiredDuration) {
            audioChallengeSucess();
            return;
        }
    } else {
        // Niveau insuffisant, réinitialiser le progrès
        audioProgress = Math.max(0, audioProgress - 32); // Perte plus rapide que le gain
        
        const progressPercent = Math.min((audioProgress / requiredDuration) * 100, 100);
        document.getElementById('audio-progress-fill').style.width = `${progressPercent}%`;
        
        const elapsedSeconds = Math.floor(audioProgress / 1000);
        const requiredSeconds = Math.floor(requiredDuration / 1000);
        document.getElementById('audio-timer').textContent = `${elapsedSeconds}s / ${requiredSeconds}s`;
    }
    
    // Continuer l'animation
    audioAnimationId = requestAnimationFrame(updateAudioProgress);
}

// Succès de l'épreuve audio
function audioChallengeSucess() {
    isAudioChallengeActive = false;
    
    if (audioAnimationId) {
        cancelAnimationFrame(audioAnimationId);
        audioAnimationId = null;
    }
    
    const audioConfig = currentAudioCheckpoint.clue.audioChallenge;
    const successMessage = audioConfig.successMessage || 'Bravo ! Épreuve audio réussie !';
    
    // Marquer le checkpoint comme trouvé maintenant que l'épreuve est réussie
    if (!foundCheckpoints.includes(currentAudioCheckpoint.id)) {
        foundCheckpoints.push(currentAudioCheckpoint.id);
        
        // Mettre à jour le marqueur visuellement
        const markerData = checkpointMarkers.find(m => m.id === currentAudioCheckpoint.id);
        if (markerData) {
            const newIcon = L.divIcon({
                className: 'checkpoint-marker found',
                html: currentAudioCheckpoint.emoji,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            markerData.marker.setIcon(newIcon);
        }
        
        // Sauvegarder la progression dans Firebase
        if (firebaseService && currentTeam && currentTeamId) {
            firebaseService.updateTeamProgress(currentTeamId, {
                foundCheckpoints: foundCheckpoints,
                unlockedCheckpoints: unlockedCheckpoints
            });
            
            console.log('💾 Progression épreuve audio sauvegardée:', {
                teamId: currentTeamId,
                foundCheckpoints, 
                unlockedCheckpoints
            });
        }
        
        // Mettre à jour l'interface
        updateUI();
    }
    
    // Afficher le succès
    showAudioFeedback(successMessage, 'success');
    
    // Masquer les contrôles
    document.getElementById('start-audio-btn').style.display = 'none';
    document.getElementById('stop-audio-btn').style.display = 'none';
    document.getElementById('audio-status-text').textContent = 'Épreuve réussie !';
    
    console.log('🎉 Épreuve audio réussie !');
    
    // Débloquer le prochain checkpoint après un délai
    setTimeout(() => {
        document.getElementById('audio-modal').style.display = 'none';
        
        // Débloquer le prochain point selon l'équipe
        const nextCheckpointId = getNextCheckpointForTeam();
        if (nextCheckpointId) {
            unlockCheckpoint(nextCheckpointId);
            
            // Message personnalisé selon le prochain checkpoint
            const nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
            const nextName = nextCheckpoint ? nextCheckpoint.name : 'prochain point';
            showNotification(`🎉 "${nextName}" est maintenant débloqué !`);
            
            // Zoomer sur le nouveau point débloqué
            if (nextCheckpoint) {
                console.log('🎯 Zoom vers le checkpoint débloqué:', nextCheckpoint.name);
                centerMapOnCheckpoint(nextCheckpoint);
            }
        } else {
            showNotification('🏆 Parcours terminé ! Félicitations !');
        }
        
        // Nettoyer les ressources audio
        resetAudioInterface();
        
    }, 2000);
}

// Afficher un feedback audio
function showAudioFeedback(message, type = 'info') {
    const feedback = document.getElementById('audio-feedback');
    feedback.textContent = message;
    feedback.className = `audio-feedback ${type}`;
}

// Réinitialiser l'interface photo
function resetPhotoInterface() {
    // Arrêter la caméra si active
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    // Réinitialiser les éléments
    document.getElementById('camera-video').style.display = 'none';
    document.getElementById('start-camera-btn').style.display = 'block';
    document.getElementById('take-photo-btn').style.display = 'none';
    document.getElementById('retake-photo-btn').style.display = 'none';
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('photo-actions').style.display = 'none';
    
    capturedPhotoBlob = null;
}

// Démarrer la caméra
async function startCamera() {
    try {
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment' // Caméra arrière par défaut
            }
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera-video');
        video.srcObject = cameraStream;
        video.style.display = 'block';
        
        // Mettre à jour les boutons
        document.getElementById('start-camera-btn').style.display = 'none';
        document.getElementById('take-photo-btn').style.display = 'block';
        
        showNotification('📷 Caméra activée', 'success');
        
    } catch (error) {
        console.error('❌ Erreur accès caméra:', error);
        showNotification('❌ Impossible d\'accéder à la caméra', 'error');
    }
}

// Prendre une photo
function takePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('photo-canvas');
    const context = canvas.getContext('2d');
    
    // Définir la taille du canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dessiner l'image du video sur le canvas
    context.drawImage(video, 0, 0);
    
    // Convertir en blob avec compression
    canvas.toBlob((blob) => {
        compressPhoto(blob);
    }, 'image/jpeg', 0.8); // Qualité 80%
}

// Compresser la photo pour respecter la limite de 1MB
function compressPhoto(originalBlob) {
    const maxSize = 1024 * 1024; // 1MB
    let quality = 0.8;
    
    function compress(blob, currentQuality) {
        if (blob.size <= maxSize || currentQuality <= 0.1) {
            // Photo acceptable ou qualité minimale atteinte
            capturedPhotoBlob = blob;
            displayPhoto(blob);
            return;
        }
        
        // Réduire la qualité et recompresser
        const canvas = document.getElementById('photo-canvas');
        canvas.toBlob((newBlob) => {
            compress(newBlob, currentQuality - 0.1);
        }, 'image/jpeg', currentQuality - 0.1);
    }
    
    compress(originalBlob, quality);
}

// Afficher la photo capturée
function displayPhoto(blob) {
    const img = document.getElementById('captured-photo');
    const url = URL.createObjectURL(blob);
    img.src = url;
    
    // Afficher les infos
    const sizeKB = Math.round(blob.size / 1024);
    const quality = blob.size > 500000 ? 'Haute' : blob.size > 200000 ? 'Moyenne' : 'Optimisée';
    
    document.getElementById('photo-size').textContent = `${sizeKB} KB`;
    document.getElementById('photo-quality').textContent = quality;
    
    // Arrêter la caméra
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    // Mettre à jour l'interface
    document.getElementById('camera-video').style.display = 'none';
    document.getElementById('take-photo-btn').style.display = 'none';
    document.getElementById('retake-photo-btn').style.display = 'block';
    document.getElementById('photo-preview').style.display = 'block';
    document.getElementById('photo-actions').style.display = 'block';
    
    console.log('📸 Photo capturée:', sizeKB + 'KB');
}

// Reprendre une photo
function retakePhoto() {
    // Nettoyer l'ancienne photo
    if (capturedPhotoBlob) {
        URL.revokeObjectURL(document.getElementById('captured-photo').src);
        capturedPhotoBlob = null;
    }
    
    // Redémarrer la caméra
    startCamera();
    
    // Cacher la prévisualisation
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('photo-actions').style.display = 'none';
    document.getElementById('retake-photo-btn').style.display = 'none';
}

// Envoyer la photo pour validation
async function submitPhoto() {
    if (!capturedPhotoBlob || !currentPhotoCheckpoint) {
        showNotification('❌ Aucune photo à envoyer', 'error');
        return;
    }
    
    try {
        // Convertir le blob en base64
        const base64 = await blobToBase64(capturedPhotoBlob);
        
        // Créer la demande de validation avec la photo
        const validationData = {
            teamId: currentTeamId,
            checkpointId: currentPhotoCheckpoint.id,
            type: 'photo',
            data: {
                photo: base64,
                size: capturedPhotoBlob.size,
                timestamp: new Date().toISOString()
            },
            message: `Photo envoyée pour "${currentPhotoCheckpoint.name}"`
        };
        
        await firebaseService.createValidationRequest(
            validationData.teamId,
            validationData.checkpointId,
            validationData.type,
            JSON.stringify(validationData.data)
        );
        
        // Fermer le modal
        document.getElementById('photo-modal').style.display = 'none';
        resetPhotoInterface();
        
        showNotification(`📸 Photo envoyée pour validation de "${currentPhotoCheckpoint.name}"`, 'success');
        
        console.log('📸 Photo envoyée pour validation:', currentPhotoCheckpoint.name);
        
    } catch (error) {
        console.error('❌ Erreur envoi photo:', error);
        showNotification('❌ Erreur lors de l\'envoi', 'error');
    }
}

// Convertir un blob en base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ===== SYSTÈME DE NOTIFICATIONS =====

// Configurer les listeners pour les notifications de refus
function setupNotificationListeners() {
    if (!firebaseService || !currentTeamId) {
        console.warn('⚠️ Impossible de configurer les notifications - service non disponible');
        return;
    }
    
    // Écouter les demandes d'aide résolues
    firebaseService.onTeamHelpRequestsResolved(currentTeamId, (resolvedRequests) => {
        resolvedRequests.forEach(request => {
            // Éviter les doublons
            if (processedNotifications.has(request.id)) return;
            processedNotifications.add(request.id);
            
            if (request.action === 'denied') {
                showAdminRefusalNotification('aide', request);
            } else if (request.action === 'granted') {
                handleGrantedHelpRequest(request);
            }
        });
    });
    
    // Écouter les validations résolues
    firebaseService.onTeamValidationsResolved(currentTeamId, (resolvedValidations) => {
        resolvedValidations.forEach(validation => {
            // Éviter les doublons
            if (processedNotifications.has(validation.id)) return;
            processedNotifications.add(validation.id);
            
            if (validation.status === 'rejected') {
                showAdminRefusalNotification('validation', validation);
            }
        });
    });
}

// Traiter une demande d'aide accordée par l'admin
function handleGrantedHelpRequest(request) {
    const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === request.checkpointId);
    const checkpointName = checkpoint ? checkpoint.name : `Point ${request.checkpointId}`;
    
    console.log('✅ Demande d\'aide accordée par admin:', {
        type: request.type,
        checkpointId: request.checkpointId,
        checkpointName: checkpointName
    });
    
    // Traitement selon le type d'aide accordée
    if (request.type === 'audio') {
        // Pour les épreuves audio : marquer comme trouvé et débloquer le suivant
        if (!foundCheckpoints.includes(request.checkpointId)) {
            foundCheckpoints.push(request.checkpointId);
            
            // Mettre à jour le marqueur visuellement
            const markerData = checkpointMarkers.find(m => m.id === request.checkpointId);
            if (markerData) {
                const newIcon = L.divIcon({
                    className: 'checkpoint-marker found',
                    html: checkpoint.emoji,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                markerData.marker.setIcon(newIcon);
                
                // Mettre à jour le cercle en vert
                markerData.circle.setStyle({
                    color: '#27ae60',
                    fillColor: '#27ae60'
                });
            }
            
            // Débloquer le prochain checkpoint
            const nextCheckpointId = getNextCheckpointForTeam();
            if (nextCheckpointId) {
                unlockCheckpoint(nextCheckpointId);
                
                const nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
                const nextName = nextCheckpoint ? nextCheckpoint.name : 'prochain point';
                showNotification(`✅ Admin a validé l'épreuve audio "${checkpointName}" ! "${nextName}" est débloqué.`, 'success');
            } else {
                showNotification(`✅ Admin a validé l'épreuve audio "${checkpointName}" ! Parcours terminé !`, 'success');
            }
            
            // Sauvegarder la progression
            if (firebaseService && currentTeam && currentTeamId) {
                firebaseService.updateTeamProgress(currentTeamId, {
                    foundCheckpoints: foundCheckpoints,
                    unlockedCheckpoints: unlockedCheckpoints
                });
            }
            
            // Mettre à jour l'interface
            updateUI();
            
            // Fermer le modal audio s'il est ouvert
            const audioModal = document.getElementById('audio-modal');
            if (audioModal && audioModal.style.display !== 'none') {
                audioModal.style.display = 'none';
                resetAudioInterface();
            }
        }
    } else if (request.type === 'qcm') {
        // Pour les QCM : marquer comme trouvé et débloquer le suivant
        if (!foundCheckpoints.includes(request.checkpointId)) {
            foundCheckpoints.push(request.checkpointId);
            
            // Mettre à jour le marqueur visuellement
            const markerData = checkpointMarkers.find(m => m.id === request.checkpointId);
            if (markerData) {
                const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === request.checkpointId);
                const newIcon = L.divIcon({
                    className: 'checkpoint-marker found',
                    html: checkpoint?.emoji || '📍',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                markerData.marker.setIcon(newIcon);
                
                // Mettre à jour le cercle en vert
                markerData.circle.setStyle({
                    color: '#27ae60',
                    fillColor: '#27ae60'
                });
            }
            
            // Débloquer le prochain checkpoint
            const nextCheckpointId = getNextCheckpointForTeam();
            if (nextCheckpointId) {
                unlockCheckpoint(nextCheckpointId);
                
                const nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
                const nextName = nextCheckpoint ? nextCheckpoint.name : 'prochain point';
                showNotification(`🎉 "${nextName}" est maintenant débloqué !`);
                
                // Zoomer sur le nouveau point débloqué
                if (nextCheckpoint) {
                    console.log('🎯 Zoom vers le checkpoint débloqué:', nextCheckpoint.name);
                    centerMapOnCheckpoint(nextCheckpoint);
                }
            } else {
                showNotification('🏆 Parcours terminé ! Félicitations !');
            }
            
            // Sauvegarder la progression dans Firebase
            if (firebaseService && currentTeam && currentTeamId) {
                firebaseService.updateTeamProgress(currentTeamId, {
                    foundCheckpoints: foundCheckpoints,
                    unlockedCheckpoints: unlockedCheckpoints
                });
                
                console.log('💾 Progression QCM sauvegardée:', {
                    teamId: currentTeamId,
                    foundCheckpoints, 
                    unlockedCheckpoints
                });
            }
            
            // Mettre à jour l'interface
            updateUI();
            
            // Fermer le modal QCM s'il est ouvert
            if (document.getElementById('qcm-modal').style.display === 'flex') {
                document.getElementById('qcm-modal').style.display = 'none';
            }
        }
    } else if (request.type === 'location') {
        // Pour l'aide de localisation : juste une notification
        showNotification(`📍 Admin a fourni l'aide de localisation pour "${checkpointName}"`, 'success');
    } else if (request.type === 'riddle') {
        // Pour l'aide d'énigme : marquer comme trouvé et débloquer le suivant
        if (!foundCheckpoints.includes(request.checkpointId)) {
            foundCheckpoints.push(request.checkpointId);
            
            // Débloquer le prochain checkpoint
            const nextCheckpointId = getNextCheckpointForTeam();
            if (nextCheckpointId) {
                unlockCheckpoint(nextCheckpointId);
                
                const nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
                const nextName = nextCheckpoint ? nextCheckpoint.name : 'prochain point';
                showNotification(`✅ Admin a résolu l'énigme "${checkpointName}" ! "${nextName}" est débloqué.`, 'success');
            } else {
                showNotification(`✅ Admin a résolu l'énigme "${checkpointName}" ! Parcours terminé !`, 'success');
            }
            
            // Sauvegarder la progression
            if (firebaseService && currentTeam && currentTeamId) {
                firebaseService.updateTeamProgress(currentTeamId, {
                    foundCheckpoints: foundCheckpoints,
                    unlockedCheckpoints: unlockedCheckpoints
                });
            }
            
            // Mettre à jour l'interface
            updateUI();
            
            // Fermer le modal énigme s'il est ouvert
            const riddleModal = document.getElementById('riddle-modal');
            if (riddleModal && riddleModal.style.display !== 'none') {
                riddleModal.style.display = 'none';
            }
        }
    }
}

// Afficher une notification de refus admin
function showAdminRefusalNotification(type, data) {
    const checkpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === data.checkpointId);
    const checkpointName = checkpoint ? checkpoint.name : `Point ${data.checkpointId}`;
    
    let title, message;
    
    if (type === 'aide') {
                const helpType = data.type === 'location' ? 'localisation' : 
                                data.type === 'riddle' ? 'énigme' : 
                                data.type === 'audio' ? 'épreuve audio' :
                                data.type === 'qcm' ? 'QCM' :
                                data.type === 'photo' ? 'validation photo' : 'aide';
        title = `❌ Demande d'aide refusée`;
        message = `Votre demande d'aide (${helpType}) pour "${checkpointName}" a été refusée par l'admin.`;
    } else {
        title = `❌ Validation refusée`;
        message = `Votre validation pour "${checkpointName}" a été refusée par l'admin.`;
    }
    
    if (data.adminNotes) {
        message += `\n\n💬 Note de l'admin : "${data.adminNotes}"`;
    }
    
    // Vérifier si c'est une photo refusée pour ajouter le bouton reprendre
    const isPhotoRefusal = (type === 'validation' && checkpoint?.type === 'photo') || 
                          (type === 'aide' && data.type === 'photo');
    
    // Afficher une notification persistante avec bouton reprendre si c'est une photo
    showPersistentNotification(title, message, isPhotoRefusal ? checkpoint : null);
}

// Notification persistante avec bouton OK (et bouton reprendre photo si applicable)
function showPersistentNotification(title, message, photoCheckpoint = null) {
    // Créer le modal de notification
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    // Boutons selon le contexte
    let buttonsHTML = '';
    if (photoCheckpoint) {
        // Photo refusée → boutons Reprendre + OK
        buttonsHTML = `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button id="notification-retry-btn" class="photo-btn success" style="flex: 1;">📸 Reprendre photo</button>
                <button id="notification-ok-btn" class="photo-btn" style="flex: 1;">OK</button>
            </div>
        `;
    } else {
        // Notification normale → juste OK
        buttonsHTML = `<button id="notification-ok-btn" class="photo-btn" style="width: 100%;">OK</button>`;
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <h2 style="color: #e74c3c; margin-bottom: 1rem;">${title}</h2>
            <p style="white-space: pre-line; margin-bottom: 1.5rem;">${message}</p>
            ${buttonsHTML}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Gérer la fermeture
    const okBtn = modal.querySelector('#notification-ok-btn');
    okBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Gérer le bouton reprendre photo
    if (photoCheckpoint) {
        const retryBtn = modal.querySelector('#notification-retry-btn');
        retryBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            // Relancer le défi photo
            showPhotoChallenge(photoCheckpoint);
            console.log(`📸 Reprise du défi photo pour: ${photoCheckpoint.name}`);
        });
    }
    
    // Auto-suppression après 30 secondes
    setTimeout(() => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    }, 30000);
}

// Anciennes fonctions d'aide supprimées - remplacées par les fonctions spécifiques par checkpoint

console.log('✅ Script du jeu de piste chargé avec succès !');
