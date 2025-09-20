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
    checkpoints: [
        {
            id: 0,
            name: "Lobby - Point de Rassemblement",
            coordinates: [49.09568858396698, 6.189477252799626],
            emoji: "🏠",
            isLobby: true,
            clue: {
                title: "Bienvenue au Lobby !",
                text: "Point de rassemblement de toutes les équipes. Utilisez le bouton GPS pour vous diriger vers votre premier défi !",
                image: null
            },
            hint: "Point de rassemblement - Utilisez le GPS pour commencer votre aventure !"
        },
        {
            id: 1,
            name: "Premier Défi",
            coordinates: [49.09524036018862, 6.19175279981568],
            emoji: "🚀",
            locked: true,
            clue: {
                title: "Premier Défi Découvert !",
                text: "Félicitations ! Vous avez trouvé votre premier défi. Pour débloquer le point suivant et obtenir sa position GPS, vous devez résoudre cette énigme simple :",
                riddle: {
                    question: "Combien font 1 + 1 ?",
                    answer: "2",
                    hint: "C'est une addition très simple !"
                }
            },
            hint: "Votre premier défi vous attend !"
        },
        {
            id: 2,
            name: "Point Final",
            coordinates: [49.090159892001715, 6.192017564333063],
            emoji: "🎯",
            locked: true,
            clue: {
                title: "Destination Finale !",
                text: "Bravo ! Vous avez résolu l'énigme et trouvé le point final ! Félicitations pour avoir terminé ce test du jeu de piste.",
                image: null
            },
            hint: "Ce point sera débloqué après avoir résolu l'énigme du premier défi."
        }
    ]
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
let currentUser = null; // Utilisateur connecté
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
    console.log('🚀 Initialisation du jeu de piste...');
    
    // Initialiser Firebase Service
    if (window.firebaseService) {
        firebaseService = window.firebaseService;
        console.log('✅ Firebase Service initialisé');
    } else {
        console.warn('⚠️ Firebase Service non disponible - mode hors ligne');
    }
    
    // Vérifier si un utilisateur est connecté
    checkUserLogin();
    
    // Initialiser les checkpoints dans Firebase
    initializeCheckpointsInFirebase();
}

function checkUserLogin() {
    // Vérifier si un utilisateur est déjà connecté
    const savedUserId = localStorage.getItem('currentUserId');
    
    if (savedUserId) {
        // Utilisateur déjà connecté, charger ses données
        loadUserData(savedUserId);
    } else {
        // Pas d'utilisateur connecté, afficher le modal de connexion
        showUserLoginModal();
    }
}

function showUserLoginModal() {
    const modal = document.getElementById('user-login-modal');
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

// Gestion de la connexion utilisateur
async function handleUserLogin() {
    const userId = document.getElementById('user-id').value.trim();
    const password = document.getElementById('user-password').value;
    const errorDiv = document.getElementById('login-error');
    const loadingDiv = document.getElementById('login-loading');
    
    try {
        // Afficher le loading
        errorDiv.style.display = 'none';
        loadingDiv.style.display = 'block';
        
        // Vérifier les identifiants dans Firebase
        const user = await firebaseService.authenticateUser(userId, password);
        
        if (user) {
            // Connexion réussie
            currentUser = user;
            localStorage.setItem('currentUserId', userId);
            
            // Cacher le modal et démarrer le jeu
            document.getElementById('user-login-modal').style.display = 'none';
            
            // Charger les données de l'utilisateur
            await loadUserGameData();
            
            showNotification(`Bienvenue ${user.name} ! Équipe ${user.teamName}`, 'success');
            
        } else {
            showLoginError('Identifiants incorrects');
        }
        
    } catch (error) {
        console.error('❌ Erreur de connexion:', error);
        showLoginError('Erreur de connexion. Veuillez réessayer.');
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Charger les données utilisateur depuis Firebase
async function loadUserData(userId) {
    try {
        const user = await firebaseService.getUser(userId);
        if (user) {
            currentUser = user;
            await loadUserGameData();
        } else {
            // Utilisateur non trouvé, déconnecter
            localStorage.removeItem('currentUserId');
            showUserLoginModal();
        }
    } catch (error) {
        console.error('❌ Erreur chargement utilisateur:', error);
        localStorage.removeItem('currentUserId');
        showUserLoginModal();
    }
}

// Charger les données de jeu de l'utilisateur
async function loadUserGameData() {
    if (!currentUser) return;
    
    // Récupérer l'équipe de l'utilisateur
    const team = await firebaseService.getTeam(currentUser.teamId);
    if (team) {
        currentTeamId = currentUser.teamId;
        
        // Ajouter les données de l'équipe à currentUser
        currentUser.teamRoute = team.route;
        currentUser.teamColor = team.color;
        
        // Restaurer la progression
        foundCheckpoints = currentUser.foundCheckpoints || [];
        unlockedCheckpoints = currentUser.unlockedCheckpoints || [0];
        
        // Afficher les infos de l'équipe
        showUserInfo();
        
        // Démarrer le jeu
        startGame();
        
        console.log(`✅ Utilisateur ${currentUser.name} connecté - Équipe ${team.name}`);
    }
}

// Afficher les informations utilisateur
function showUserInfo() {
    const teamInfo = document.getElementById('team-info');
    const currentTeamSpan = document.getElementById('current-team');
    
    if (currentUser && teamInfo && currentTeamSpan) {
        currentTeamSpan.textContent = `${currentUser.name} - ${currentUser.teamName}`;
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

function showTeamInfo() {
    const teamInfo = document.getElementById('team-info');
    const currentTeamSpan = document.getElementById('current-team');
    
    if (currentUser && currentUser.teamName) {
        currentTeamSpan.textContent = currentUser.teamName;
        teamInfo.style.display = 'block';
    }
}

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
    
    // Ajouter les checkpoints sur la carte
    addCheckpointsToMap();
    
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
    if (!currentUser || !currentUser.teamRoute) return null;
    
    const teamRoute = currentUser.teamRoute;
    const nonLobbyFound = foundCheckpoints.filter(id => {
        const cp = GAME_CONFIG.checkpoints.find(c => c.id === id);
        return cp && !cp.isLobby;
    });
    
    // Déterminer quel est le prochain checkpoint dans l'ordre de l'équipe
    const nextIndex = nonLobbyFound.length;
    
    if (nextIndex < teamRoute.length) {
        return teamRoute[nextIndex];
    }
    
    return null; // Tous les checkpoints sont terminés
}

function getTeamColor() {
    return currentUser?.teamColor || '#3498db';
}

// Fonction pour mettre à jour la progression sur la route (grignotage + recalcul auto)
function updateRouteProgress() {
    if (!currentRoute || !userPosition) return;
    
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
    
    // Afficher l'indice (sauf pour le lobby)
    if (!checkpoint.isLobby) {
        showClue(checkpoint.clue);
    } else {
        // Pour le lobby, débloquer le premier checkpoint selon l'équipe
        setTimeout(() => {
            console.log('🏠 Lobby trouvé, recherche du premier checkpoint...');
            console.log('👤 currentUser:', currentUser);
            console.log('🛤️ teamRoute:', currentUser?.teamRoute);
            
            const firstCheckpointId = getNextCheckpointForTeam();
            console.log('🎯 Premier checkpoint ID:', firstCheckpointId);
            
            if (firstCheckpointId) {
                unlockCheckpoint(firstCheckpointId);
            } else {
                console.log('❌ Aucun checkpoint à débloquer trouvé');
            }
        }, 1000);
    }
    
    // Mettre à jour l'interface
    updateUI();
    
    // Vérifier si le jeu est terminé (exclure le lobby du compte)
    const nonLobbyCheckpoints = GAME_CONFIG.checkpoints.filter(cp => !cp.isLobby);
    const nonLobbyFound = foundCheckpoints.filter(id => {
        const cp = GAME_CONFIG.checkpoints.find(c => c.id === id);
        return cp && !cp.isLobby;
    });
    
    if (nonLobbyFound.length === nonLobbyCheckpoints.length) {
        setTimeout(() => {
            showSuccessModal();
        }, 2000);
    }
    
    // Notification
    const message = checkpoint.isLobby ? `🏠 Bienvenue au ${checkpoint.name} !` : `🎉 ${checkpoint.name} découvert !`;
    showNotification(message);
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
    
    // Récupérer l'énigme du premier checkpoint
    const firstCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === 1);
    const correctAnswer = firstCheckpoint.clue.riddle.answer.toLowerCase();
    
    if (userAnswer === correctAnswer) {
        // Bonne réponse !
        feedback.innerHTML = '🎉 Correct ! Le deuxième point est maintenant débloqué !';
        feedback.className = 'success';
        
        // Débloquer le prochain point selon l'équipe
        const nextCheckpointId = getNextCheckpointForTeam();
        if (nextCheckpointId) {
            unlockCheckpoint(nextCheckpointId);
        }
        
        setTimeout(() => {
            document.getElementById('riddle-modal').style.display = 'none';
            showNotification('🎯 Prochain défi débloqué ! Navigation GPS activée.');
            
            // Zoomer sur le nouveau point débloqué
            if (nextCheckpointId) {
                const unlockedCheckpoint = GAME_CONFIG.checkpoints.find(cp => cp.id === nextCheckpointId);
                if (unlockedCheckpoint) {
                    centerMapOnCheckpoint(unlockedCheckpoint);
                }
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
    
    updateHint();
    console.log(`🔓 Checkpoint ${checkpointId} débloqué et révélé !`);
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
    modal.style.display = 'block';
}

function updateUI() {
    updateProgress();
    updateHint();
}

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
    
    if (foundCheckpoints.length === GAME_CONFIG.checkpoints.length) {
        hintText.textContent = '🎉 Félicitations ! Vous avez terminé le jeu de piste !';
        gpsBtn.style.display = 'none';
        return;
    }
    
    // Trouver le prochain checkpoint débloqué et non trouvé
    const nextCheckpoint = GAME_CONFIG.checkpoints.find(cp => {
        const isFound = foundCheckpoints.includes(cp.id);
        const isUnlocked = unlockedCheckpoints.includes(cp.id);
        const isAccessible = !cp.locked || isUnlocked;
        return !isFound && isAccessible;
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
    
    document.getElementById('restart-btn').addEventListener('click', () => {
        restartGame();
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

function restartGame() {
    foundCheckpoints = [];
    unlockedCheckpoints = [1]; // Remettre seulement le premier point débloqué
    document.getElementById('success-modal').style.display = 'none';
    
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

async function initializeCheckpointsInFirebase() {
    if (!firebaseService) {
        console.warn('⚠️ Firebase Service non disponible - mode hors ligne');
        return;
    }
    
    try {
        await firebaseService.initializeCheckpoints(GAME_CONFIG.checkpoints);
        console.log('✅ Checkpoints initialisés dans Firebase');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation des checkpoints dans Firebase:', error);
    }
}

// Synchronisation temps réel des équipes
function syncTeamData() {
    if (!firebaseService || !currentTeamId) return;
    
    firebaseService.onTeamChange(currentTeamId, (teamData) => {
        console.log('🔄 Mise à jour des données de l\'équipe:', teamData);
        // Mettre à jour l'état local avec les données de l'équipe
        // selectedTeam n'est plus utilisé, on utilise currentUser
        unlockedCheckpoints = teamData.unlockedCheckpoints;
        foundCheckpoints = teamData.foundCheckpoints;
        
        // Mettre à jour l'interface utilisateur
        showTeamInfo();
        updateProgress();
    });
}

// Synchronisation temps réel des checkpoints
function syncCheckpoints() {
    if (!firebaseService) return;
    
    firebaseService.getCheckpoints().then((checkpoints) => {
        console.log('🔄 Checkpoints synchronisés:', checkpoints);
        GAME_CONFIG.checkpoints = checkpoints;
        addCheckpointsToMap();
    }).catch((error) => {
        console.error('❌ Erreur lors de la synchronisation des checkpoints:', error);
    });
}

// Appeler la synchronisation après l'initialisation
syncTeamData();
syncCheckpoints();

console.log('✅ Script du jeu de piste chargé avec succès !');
