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
let selectedTeam = null; // Équipe sélectionnée

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
    
    // Vérifier si une équipe est déjà sélectionnée
    checkTeamSelection();
}

function checkTeamSelection() {
    // Vérifier le localStorage pour une équipe existante
    const savedTeam = localStorage.getItem('selectedTeam');
    
    if (savedTeam && TEAMS[savedTeam]) {
        // Équipe déjà sélectionnée
        selectedTeam = savedTeam;
        showTeamInfo();
        startGame();
    } else {
        // Pas d'équipe sélectionnée, afficher le modal
        showTeamSelectionModal();
    }
}

function showTeamSelectionModal() {
    const modal = document.getElementById('team-selection-modal');
    modal.style.display = 'block';
    
    // Configurer les événements de sélection d'équipe
    setupTeamSelectionEvents();
}

function setupTeamSelectionEvents() {
    const teamSelect = document.getElementById('team-select');
    const confirmBtn = document.getElementById('confirm-team-btn');
    
    teamSelect.addEventListener('change', function() {
        confirmBtn.disabled = !this.value;
    });
    
    confirmBtn.addEventListener('click', function() {
        const selectedValue = teamSelect.value;
        if (selectedValue && TEAMS[selectedValue]) {
            // Sauvegarder l'équipe dans localStorage
            localStorage.setItem('selectedTeam', selectedValue);
            selectedTeam = selectedValue;
            
            // Cacher le modal et commencer le jeu
            document.getElementById('team-selection-modal').style.display = 'none';
            showTeamInfo();
            startGame();
            
            showNotification(`Bienvenue dans ${TEAMS[selectedValue].name} !`);
        }
    });
}

function showTeamInfo() {
    const teamInfo = document.getElementById('team-info');
    const currentTeamSpan = document.getElementById('current-team');
    
    if (selectedTeam && TEAMS[selectedTeam]) {
        currentTeamSpan.textContent = TEAMS[selectedTeam].name;
        teamInfo.style.display = 'block';
    }
}

function startGame() {
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
}

function initializeMap() {
    console.log('🗺️ Initialisation de la carte...');
    
    // Créer la carte centrée sur Turin
    map = L.map('map').setView(GAME_CONFIG.center, GAME_CONFIG.zoom);
    
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
        timeout: 10000,
        maximumAge: 60000
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
    if (!selectedTeam || !TEAMS[selectedTeam]) return null;
    
    const teamRoute = TEAMS[selectedTeam].route;
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
    if (!selectedTeam || !TEAMS[selectedTeam]) return '#3498db';
    return TEAMS[selectedTeam].color;
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
        
        // Ajouter le bouton GPS pour les points débloqués (pas encore trouvés) OU pour le lobby
        if (userPosition && (!isFound || checkpoint.isLobby)) {
            let buttonText = '🧭 Calculer l\'itinéraire GPS';
            let targetId = checkpoint.id;
            
            if (checkpoint.isLobby) {
                buttonText = '🧭 GPS vers Premier Défi';
                targetId = getNextCheckpointForTeam() || 1; // Premier checkpoint selon l'équipe
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
                    <button onclick="calculateRouteFromPopup(1)" 
                            style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); 
                                   color: white; border: none; padding: 0.5rem 1rem; 
                                   border-radius: 20px; font-size: 0.9rem; cursor: pointer; 
                                   margin-top: 0.5rem;">
                        🧭 GPS vers Premier Défi
                    </button>
                </div>
            `;
        } else {
            popupContent = `
                <div style="text-align: center;">
                    <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                    <p>✅ Découvert !</p>
                    <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
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
            const firstCheckpointId = getNextCheckpointForTeam();
            if (firstCheckpointId) {
                unlockCheckpoint(firstCheckpointId);
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
            
            // Créer un GeoJSON à partir des coordonnées de la route
            const routeGeoJSON = {
                type: "Feature",
                geometry: route.geometry,
                properties: route
            };
            
            // Afficher la route sur la carte
            currentRoute = L.geoJSON(routeGeoJSON, {
                style: {
                    color: '#e74c3c',
                    weight: 5,
                    opacity: 0.8,
                    dashArray: '10, 5'
                }
            }).addTo(map);
            
            // Extraire les instructions
            const instructions = route.segments[0].steps;
            displayNavigationInstructions(instructions, route.summary);
            
            console.log('✅ Itinéraire calculé et affiché');
            showNotification('🧭 Itinéraire GPS calculé !');
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
        <div style="background: #e8f5e8; padding: 1rem; border-radius: 10px; border-left: 4px solid #27ae60;">
            <h4 style="margin: 0 0 0.5rem 0; color: #27ae60;">🧭 Navigation GPS</h4>
            <p style="margin: 0 0 0.5rem 0; font-weight: bold;">${instruction}</p>
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
        calculateRoute(userPosition, checkpoint);
    }
}

// Exposer les fonctions pour les tests et les popups
window.simulatePosition = simulatePosition;
window.calculateRouteFromPopup = calculateRouteFromPopup;

console.log('✅ Script du jeu de piste chargé avec succès !');
