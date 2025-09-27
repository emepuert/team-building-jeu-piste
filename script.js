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
document.addEventListener('DOMContentLoaded', function() {
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
    // Vérifier si une équipe est déjà connectée
    const savedTeamId = localStorage.getItem('currentTeamId');
    
    if (savedTeamId) {
        // Équipe déjà connectée, charger ses données
        loadTeamData(savedTeamId);
    } else {
        // Pas d'équipe connectée, afficher le modal de connexion
        showTeamLoginModal();
    }
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
        const team = await firebaseService.authenticateTeam(teamName, password);
        
        if (team) {
            // Connexion réussie
            currentTeam = team;
            currentTeamId = team.id;
            localStorage.setItem('currentTeamId', team.id);
            
            // Cacher le modal et démarrer le jeu
            document.getElementById('user-login-modal').style.display = 'none';
            
            // Charger les données de l'équipe
            await loadTeamGameData();
            
            showNotification(`Bienvenue équipe ${team.name} !`, 'success');
            
        } else {
            showLoginError('Nom d\'équipe ou mot de passe incorrect');
        }
        
    } catch (error) {
        console.error('❌ Erreur de connexion équipe:', error);
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
            localStorage.removeItem('currentTeamId');
            showTeamLoginModal();
        }
    } catch (error) {
        console.error('❌ Erreur chargement équipe:', error);
        localStorage.removeItem('currentTeamId');
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
        
        // Démarrer le jeu
        startGame();
        
        // Démarrer la synchronisation temps réel avec l'équipe
        startTeamSync();
        
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

function startGame() {
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
    
    // Synchroniser et ajouter les checkpoints depuis Firebase
    syncCheckpoints();
    
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
    
    console.log('✅ Carte initialisée avec succès');
}

function requestGeolocation() {
    console.log('📍 Demande de géolocalisation...');
    
    if (!navigator.geolocation) {
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
    updateCoordinatesDisplay();
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
    updateCoordinatesDisplay();
    checkProximityToCheckpoints();
    
    // Mettre à jour la route si elle existe (grignotage)
    if (currentRoute) {
        updateRouteProgress();
    }
}

function onLocationError(error) {
    console.error('❌ Erreur de géolocalisation:', error);
    
    let message = 'Erreur de géolocalisation';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = 'Géolocalisation refusée. Veuillez autoriser l\'accès à votre position.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Position indisponible. Vérifiez votre connexion.';
            break;
        case error.TIMEOUT:
            message = 'Délai de géolocalisation dépassé.';
            break;
    }
    
    updateStatus(message);
    showNotification(message, 'error');
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
            foundCheckpoint(checkpoint);
        }
    });
}

function foundCheckpoint(checkpoint) {
    if (foundCheckpoints.includes(checkpoint.id)) return;
    
    foundCheckpoints.push(checkpoint.id);
    
    // Supprimer la route actuelle puisque le point est atteint
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    
    // Mettre à jour le marqueur et le cercle
    const markerData = checkpointMarkers.find(m => m.id === checkpoint.id);
    if (markerData) {
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
        
        // Mettre à jour le cercle en vert
        markerData.circle.setStyle({
            color: '#27ae60',
            fillColor: '#27ae60'
        });
    }
    
    // Afficher l'indice (sauf pour le lobby et sauf si c'est la fin du jeu)
    if (!checkpoint.isLobby) {
        // Vérifier si c'est le dernier checkpoint
        const teamRoute = currentTeam?.route || [];
        const nonLobbyRoute = teamRoute.filter(id => id !== 0);
        const nonLobbyFound = foundCheckpoints.filter(id => id !== 0);
        const isGameComplete = nonLobbyFound.length >= nonLobbyRoute.length && nonLobbyRoute.length > 0;
        
        if (!isGameComplete) {
            showClue(checkpoint.clue);
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

function showClue(clue) {
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
        const isFound = foundCheckpoints.includes(checkpointId);
        const isUnlocked = unlockedCheckpoints.includes(checkpointId);
        
        // Debug pour voir l'état de chaque checkpoint
        console.log(`🔍 Checkpoint ${checkpointId} état:`, {
            isFound,
            isUnlocked,
            foundCheckpoints,
            unlockedCheckpoints
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
            statusIcon = '🎯';
            statusText = 'accessible';
            statusColor = '#f39c12';
            clickable = true; // Peut cliquer pour zoomer
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
            helpButtons = `<button class="help-btn-small" onclick="requestLocationHelpFor(${checkpointId})" title="Demander la localisation">📍</button>`;
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
                helpButtons = `<button class="help-btn-small" onclick="requestLocationHelpFor(${checkpointId})" title="Demander l'aide pour trouver le point d'arrivée">🏁</button>`;
            } else if (checkpoint?.clue?.riddle) {
                // Avec énigme → bouton aide énigme
                helpButtons = `<button class="help-btn-small" onclick="requestRiddleHelpFor(${checkpointId})" title="Demander l'aide pour l'énigme">🧩</button>`;
            } else {
                // Sans énigme → bouton aide générale (localisation physique)
                helpButtons = `<button class="help-btn-small" onclick="requestLocationHelpFor(${checkpointId})" title="Demander de l'aide pour trouver ce point">📍</button>`;
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
    
    // Exclure le lobby du décompte de progression
    const nonLobbyCheckpoints = GAME_CONFIG.checkpoints.filter(cp => !cp.isLobby);
    const nonLobbyFound = foundCheckpoints.filter(id => {
        const cp = GAME_CONFIG.checkpoints.find(c => c.id === id);
        return cp && !cp.isLobby;
    });
    
    const percentage = (nonLobbyFound.length / nonLobbyCheckpoints.length) * 100;
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${nonLobbyFound.length} / ${nonLobbyCheckpoints.length} défis résolus`;
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

function updateCoordinatesDisplay() {
    const coordsElement = document.getElementById('coordinates');
    
    if (userPosition) {
        coordsElement.textContent = `${userPosition.lat.toFixed(6)}, ${userPosition.lng.toFixed(6)}`;
    } else {
        coordsElement.textContent = 'En attente de géolocalisation...';
    }
}

function setupEventListeners() {
    // Fermer les modales
    document.querySelector('#clue-modal .close').addEventListener('click', () => {
        document.getElementById('clue-modal').style.display = 'none';
    });
    
    document.getElementById('clue-close-btn').addEventListener('click', () => {
        document.getElementById('clue-modal').style.display = 'none';
    });
    
    document.getElementById('close-success-btn').addEventListener('click', () => {
        document.getElementById('success-modal').style.display = 'none';
        console.log('🎮 Modal de succès fermé - exploration continue');
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
    updateCoordinatesDisplay();
    checkProximityToCheckpoints();
    updateHint();
    updateStatus('Position simulée');
}

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
        
        // Si Firebase a plus de checkpoints trouvés, on synchronise
        if (firebaseFoundCheckpoints.length > localFoundCheckpoints.length) {
            console.log('🔄 Synchronisation foundCheckpoints depuis Firebase:', {
                local: localFoundCheckpoints,
                firebase: firebaseFoundCheckpoints,
                nouveaux: firebaseFoundCheckpoints.filter(id => !localFoundCheckpoints.includes(id))
            });
            foundCheckpoints = [...firebaseFoundCheckpoints];
            
            // Mettre à jour l'affichage après synchronisation
            updatePlayerRouteProgress();
            updateProgress();
        } else {
            console.log('📱 foundCheckpoints locaux à jour:', {
                local: localFoundCheckpoints,
                firebase: firebaseFoundCheckpoints
            });
        }
        
        // Mettre à jour les infos d'équipe
        showTeamInfo();
        updateProgress();
        
        // Plus besoin de vérifier les demandes d'aide - intégrées dans le parcours
    });
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
function syncCheckpoints() {
    if (!firebaseService) {
        console.warn('⚠️ Firebase Service non disponible pour la synchronisation des checkpoints');
        return;
    }
    
    console.log('🔄 Synchronisation des checkpoints...');
    
    firebaseService.getCheckpoints().then((checkpoints) => {
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
    }).catch((error) => {
        console.error('❌ Erreur lors de la synchronisation des checkpoints:', error);
        showNotification('❌ Erreur de chargement des points. Rechargez la page.', 'error');
    });
}

// ===== SYSTÈME D'AIDE =====

// Variables pour le système d'aide
let currentHelpRequests = [];

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

// Anciennes fonctions d'aide supprimées - remplacées par les fonctions spécifiques par checkpoint
syncCheckpoints();

console.log('✅ Script du jeu de piste chargé avec succès !');
