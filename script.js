// Configuration du jeu de piste - Version Test
const GAME_CONFIG = {
    // Centre de la zone de test
    center: [49.0928, 6.1907],
    zoom: 16,
    // Distance en mètres pour déclencher un indice
    proximityThreshold: 50,
    // Points d'intérêt avec coordonnées et indices
    checkpoints: [
        {
            id: 1,
            name: "Point de Départ",
            coordinates: [49.09568858396698, 6.189477252799626],
            emoji: "🚀",
            clue: {
                title: "Premier Point Découvert !",
                text: "Félicitations ! Vous avez trouvé le premier point. Pour débloquer le deuxième point et obtenir sa position GPS, vous devez résoudre cette énigme simple :",
                riddle: {
                    question: "Combien font 1 + 1 ?",
                    answer: "2",
                    hint: "C'est une addition très simple !"
                }
            },
            hint: "Trouvez le point de départ de votre aventure !"
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
            hint: "Ce point sera débloqué après avoir résolu l'énigme du premier point."
        }
    ]
};

// Variables globales
let map;
let userMarker;
let userPosition = null;
let foundCheckpoints = [];
let checkpointMarkers = [];
let unlockedCheckpoints = [1]; // Le premier point est débloqué par défaut

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    console.log('🚀 Initialisation du jeu de piste Turin...');
    
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
        
        // Ajouter le cercle de proximité (buffer de 50m)
        const circle = L.circle(checkpoint.coordinates, {
            color: isLocked ? '#95a5a6' : isFound ? '#27ae60' : '#3498db',
            fillColor: isLocked ? '#95a5a6' : isFound ? '#27ae60' : '#3498db',
            fillOpacity: 0.1,
            radius: GAME_CONFIG.proximityThreshold,
            weight: 2,
            opacity: 0.6
        }).addTo(map);
        
        let markerClass = 'checkpoint-marker';
        if (isFound) markerClass += ' found';
        if (isLocked) markerClass += ' locked';
        
        const markerIcon = L.divIcon({
            className: markerClass,
            html: isLocked ? '🔒' : checkpoint.emoji,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const marker = L.marker(checkpoint.coordinates, { icon: markerIcon })
            .addTo(map)
            .bindPopup(`
                <div style="text-align: center;">
                    <h3>${isLocked ? '🔒' : checkpoint.emoji} ${checkpoint.name}</h3>
                    <p>${isFound ? '✅ Découvert !' : isLocked ? '🔒 Verrouillé' : '🔍 À découvrir'}</p>
                    ${!isFound && !isLocked ? `<p><em>${checkpoint.hint}</em></p>` : ''}
                    ${isLocked ? `<p><em>${checkpoint.hint}</em></p>` : ''}
                    <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
                </div>
            `);
        
        checkpointMarkers.push({
            id: checkpoint.id,
            marker: marker,
            circle: circle,
            checkpoint: checkpoint
        });
    });
    
    console.log(`✅ ${GAME_CONFIG.checkpoints.length} checkpoints ajoutés avec zones de ${GAME_CONFIG.proximityThreshold}m`);
}

function checkProximityToCheckpoints() {
    if (!userPosition) return;
    
    GAME_CONFIG.checkpoints.forEach(checkpoint => {
        if (foundCheckpoints.includes(checkpoint.id)) return;
        
        // Vérifier si le checkpoint est débloqué
        const isUnlocked = unlockedCheckpoints.includes(checkpoint.id);
        if (checkpoint.locked && !isUnlocked) return;
        
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
        markerData.marker.setPopupContent(`
            <div style="text-align: center;">
                <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                <p>✅ Découvert !</p>
                <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
            </div>
        `);
        
        // Mettre à jour le cercle en vert
        markerData.circle.setStyle({
            color: '#27ae60',
            fillColor: '#27ae60'
        });
    }
    
    // Afficher l'indice
    showClue(checkpoint.clue);
    
    // Mettre à jour l'interface
    updateUI();
    
    // Vérifier si le jeu est terminé
    if (foundCheckpoints.length === GAME_CONFIG.checkpoints.length) {
        setTimeout(() => {
            showSuccessModal();
        }, 2000);
    }
    
    // Notification
    showNotification(`🎉 ${checkpoint.name} découvert !`);
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
        
        // Débloquer le deuxième point
        unlockCheckpoint(2);
        
        setTimeout(() => {
            document.getElementById('riddle-modal').style.display = 'none';
            showNotification('🎯 Deuxième point débloqué ! Consultez la carte pour voir sa position.');
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
    
    // Mettre à jour le marqueur et le cercle sur la carte
    const markerData = checkpointMarkers.find(m => m.id === checkpointId);
    if (markerData) {
        const checkpoint = markerData.checkpoint;
        
        // Mettre à jour le marqueur
        const newIcon = L.divIcon({
            className: 'checkpoint-marker',
            html: checkpoint.emoji,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        markerData.marker.setIcon(newIcon);
        markerData.marker.setPopupContent(`
            <div style="text-align: center;">
                <h3>${checkpoint.emoji} ${checkpoint.name}</h3>
                <p>🔍 À découvrir</p>
                <p><em>${checkpoint.hint}</em></p>
                <p><small>Zone de déclenchement: ${GAME_CONFIG.proximityThreshold}m</small></p>
            </div>
        `);
        
        // Mettre à jour le cercle
        markerData.circle.setStyle({
            color: '#3498db',
            fillColor: '#3498db'
        });
        
        // Centrer la carte sur le nouveau point débloqué
        centerMapOnCheckpoint(checkpoint);
    }
    
    updateHint();
    console.log(`🔓 Checkpoint ${checkpointId} débloqué !`);
}

function centerMapOnCheckpoint(checkpoint) {
    console.log(`🎯 Centrage de la carte sur ${checkpoint.name}`);
    
    // Animation fluide vers le nouveau point
    map.flyTo(checkpoint.coordinates, GAME_CONFIG.zoom, {
        animate: true,
        duration: 2 // 2 secondes d'animation
    });
    
    // Optionnel : faire clignoter le marqueur
    setTimeout(() => {
        const markerData = checkpointMarkers.find(m => m.id === checkpoint.id);
        if (markerData) {
            markerData.marker.openPopup();
        }
    }, 2500); // Ouvrir le popup après l'animation
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
    
    const percentage = (foundCheckpoints.length / GAME_CONFIG.checkpoints.length) * 100;
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${foundCheckpoints.length} / ${GAME_CONFIG.checkpoints.length} indices trouvés`;
}

function updateHint() {
    const hintText = document.getElementById('hint-text');
    
    if (!userPosition) {
        hintText.textContent = 'Trouvez votre position pour commencer l\'aventure !';
        return;
    }
    
    if (foundCheckpoints.length === GAME_CONFIG.checkpoints.length) {
        hintText.textContent = '🎉 Félicitations ! Vous avez terminé le jeu de piste !';
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
                Math.round(distance) + ' m'}</small>
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

// Exposer la fonction de simulation pour les tests
window.simulatePosition = simulatePosition;

console.log('✅ Script du jeu de piste chargé avec succès !');
