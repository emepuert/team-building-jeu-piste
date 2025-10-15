// Script Admin - Jeu de Piste
console.log('🔧 Admin Script chargé');

// Variables globales
let firebaseService = null;
let firebaseAuth = null;
let isAuthenticated = false;
let currentUser = null;
let teamsData = [];
let validationsData = [];
let helpRequestsData = [];
// let usersData = []; // Supprimé - 1 équipe = 1 joueur
let managementTeamsData = [];
let checkpointsData = [];
let currentEditingCheckpointId = null;

// Configuration admin - Emails autorisés
const ADMIN_CONFIG = {
    authorizedEmails: [
        'tran@go-inicio.com',
        'admin@go-inicio.com',
        'backup@go-inicio.com',
        'support@go-inicio.com'
        // Ajoutez d'autres admins ici
    ]
};

// Initialisation de l'admin
function initializeAdmin() {
    console.log('🚀 Initialisation interface admin...');
    
    // Initialiser Firebase Service et Auth
    if (window.firebaseService && window.firebaseAuth) {
        firebaseService = window.firebaseService;
        firebaseAuth = window.firebaseAuth;
        console.log('✅ Firebase Service et Auth initialisés pour admin');
        
        // Écouter les changements d'authentification
        setupAuthStateListener();
    } else {
        console.error('❌ Firebase Service ou Auth non disponible');
        return;
    }
    
    // Configurer les événements
    setupAuthEvents();
}

// Écouter les changements d'état d'authentification
function setupAuthStateListener() {
    if (!firebaseAuth) return;
    
    // Import dynamique des fonctions Firebase Auth
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
        .then(({ onAuthStateChanged }) => {
            onAuthStateChanged(firebaseAuth, (user) => {
                if (user && isAuthorizedEmail(user.email)) {
                    // Utilisateur connecté et autorisé
                    currentUser = user;
                    isAuthenticated = true;
                    showAdminInterface();
                    console.log('✅ Admin connecté:', user.email);
                } else if (user) {
                    // Utilisateur connecté mais non autorisé
                    console.warn('🚨 Email non autorisé:', user.email);
                    handleLogout();
                    showAuthError('Email non autorisé pour l\'administration');
                } else {
                    // Utilisateur déconnecté
                    currentUser = null;
                    isAuthenticated = false;
                    showAuthModal();
                }
            });
        });
}

// Vérifier si l'email est autorisé
function isAuthorizedEmail(email) {
    return ADMIN_CONFIG.authorizedEmails.includes(email);
}

// Afficher le modal d'authentification
function showAuthModal() {
    document.getElementById('admin-auth-modal').style.display = 'flex';
}

// Cacher le modal d'authentification
function hideAuthModal() {
    document.getElementById('admin-auth-modal').style.display = 'none';
}

// Afficher l'interface admin
function showAdminInterface() {
    hideAuthModal();
    document.getElementById('admin-interface').style.display = 'block';
    
    // Démarrer la synchronisation temps réel
    startRealtimeSync();
    
    // Configurer les événements de l'interface
    setupAdminEvents();
    
    // Charger les données de gestion
    loadManagementData();
    
    // Initialiser la carte de tracking
    setTimeout(() => {
        initializeTrackingMap();
        // Démarrer les mises à jour automatiques
        startTrackingUpdates();
    }, 500);
    
    showNotification('✅ Connexion admin réussie', 'success');
}

// Configuration des événements d'authentification
function setupAuthEvents() {
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('admin-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Connexion
    loginBtn.addEventListener('click', handleLogin);
    
    // Connexion avec Enter
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    });
    
    // Déconnexion
    logoutBtn.addEventListener('click', handleLogout);
}

// Gestion de la connexion Firebase
async function handleLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('auth-error');
    const loadingDiv = document.getElementById('auth-loading');
    
    // Validation basique
    if (!email || !password) {
        showAuthError('Veuillez remplir tous les champs');
        return;
    }
    
    // Vérifier si l'email est autorisé
    if (!isAuthorizedEmail(email)) {
        showAuthError('Email non autorisé pour l\'administration');
        return;
    }
    
    try {
        // Afficher le loading
        errorDiv.style.display = 'none';
        loadingDiv.style.display = 'block';
        
        // Import dynamique de signInWithEmailAndPassword
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        // Connexion Firebase
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        console.log('✅ Connexion Firebase réussie:', userCredential.user.email);
        
        // Le reste est géré par onAuthStateChanged
        
    } catch (error) {
        console.error('❌ Erreur de connexion:', error);
        
        let errorMessage = 'Erreur de connexion';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Utilisateur non trouvé';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Mot de passe incorrect';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email invalide';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Trop de tentatives. Réessayez plus tard.';
                break;
            default:
                errorMessage = error.message;
        }
        
        showAuthError(errorMessage);
        
        // Log des tentatives de connexion (sécurité)
        console.warn('🚨 Tentative de connexion admin échouée:', {
            email,
            error: error.code,
            timestamp: new Date().toISOString()
        });
        
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Afficher une erreur d'authentification
function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Vider les champs
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-password').value = '';
}

// Gestion de la déconnexion Firebase
async function handleLogout() {
    try {
        // Import dynamique de signOut
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        await signOut(firebaseAuth);
        console.log('✅ Déconnexion Firebase réussie');
        
        // Le reste est géré par onAuthStateChanged
        showNotification('👋 Déconnexion réussie', 'info');
        
    } catch (error) {
        console.error('❌ Erreur de déconnexion:', error);
        showNotification('Erreur lors de la déconnexion', 'error');
    }
}

// Configuration des événements de l'interface admin
function setupAdminEvents() {
    // Actions rapides
    document.getElementById('reset-all-teams').addEventListener('click', resetAllTeams);
    document.getElementById('reset-all-progressions').addEventListener('click', resetAllProgressions);
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('refresh-data').addEventListener('click', refreshData);
    // Debug : vérifier si les boutons existent
    const fixConsistencyBtn = document.getElementById('fix-consistency-btn');
    const cleanupUsersBtn = document.getElementById('cleanup-users-btn');
    const cleanupAllBtn = document.getElementById('cleanup-all-btn');
    
    console.log('🔍 Debug boutons nettoyage:', {
        fixConsistencyBtn: !!fixConsistencyBtn,
        cleanupUsersBtn: !!cleanupUsersBtn,
        cleanupAllBtn: !!cleanupAllBtn
    });
    
    if (fixConsistencyBtn) {
        fixConsistencyBtn.addEventListener('click', () => {
            console.log('🔧 Clic sur correction cohérence');
            fixTeamDataConsistency();
        });
    } else {
        console.warn('❌ Bouton fix-consistency-btn non trouvé');
    }
    
    if (cleanupUsersBtn) {
        cleanupUsersBtn.addEventListener('click', () => {
            console.log('🧹 Clic sur nettoyage users');
            cleanupAllUsers();
        });
    } else {
        console.warn('❌ Bouton cleanup-users-btn non trouvé');
    }
    
    if (cleanupAllBtn) {
        cleanupAllBtn.addEventListener('click', () => {
            console.log('🚨 Clic sur nettoyage complet');
            cleanupAllData();
        });
    } else {
        console.warn('❌ Bouton cleanup-all-btn non trouvé');
    }
    
    // Bouton de rafraîchissement des équipes
    document.getElementById('refresh-teams-btn')?.addEventListener('click', () => {
        showNotification('🔄 Actualisation manuelle...', 'info');
        loadManagementData();
    });
    
    // Gestion équipes seulement - 1 équipe = 1 joueur
    document.getElementById('create-team-btn').addEventListener('click', showCreateTeamModal);
    
    // Gestion checkpoints et parcours
    document.getElementById('create-checkpoint-btn').addEventListener('click', showCreateCheckpointModal);
    document.getElementById('create-route-btn').addEventListener('click', showCreateRouteModal);
    document.getElementById('show-routes-map-btn').addEventListener('click', showRoutesMapModal);
    
    // Logs de debug
    document.getElementById('load-logs-btn').addEventListener('click', loadDebugLogs);
    document.getElementById('download-logs-btn').addEventListener('click', downloadDebugLogsFile);
    document.getElementById('delete-team-logs-btn').addEventListener('click', deleteTeamLogs);
    document.getElementById('delete-all-logs-btn').addEventListener('click', deleteAllLogs);
    
    // Modals
    setupModalEvents();
}

// Synchronisation temps réel
function startRealtimeSync() {
    if (!firebaseService) return;
    
    console.log('🔄 Démarrage synchronisation temps réel admin...');
    
    // Écouter toutes les équipes
    firebaseService.onAllTeamsChange((teams) => {
        console.log('📊 Mise à jour équipes:', teams);
        teamsData = teams;
        updateTeamsDisplay();
        updateStats();
        
        // Mettre à jour aussi les données de gestion
        managementTeamsData = teams;
        updateTeamsManagementDisplay();
        updateConfigurationStatus();
        
        // Mettre à jour l'heure de dernière mise à jour
        updateLastUpdateTime();
        
        // Mettre à jour la carte de tracking si elle est initialisée
        if (trackingMap) {
            updateTrackingMap();
        }
    });
    
    // Plus de synchronisation utilisateurs - 1 équipe = 1 joueur
    
    // Système de validation (pour les photos)
    firebaseService.onValidationRequests((validations) => {
        console.log('⏳ Validations en attente:', validations);
        validationsData = validations;
        updateValidationsDisplay();
        updateStats();
    });
    
    // Écouter les demandes d'aide
    firebaseService.onHelpRequests((helpRequests) => {
        console.log('🆘 Demandes d\'aide reçues:', helpRequests);
        console.log('🔍 Nombre de demandes:', helpRequests.length);
        helpRequestsData = helpRequests;
        updateHelpRequestsDisplay();
        updateStats();
        
        // Debug: afficher une notification si nouvelle demande
        if (helpRequests.length > 0) {
            console.log('📢 Nouvelle demande d\'aide détectée !');
        }
    });
}

// Mise à jour de l'affichage des équipes
function updateTeamsDisplay() {
    const teamsContainer = document.getElementById('teams-list');
    
    if (teamsData.length === 0) {
        teamsContainer.innerHTML = '<p class="no-data">Aucune équipe active</p>';
        return;
    }
    
    teamsContainer.innerHTML = teamsData.map(team => `
        <div class="team-card">
            <div class="team-header">
                <span class="team-name">${team.name}</span>
                <span class="team-status status-${getTeamStatus(team)}">${getTeamStatusText(team)}</span>
            </div>
            
            <div class="team-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${getTeamProgress(team)}%"></div>
                </div>
                <small>${team.foundCheckpoints.filter(id => {
                    const cp = checkpointsData.find(c => c.id === id);
                    return cp && !cp.isLobby;
                }).length} / ${team.route.filter(id => {
                    const cp = checkpointsData.find(c => c.id === id);
                    return cp && !cp.isLobby;
                }).length} défis résolus (validés)</small>
            </div>
            
            <div class="team-info">
                <p><strong>📋 Progression du parcours:</strong></p>
                <div class="route-progress">
                    ${getRouteProgressDisplay(team)}
                </div>
                <p><strong>📍 Prochain objectif:</strong> ${getNextUnlockedCheckpoint(team)}</p>
                <p><strong>Créée:</strong> ${formatDate(team.createdAt)}</p>
            </div>
            
            <div class="team-actions">
                <button class="reset-btn" onclick="resetTeam('${team.id}')">
                    🔄 Reset équipe
                </button>
                <button class="warning-btn" onclick="resetTeamProgression('${team.id}')">
                    🏠 Reset → Lobby
                </button>
                <button class="info-btn" onclick="showTeamDetails('${team.id}')">
                    📊 Détails
                </button>
            </div>
        </div>
    `).join('');
}

// Mise à jour de l'affichage des validations
function updateValidationsDisplay() {
    const validationsContainer = document.getElementById('pending-validations');
    
    if (validationsData.length === 0) {
        validationsContainer.innerHTML = '<p class="no-data">Aucune validation en attente</p>';
        return;
    }
    
    validationsContainer.innerHTML = validationsData.map(validation => {
        const team = teamsData.find(t => t.id === validation.teamId);
        const teamName = team ? team.name : 'Équipe inconnue';
        const checkpoint = checkpointsData.find(cp => cp.id === validation.checkpointId);
        const checkpointName = checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `Point ${validation.checkpointId}`;
        
        let contentHTML = '';
        
        if (validation.type === 'photo') {
            try {
                const data = JSON.parse(validation.data);
                const sizeKB = Math.round(data.size / 1024);
                
                contentHTML = `
                    <div class="photo-validation">
                        <img src="${data.photo}" alt="Photo validation" style="max-width: 100%; max-height: 300px; border-radius: 10px; margin: 1rem 0;">
                        <p><strong>Taille:</strong> ${sizeKB} KB</p>
                        <p><strong>Envoyée:</strong> ${new Date(data.timestamp).toLocaleString('fr-FR')}</p>
                    </div>
                `;
            } catch (error) {
                contentHTML = `<p><strong>Données:</strong> ${validation.data}</p>`;
            }
        } else {
            contentHTML = `<p><strong>Données:</strong> ${validation.data}</p>`;
        }
        
        return `
            <div class="validation-card">
                <div class="validation-header">
                    <div>
                        <h4>${teamName} - ${checkpointName}</h4>
                        <span class="validation-type">${validation.type === 'photo' ? '📸 PHOTO' : validation.type.toUpperCase()}</span>
                    </div>
                    <small>${formatDate(validation.createdAt)}</small>
                </div>
                
                <div class="validation-content">
                    ${contentHTML}
                </div>
                
                <div class="validation-actions">
                    <button class="approve-btn" onclick="approveValidation('${validation.id}')">
                        ✅ Approuver
                    </button>
                    <button class="reject-btn" onclick="rejectValidation('${validation.id}')">
                        ❌ Rejeter
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Mise à jour de l'affichage des demandes d'aide
function updateHelpRequestsDisplay() {
    const helpRequestsContainer = document.getElementById('help-requests-list');
    
    if (helpRequestsData.length === 0) {
        helpRequestsContainer.innerHTML = '<p class="no-data">Aucune demande d\'aide en attente</p>';
        return;
    }
    
    helpRequestsContainer.innerHTML = helpRequestsData.map(helpRequest => {
        const team = teamsData.find(t => t.id === helpRequest.teamId);
        const teamName = team ? team.name : 'Équipe inconnue';
        
        // Trouver les infos du checkpoint
        const checkpoint = checkpointsData.find(cp => cp.id === helpRequest.checkpointId);
        const checkpointName = checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `Point ${helpRequest.checkpointId}`;
        
        console.log(`🔍 Debug demande d'aide:`, {
            helpRequest,
            checkpointsData: checkpointsData.length,
            checkpoint,
            checkpointName
        });
        
        const typeText = helpRequest.type === 'location' ? 'Localisation' : 
                        helpRequest.type === 'riddle' ? 'Énigme' : 
                        helpRequest.type === 'audio' ? 'Épreuve Audio' :
                        helpRequest.type === 'qcm' ? 'QCM' :
                        helpRequest.type === 'photo' ? 'Validation Photo' : 'Aide';
        const typeIcon = helpRequest.type === 'location' ? '📍' : 
                        helpRequest.type === 'riddle' ? '🧩' : 
                        helpRequest.type === 'audio' ? '🎤' :
                        helpRequest.type === 'qcm' ? '📋' :
                        helpRequest.type === 'photo' ? '📸' : '❓';
        
        return `
            <div class="help-request-card">
                <div class="help-request-header">
                    <div>
                        <h4>${teamName} - ${checkpointName}</h4>
                        <span class="help-request-type ${helpRequest.type}">${typeIcon} ${typeText}</span>
                    </div>
                    <small>${formatDate(helpRequest.createdAt)}</small>
                </div>
                
                <div class="help-request-content">
                    <p><strong>Message:</strong> ${helpRequest.message}</p>
                </div>
                
                <div class="help-request-actions">
                    <button class="grant-btn" onclick="grantHelpRequest('${helpRequest.id}')">
                        ✅ Accorder l'aide
                    </button>
                    <button class="deny-btn" onclick="denyHelpRequest('${helpRequest.id}')">
                        ❌ Refuser
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Mise à jour des statistiques
function updateStats() {
    document.getElementById('active-teams-count').textContent = teamsData.filter(t => t.status === 'active').length;
    document.getElementById('pending-validations-count').textContent = validationsData.length; // Réactivé pour les photos
    document.getElementById('help-requests-count').textContent = helpRequestsData.length;
    document.getElementById('completed-teams-count').textContent = teamsData.filter(t => getTeamStatus(t) === 'completed').length;
}

// Fonctions utilitaires
function getTeamStatus(team) {
    if (team.foundCheckpoints.length >= team.route.length) return 'completed';
    if (team.status === 'active') return 'active';
    return 'stuck';
}

function getTeamStatusText(team) {
    const status = getTeamStatus(team);
    switch (status) {
        case 'completed': return 'Terminée';
        case 'active': return 'Active';
        case 'stuck': return 'Bloquée';
        default: return 'Inconnue';
    }
}

function getTeamProgress(team) {
    // ⚡ CORRIGER : Exclure le lobby par sa propriété isLobby, pas par ID
    const nonLobbyFound = team.foundCheckpoints.filter(id => {
        const cp = checkpointsData.find(c => c.id === id);
        return cp && !cp.isLobby;
    });
    
    const nonLobbyTotal = team.route.filter(id => {
        const cp = checkpointsData.find(c => c.id === id);
        return cp && !cp.isLobby;
    }).length;
    
    if (nonLobbyTotal === 0) return 0;
    
    // ⚠️ IMPORTANT: On compte SEULEMENT les checkpoints réellement trouvés (foundCheckpoints)
    // Les photos en attente de validation ne sont PAS comptées comme trouvées
    console.log(`📊 Progression ${team.name}: ${nonLobbyFound.length}/${nonLobbyTotal} (${Math.round((nonLobbyFound.length / nonLobbyTotal) * 100)}%)`, {
        foundCheckpoints: team.foundCheckpoints,
        nonLobbyFound: nonLobbyFound,
        nonLobbyTotal: nonLobbyTotal,
        route: team.route
    });
    
    return Math.round((nonLobbyFound.length / nonLobbyTotal) * 100);
}

function getCurrentCheckpointName(team) {
    // Logique pour obtenir le nom du checkpoint actuel
    return `Checkpoint ${team.currentCheckpoint}`;
}

function getRouteProgressDisplay(team) {
    const foundCheckpoints = team.foundCheckpoints || [];
    const unlockedCheckpoints = team.unlockedCheckpoints || [0];
    const teamRoute = team.route || [];
    
    if (teamRoute.length === 0) {
        return '<span style="color: #e74c3c;">❌ Aucun parcours défini</span>';
    }
    
    let progressHTML = '';
    
    teamRoute.forEach((checkpointId, index) => {
        const isFound = foundCheckpoints.includes(checkpointId);
        const isUnlocked = unlockedCheckpoints.includes(checkpointId);
        
        // Trouver les infos du checkpoint
        const checkpoint = checkpointsData.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `Point ${checkpointId}`;
        const isLobby = checkpoint && checkpoint.isLobby;
        
        // Déterminer le statut et la couleur
        let statusIcon, statusText, statusColor;
        
        if (isFound) {
            statusIcon = '✅';
            statusText = 'validé';
            statusColor = '#27ae60';
        } else if (isUnlocked) {
            statusIcon = '🔓';
            statusText = 'débloqué';
            statusColor = '#f39c12';
        } else {
            statusIcon = '⏳';
            statusText = 'verrouillé';
            statusColor = '#95a5a6';
        }
        
        // Boutons d'action
        let actionsHTML = '';
        
        if (!isFound) {
            // Checkpoint pas encore validé
            
            // Bouton DÉBLOQUER (rend visible sans valider)
            if (isLobby) {
                actionsHTML += `<button class="mini-btn" disabled title="Lobby déjà visible">📍 Visible</button>`;
            } else {
                actionsHTML += `<button class="mini-btn locate-btn" onclick="locateCheckpoint('${team.id}', ${checkpointId})" title="Débloquer le checkpoint (rendre visible)">🔓 Débloquer</button>`;
            }
            
            // Bouton VALIDER (marque trouvé + passe au suivant)
            actionsHTML += `<button class="mini-btn validate-btn" onclick="validateCheckpoint('${team.id}', ${checkpointId})" title="Valider comme trouvé et débloquer le suivant">✅ Valider</button>`;
        }
        
        progressHTML += `
            <div class="checkpoint-progress-item" style="border-left: 3px solid ${statusColor}; padding-left: 10px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: ${statusColor};">
                        ${statusIcon} ${index + 1}. ${checkpointName} <small>(${statusText})</small>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        ${actionsHTML}
                    </div>
                </div>
            </div>
        `;
    });
    
    return progressHTML;
}

function getNextUnlockedCheckpoint(team) {
    const currentUnlocked = team.unlockedCheckpoints || [0];
    const foundCheckpoints = team.foundCheckpoints || [];
    const teamRoute = team.route || [];
    
    console.log(`🔍 Debug getNextUnlockedCheckpoint pour ${team.name}:`, {
        route: teamRoute,
        found: foundCheckpoints,
        unlocked: currentUnlocked
    });
    
    // Chercher le PREMIER checkpoint de la route qui est DÉBLOQUÉ mais PAS TROUVÉ
    for (const checkpointId of teamRoute) {
        if (checkpointId === 0) continue; // Ignorer le lobby
        
        const isUnlocked = currentUnlocked.includes(checkpointId);
        const isFound = foundCheckpoints.includes(checkpointId);
        
        console.log(`  Checkpoint ${checkpointId}: unlocked=${isUnlocked}, found=${isFound}`);
        
        if (isUnlocked && !isFound) {
            // C'est le prochain objectif !
            const checkpoint = checkpointsData.find(cp => cp.id === checkpointId);
            const result = checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `🎯 Point ${checkpointId}`;
            console.log(`  ➡️ Prochain objectif: ${result}`);
            return result;
        }
    }
    
    // Si aucun checkpoint débloqué non trouvé, chercher le prochain à débloquer
    for (const checkpointId of teamRoute) {
        if (checkpointId === 0) continue; // Ignorer le lobby
        
        if (!currentUnlocked.includes(checkpointId)) {
            console.log(`  ➡️ À débloquer: Point ${checkpointId}`);
            return `🔒 Point ${checkpointId} (à débloquer)`;
        }
    }
    
    console.log(`  ➡️ Parcours terminé`);
    return '🏆 Parcours terminé';
}

function getTeamName(teamId) {
    const team = teamsData.find(t => t.id === teamId);
    return team ? team.name : 'Équipe inconnue';
}

function getCheckpointName(checkpointId) {
    return `Point ${checkpointId}`;
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    // Gérer les timestamps Firebase
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('fr-FR');
}

// Actions admin
// Localiser un checkpoint (débloquer dans unlockedCheckpoints SANS valider)
async function locateCheckpoint(teamId, checkpointId) {
    try {
        const team = teamsData.find(t => t.id === teamId);
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        const unlockedCheckpoints = team.unlockedCheckpoints || [0];
        
        // Vérifier si déjà débloqué
        if (unlockedCheckpoints.includes(checkpointId)) {
            showNotification('Checkpoint déjà débloqué', 'warning');
            return;
        }
        
        // Ajouter aux checkpoints débloqués (visible mais pas validé)
        const updatedUnlocked = [...unlockedCheckpoints, checkpointId];
        
        await firebaseService.updateTeamProgress(teamId, {
            unlockedCheckpoints: updatedUnlocked
        });
        
        // Trouver le nom du checkpoint
        const checkpoint = checkpointsData.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${checkpointId}`;
        
        console.log(`📍 Admin débloque checkpoint ${checkpointId} (${checkpointName}) pour équipe ${team.name}`);
        showNotification(`📍 "${checkpointName}" débloqué pour ${team.name}`, 'success');
        
        // Logger l'action admin
        await firebaseService.createAdminLog(
            'checkpoint_unlocked',
            `📍 Checkpoint débloqué: "${checkpointName}"`,
            teamId,
            { checkpointId, checkpointName }
        );
        
    } catch (error) {
        console.error('Erreur déblocage checkpoint:', error);
        showNotification('❌ Erreur lors du déblocage', 'error');
    }
}

// Valider un checkpoint (ajouter à foundCheckpoints + débloquer le suivant)
async function validateCheckpoint(teamId, checkpointId) {
    try {
        const team = teamsData.find(t => t.id === teamId);
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        const foundCheckpoints = team.foundCheckpoints || [];
        const unlockedCheckpoints = team.unlockedCheckpoints || [0];
        const teamRoute = team.route || [];
        
        // Vérifier si déjà validé
        if (foundCheckpoints.includes(checkpointId)) {
            showNotification('⚠️ Checkpoint déjà validé', 'warning');
            return;
        }
        
        // Ajouter aux checkpoints trouvés
        const updatedFound = [...foundCheckpoints, checkpointId];
        
        // Trouver le checkpoint suivant dans la route
        const currentIndex = teamRoute.indexOf(checkpointId);
        let nextCheckpointId = null;
        
        if (currentIndex !== -1 && currentIndex < teamRoute.length - 1) {
            nextCheckpointId = teamRoute[currentIndex + 1];
        }
        
        // Préparer les checkpoints débloqués
        let updatedUnlocked = [...unlockedCheckpoints];
        
        // S'assurer que le checkpoint validé est dans les débloqués
        if (!updatedUnlocked.includes(checkpointId)) {
            updatedUnlocked.push(checkpointId);
        }
        
        // Débloquer le suivant s'il existe
        if (nextCheckpointId && !updatedUnlocked.includes(nextCheckpointId)) {
            updatedUnlocked.push(nextCheckpointId);
        }
        
        // Mettre à jour Firebase
        await firebaseService.updateTeamProgress(teamId, {
            foundCheckpoints: updatedFound,
            unlockedCheckpoints: updatedUnlocked
        });
        
        // Trouver les noms des checkpoints
        const checkpoint = checkpointsData.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${checkpointId}`;
        
        let message = `✅ "${checkpointName}" validé pour ${team.name}`;
        
        if (nextCheckpointId) {
            const nextCheckpoint = checkpointsData.find(cp => cp.id === nextCheckpointId);
            const nextCheckpointName = nextCheckpoint ? nextCheckpoint.name : `Point ${nextCheckpointId}`;
            message += ` → "${nextCheckpointName}" débloqué`;
        }
        
        console.log(`✅ Admin valide checkpoint ${checkpointId} (${checkpointName}) pour équipe ${team.name}`);
        showNotification(message, 'success');
        
        // Logger l'action admin
        await firebaseService.createAdminLog(
            'checkpoint_validated',
            `✅ Checkpoint validé: "${checkpointName}"${nextCheckpointId ? ` → Suivant débloqué` : ''}`,
            teamId,
            { checkpointId, checkpointName, nextCheckpointId }
        );
        
    } catch (error) {
        console.error('Erreur validation checkpoint:', error);
        showNotification('❌ Erreur lors de la validation', 'error');
    }
}

async function resetTeam(teamId) {
    if (!confirm('Êtes-vous sûr de vouloir reset cette équipe ?')) return;
    
    try {
        const team = teamsData.find(t => t.id === teamId);
        await firebaseService.resetTeam(teamId);
        showNotification(`🔄 Équipe ${team?.name} resetée`, 'success');
        
        // 📝 Logger l'action admin pour les users
        await firebaseService.createAdminLog(
            'team_reset',
            `🔄 Équipe réinitialisée par l'admin`,
            teamId,
            { teamName: team?.name }
        );
    } catch (error) {
        console.error('Erreur reset équipe:', error);
        showNotification('❌ Erreur lors du reset', 'error');
    }
}

async function approveValidation(validationId) {
    try {
        console.log('🔍 Debug approveValidation:', {
            validationId,
            validationsData: validationsData.length,
            validations: validationsData.map(v => ({ id: v.id, teamId: v.teamId, checkpointId: v.checkpointId }))
        });
        
        // Récupérer les infos de la validation avant de l'approuver
        const validation = validationsData.find(v => v.id === validationId);
        if (!validation) {
            console.error('❌ Validation non trouvée:', { validationId, available: validationsData.map(v => v.id) });
            showNotification('Validation non trouvée', 'error');
            return;
        }
        
        console.log('✅ Validation trouvée:', validation);
        
        // Approuver la validation
        await firebaseService.updateValidation(validationId, 'approved', 'Validé par admin');
        
        // Marquer le checkpoint comme trouvé pour l'équipe
        const team = teamsData.find(t => t.id === validation.teamId);
        if (team) {
            const foundCheckpoints = team.foundCheckpoints || [];
            const unlockedCheckpoints = team.unlockedCheckpoints || [0];
            
            // Ajouter le checkpoint aux trouvés s'il n'y est pas déjà
            if (!foundCheckpoints.includes(validation.checkpointId)) {
                foundCheckpoints.push(validation.checkpointId);
            }
            
            // ✅ TOUJOURS débloquer le checkpoint suivant après validation admin
            const teamRoute = team.route || [];
            const currentIndex = teamRoute.indexOf(validation.checkpointId);
            const nextCheckpointId = currentIndex >= 0 && currentIndex < teamRoute.length - 1
                ? teamRoute[currentIndex + 1]
                : null;
            
            let hasChanges = false;
            
            if (nextCheckpointId && !unlockedCheckpoints.includes(nextCheckpointId)) {
                unlockedCheckpoints.push(nextCheckpointId);
                hasChanges = true;
                console.log(`🔓 Checkpoint suivant débloqué: ${nextCheckpointId}`);
            } else if (nextCheckpointId) {
                console.log(`ℹ️ Checkpoint suivant ${nextCheckpointId} déjà débloqué`);
            } else {
                console.log(`🏁 Dernier checkpoint du parcours atteint`);
            }
            
            // Mettre à jour la progression de l'équipe si des changements
            if (hasChanges || !foundCheckpoints.includes(validation.checkpointId)) {
                await firebaseService.updateTeamProgress(validation.teamId, {
                    foundCheckpoints,
                    unlockedCheckpoints
                });
                
                console.log(`✅ Photo validée et progression mise à jour pour ${team.name}`);
            } else {
                console.log(`ℹ️ Aucun changement nécessaire pour ${team.name}`);
            }
        }
        
        showNotification('✅ Validation approuvée et progression mise à jour', 'success');
        
        // 📝 Logger l'action admin pour les users
        const checkpoint = await firebaseService.getAllCheckpoints().then(cps => 
            cps.find(cp => cp.id === validation.checkpointId)
        );
        const checkpointName = checkpoint ? checkpoint.name : `Checkpoint ${validation.checkpointId}`;
        
        await firebaseService.createAdminLog(
            'validation_approved',
            `✅ Photo validée pour "${checkpointName}"`,
            validation.teamId,
            { checkpointId: validation.checkpointId, checkpointName, validationType: validation.type }
        );
        
    } catch (error) {
        console.error('Erreur approbation:', error);
        showNotification('❌ Erreur lors de l\'approbation', 'error');
    }
}

async function rejectValidation(validationId) {
    const reason = prompt('Raison du rejet (optionnel):') || 'Rejeté par admin';
    
    try {
        // Récupérer les infos de la validation
        const validation = validationsData.find(v => v.id === validationId);
        
        await firebaseService.updateValidation(validationId, 'rejected', reason);
        showNotification('❌ Validation rejetée', 'info');
        
        // 📝 Logger l'action admin pour les users
        if (validation) {
            const checkpoint = await firebaseService.getAllCheckpoints().then(cps => 
                cps.find(cp => cp.id === validation.checkpointId)
            );
            const checkpointName = checkpoint ? checkpoint.name : `Checkpoint ${validation.checkpointId}`;
            
            await firebaseService.createAdminLog(
                'validation_rejected',
                `❌ Photo rejetée pour "${checkpointName}": ${reason}`,
                validation.teamId,
                { checkpointId: validation.checkpointId, checkpointName, reason }
            );
        }
        
    } catch (error) {
        console.error('Erreur rejet:', error);
        showNotification('❌ Erreur lors du rejet', 'error');
    }
}

async function resetAllTeams() {
    if (!confirm('⚠️ ATTENTION: Cela va reset TOUTES les équipes. Continuer ?')) return;
    
    try {
        for (const team of teamsData) {
            await firebaseService.resetTeam(team.id);
        }
        showNotification('🔄 Toutes les équipes ont été resetées', 'success');
    } catch (error) {
        console.error('Erreur reset global:', error);
        showNotification('❌ Erreur lors du reset global', 'error');
    }
}

async function resetAllProgressions() {
    console.log('🔄 Début resetAllProgressions');
    console.log('📊 managementTeamsData:', managementTeamsData);
    console.log('🔍 Longueur:', {teams: managementTeamsData.length});
    
    if (!confirm('🏠 Remettre toutes les équipes au lobby ? Cela va effacer toute la progression actuelle.')) {
        console.log('❌ Reset annulé par l\'utilisateur');
        return;
    }
    
    try {
        showNotification('🔄 Reset des progressions en cours...', 'info');
        console.log('🚀 Début du reset...');
        
        let resetCount = 0;
        
        // Reset chaque équipe (1 équipe = 1 joueur)
        console.log(`🏆 Reset de ${managementTeamsData.length} équipes...`);
        for (const team of managementTeamsData) {
            console.log(`🔄 Reset équipe: ${team.name} (${team.id})`);
            await firebaseService.resetTeam(team.id);
            resetCount++;
            console.log(`✅ Équipe ${team.name} resetée`);
        }
        
        console.log(`🎉 Reset terminé: ${resetCount} équipes`);
        
        // Vider le localStorage pour forcer le rechargement des données
        console.log('🗑️ Nettoyage localStorage...');
        if (typeof(Storage) !== "undefined") {
            // Supprimer les données équipe en cache
            localStorage.removeItem('currentTeamId');
            console.log('✅ localStorage nettoyé');
        }
        
        showNotification(`✅ ${resetCount} équipes remises au lobby ! Rechargez la page du jeu.`, 'success');
        
        // Actualiser les données
        console.log('🔄 Actualisation des données...');
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur reset progressions:', error);
        showNotification('Erreur lors du reset des progressions', 'error');
    }
}

async function resetTeamProgression(teamId) {
    const team = managementTeamsData.find(t => t.id === teamId);
    if (!team) {
        showNotification('Équipe non trouvée', 'error');
        return;
    }
    
    if (!confirm(`🏠 Remettre l'équipe "${team.name}" au lobby ? Cela va effacer sa progression actuelle.`)) {
        return;
    }
    
    try {
        console.log(`🔄 Reset progression équipe: ${team.name} (${teamId})`);
        showNotification(`🔄 Reset de l'équipe "${team.name}" en cours...`, 'info');
        
        // Reset l'équipe
        await firebaseService.resetTeam(teamId);
        console.log(`✅ Équipe ${team.name} resetée`);
        
        // Plus besoin de reset utilisateurs - 1 équipe = 1 joueur
        
        // Vider le localStorage pour cette équipe
        console.log('🗑️ Nettoyage localStorage...');
        if (typeof(Storage) !== "undefined") {
            localStorage.removeItem('currentTeamId');
            console.log('✅ localStorage nettoyé');
        }
        
        console.log(`🎉 Reset équipe "${team.name}" terminé`);
        showNotification(`✅ Équipe "${team.name}" remise au lobby ! L'équipe doit recharger la page.`, 'success');
        
        // Actualiser les données
        loadManagementData();
        
    } catch (error) {
        console.error(`❌ Erreur reset équipe ${team.name}:`, error);
        showNotification(`Erreur lors du reset de l'équipe "${team.name}"`, 'error');
    }
}

function exportData() {
    const data = {
        teams: teamsData,
        validations: validationsData,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeu-piste-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('📊 Données exportées', 'success');
}

function refreshData() {
    // Force un refresh des données
    startRealtimeSync();
    showNotification('🔄 Données actualisées', 'info');
}

// ===== NETTOYAGE FIREBASE =====

async function fixTeamDataConsistency() {
    console.log('🔧 fixTeamDataConsistency() appelée');
    
    if (!confirm('🔧 CORRECTION COHÉRENCE DONNÉES\n\nCela va corriger les incohérences dans les données équipes :\n• Séparer foundCheckpoints et unlockedCheckpoints\n• S\'assurer que le lobby est toujours débloqué\n\nContinuer ?')) {
        console.log('❌ Correction annulée par utilisateur');
        return;
    }
    
    try {
        showNotification('🔧 Correction de la cohérence des données...', 'info');
        
        const fixedCount = await firebaseService.fixTeamDataConsistency();
        
        showNotification(`✅ ${fixedCount} équipes corrigées ! Données maintenant cohérentes.`, 'success');
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur correction cohérence:', error);
        showNotification('❌ Erreur lors de la correction', 'error');
    }
}

async function cleanupAllUsers() {
    console.log('🧹 cleanupAllUsers() appelée');
    
    if (!confirm('🧹 NETTOYAGE UTILISATEURS\n\nCela va supprimer TOUS les utilisateurs de Firebase (obsolètes).\n\n⚠️ Cette action est IRRÉVERSIBLE !\n\nContinuer ?')) {
        console.log('❌ Nettoyage annulé par utilisateur');
        return;
    }
    
    try {
        showNotification('🧹 Nettoyage des utilisateurs obsolètes...', 'info');
        
        const deletedCount = await firebaseService.cleanupAllUsers();
        
        showNotification(`✅ ${deletedCount} utilisateurs obsolètes supprimés de Firebase !`, 'success');
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur nettoyage utilisateurs:', error);
        showNotification('❌ Erreur lors du nettoyage', 'error');
    }
}

// Ouvrir la modale de nettoyage sélectif
function cleanupAllData() {
    console.log('🧹 Ouverture modale nettoyage sélectif');
    const modal = document.getElementById('cleanup-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Fermer la modale
function closeCleanupModal() {
    const modal = document.getElementById('cleanup-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Sélectionner toutes les options
function selectAllCleanup() {
    const checkboxes = document.querySelectorAll('.cleanup-checkbox input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

// Désélectionner toutes les options
function deselectAllCleanup() {
    const checkboxes = document.querySelectorAll('.cleanup-checkbox input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// Confirmer et exécuter le nettoyage sélectif
async function confirmCleanup() {
    // Récupérer les options sélectionnées
    const selected = [];
    const checkboxes = document.querySelectorAll('.cleanup-checkbox input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        showNotification('⚠️ Aucune option sélectionnée', 'warning');
        return;
    }
    
    checkboxes.forEach(cb => selected.push(cb.value));
    
    // Créer le message de confirmation
    const labels = {
        'teams': '🏆 Équipes',
        'users': '👥 Utilisateurs',
        'checkpoints': '📍 Checkpoints',
        'routes': '🛤️ Parcours',
        'validations': '✅ Validations',
        'help_requests': '🆘 Demandes d\'aide',
        'admin_logs': '📝 Logs Admin'
    };
    
    const selectedLabels = selected.map(s => labels[s]).join('\n• ');
    
    if (!confirm(`🚨 CONFIRMATION DE SUPPRESSION\n\nVous allez supprimer :\n• ${selectedLabels}\n\n⚠️ Cette action est IRRÉVERSIBLE !\n\nContinuer ?`)) {
        console.log('❌ Nettoyage annulé par utilisateur');
        return;
    }
    
    // Fermer la modale
    closeCleanupModal();
    
    try {
        showNotification('🧹 Nettoyage en cours...', 'info');
        
        const result = await firebaseService.cleanupSelectedData(selected);
        
        // Construire le message de résultat
        const resultMessages = [];
        if (result.teams > 0) resultMessages.push(`${result.teams} équipes`);
        if (result.users > 0) resultMessages.push(`${result.users} utilisateurs`);
        if (result.checkpoints > 0) resultMessages.push(`${result.checkpoints} checkpoints`);
        if (result.routes > 0) resultMessages.push(`${result.routes} parcours`);
        if (result.validations > 0) resultMessages.push(`${result.validations} validations`);
        if (result.help_requests > 0) resultMessages.push(`${result.help_requests} demandes d'aide`);
        if (result.admin_logs > 0) resultMessages.push(`${result.admin_logs} logs admin`);
        
        showNotification(
            `✅ Nettoyage terminé ! Supprimé : ${resultMessages.join(', ')}`, 
            'success'
        );
        
        // Actualiser l'interface
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur nettoyage sélectif:', error);
        showNotification('❌ Erreur lors du nettoyage : ' + error.message, 'error');
    }
}

function showTeamDetails(teamId) {
    const team = teamsData.find(t => t.id === teamId);
    if (!team) return;
    
    alert(`Détails de ${team.name}:\n\n` +
          `ID: ${team.id}\n` +
          `Statut: ${getTeamStatusText(team)}\n` +
          `Progression: ${getTeamProgress(team)}%\n` +
          `Checkpoints trouvés: ${team.foundCheckpoints.join(', ')}\n` +
          `Checkpoints débloqués: ${team.unlockedCheckpoints.join(', ')}`);
}

function updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('last-update');
    if (lastUpdateElement) {
        const now = new Date();
        lastUpdateElement.textContent = `Dernière mise à jour : ${now.toLocaleTimeString('fr-FR')}`;
        lastUpdateElement.style.color = '#28a745';
        
        // Remettre la couleur normale après 2 secondes
        setTimeout(() => {
            lastUpdateElement.style.color = '#666';
        }, 2000);
    }
}

// Système de notifications
function showNotification(message, type = 'info') {
    const container = document.getElementById('admin-notifications');
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto-suppression après 5 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Variables pour l'autocomplétion
let addressSuggestionsContainer = null;
let currentSuggestionIndex = -1;
let addressSuggestions = [];
let autocompleteTimeout = null;

// Fonction d'autocomplétion des adresses
function setupAddressAutocomplete() {
    const addressInput = document.getElementById('address-search');
    const searchContainer = document.querySelector('.search-container');
    
    // Créer le conteneur de suggestions
    addressSuggestionsContainer = document.createElement('div');
    addressSuggestionsContainer.className = 'address-suggestions';
    addressSuggestionsContainer.style.display = 'none';
    searchContainer.appendChild(addressSuggestionsContainer);
    
    // Écouter les saisies
    addressInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length < 3) {
            hideSuggestions();
            return;
        }
        
        // Débounce pour éviter trop de requêtes
        clearTimeout(autocompleteTimeout);
        autocompleteTimeout = setTimeout(() => {
            fetchAddressSuggestions(query);
        }, 300);
    });
    
    // Navigation au clavier
    addressInput.addEventListener('keydown', (e) => {
        if (addressSuggestions.length === 0) return;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, addressSuggestions.length - 1);
                highlightSuggestion();
                break;
            case 'ArrowUp':
                e.preventDefault();
                currentSuggestionIndex = Math.max(currentSuggestionIndex - 1, -1);
                highlightSuggestion();
                break;
            case 'Enter':
                if (currentSuggestionIndex >= 0) {
                    e.preventDefault();
                    selectSuggestion(addressSuggestions[currentSuggestionIndex]);
                }
                break;
            case 'Escape':
                hideSuggestions();
                break;
        }
    });
    
    // Cacher les suggestions si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            hideSuggestions();
        }
    });
}

async function fetchAddressSuggestions(query) {
    try {
        // Utiliser un proxy CORS pour contourner les restrictions
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
        const response = await fetch(proxyUrl + encodeURIComponent(nominatimUrl));
        const data = await response.json();
        
        addressSuggestions = data;
        displaySuggestions(data);
        
    } catch (error) {
        console.error('❌ Erreur autocomplétion:', error);
        hideSuggestions();
        
        // Si c'est un problème CORS, afficher une aide
        if (error.message.includes('fetch')) {
            console.log('💡 Solution : Cliquez directement sur la carte pour placer le point, ou utilisez les coordonnées manuellement');
        }
    }
}

function displaySuggestions(suggestions) {
    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }
    
    addressSuggestionsContainer.innerHTML = '';
    currentSuggestionIndex = -1;
    
    suggestions.forEach((suggestion, index) => {
        const suggestionEl = document.createElement('div');
        suggestionEl.className = 'address-suggestion';
        suggestionEl.textContent = suggestion.display_name;
        
        suggestionEl.addEventListener('click', () => {
            selectSuggestion(suggestion);
        });
        
        suggestionEl.addEventListener('mouseenter', () => {
            currentSuggestionIndex = index;
            highlightSuggestion();
        });
        
        addressSuggestionsContainer.appendChild(suggestionEl);
    });
    
    addressSuggestionsContainer.style.display = 'block';
}

function highlightSuggestion() {
    const suggestions = addressSuggestionsContainer.querySelectorAll('.address-suggestion');
    suggestions.forEach((el, index) => {
        el.classList.toggle('selected', index === currentSuggestionIndex);
    });
}

function selectSuggestion(suggestion) {
    const addressInput = document.getElementById('address-search');
    addressInput.value = suggestion.display_name;
    
    // Placer le point sur la carte
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    if (checkpointMap) {
        checkpointMap.setView([lat, lng], 16);
        
        // Supprimer le marqueur existant
        if (checkpointMarker) {
            checkpointMap.removeLayer(checkpointMarker);
        }
        
        // Ajouter un marqueur à l'adresse sélectionnée
        checkpointMarker = L.marker([lat, lng]).addTo(checkpointMap);
        
        // Mettre à jour les coordonnées
        selectedCoordinates = { lat, lng };
        document.getElementById('checkpoint-lat').value = lat.toFixed(8);
        document.getElementById('checkpoint-lng').value = lng.toFixed(8);
    }
    
    hideSuggestions();
}

function hideSuggestions() {
    if (addressSuggestionsContainer) {
        addressSuggestionsContainer.style.display = 'none';
    }
    addressSuggestions = [];
    currentSuggestionIndex = -1;
}

// ===== GESTION DES DEMANDES D'AIDE =====

async function grantHelpRequest(helpId) {
    try {
        const helpRequest = helpRequestsData.find(h => h.id === helpId);
        if (!helpRequest) {
            showNotification('Demande d\'aide non trouvée', 'error');
            return;
        }
        
        const team = teamsData.find(t => t.id === helpRequest.teamId);
        const teamName = team ? team.name : 'Équipe inconnue';
        const checkpoint = checkpointsData.find(cp => cp.id === helpRequest.checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${helpRequest.checkpointId}`;
        
    const typeText = helpRequest.type === 'location' ? 'localisation' : 
                    helpRequest.type === 'riddle' ? 'résolution d\'énigme' :
                    helpRequest.type === 'audio' ? 'épreuve audio' :
                    helpRequest.type === 'qcm' ? 'QCM' : 'aide générale';
        
        if (!confirm(`Accorder l'aide (${typeText}) pour "${checkpointName}" à l'équipe "${teamName}" ?`)) {
            return;
        }
        
        showNotification('🔄 Traitement de la demande d\'aide...', 'info');
        
        await firebaseService.resolveHelpRequest(helpId, 'granted', `Aide accordée par admin`);
        
        showNotification(`✅ Aide accordée à l'équipe "${teamName}" pour "${checkpointName}"`, 'success');
        
        // 📝 Logger l'action admin pour les users
        await firebaseService.createAdminLog(
            'help_granted',
            `🆘 Aide accordée pour "${checkpointName}" (${typeText})`,
            helpRequest.teamId,
            { checkpointId: helpRequest.checkpointId, checkpointName, helpType: helpRequest.type }
        );
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'accord d\'aide:', error);
        showNotification('❌ Erreur lors du traitement', 'error');
    }
}

async function denyHelpRequest(helpId) {
    const reason = prompt('Raison du refus (optionnel):') || 'Refusé par admin';
    
    try {
        const helpRequest = helpRequestsData.find(h => h.id === helpId);
        if (!helpRequest) {
            showNotification('Demande d\'aide non trouvée', 'error');
            return;
        }
        
        const team = teamsData.find(t => t.id === helpRequest.teamId);
        const teamName = team ? team.name : 'Équipe inconnue';
        
        showNotification('🔄 Refus de la demande d\'aide...', 'info');
        
        await firebaseService.resolveHelpRequest(helpId, 'denied', reason);
        
        showNotification(`❌ Demande d'aide refusée pour l'équipe "${teamName}"`, 'info');
        
        // 📝 Logger l'action admin pour les users
        const checkpoint = checkpointsData.find(cp => cp.id === helpRequest.checkpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${helpRequest.checkpointId}`;
        
        await firebaseService.createAdminLog(
            'help_denied',
            `❌ Demande d'aide refusée: ${reason}`,
            helpRequest.teamId,
            { checkpointId: helpRequest.checkpointId, checkpointName, reason }
        );
        
    } catch (error) {
        console.error('❌ Erreur lors du refus d\'aide:', error);
        showNotification('❌ Erreur lors du traitement', 'error');
    }
}

// Exposer les fonctions globalement pour les onclick
window.initializeAdmin = initializeAdmin;
window.locateCheckpoint = locateCheckpoint;
window.validateCheckpoint = validateCheckpoint;
window.resetTeam = resetTeam;
window.resetTeamProgression = resetTeamProgression;
window.approveValidation = approveValidation;
window.rejectValidation = rejectValidation;
window.showTeamDetails = showTeamDetails;
window.deleteTeam = deleteTeam;
// window.deleteUser = deleteUser; // Supprimé - 1 équipe = 1 joueur
// window.resetUser = resetUser; // Supprimé - 1 équipe = 1 joueur
window.editTeamRoute = editTeamRoute;
window.editTeam = editTeam;
window.editRoute = editRoute;
window.fixTeamDataConsistency = fixTeamDataConsistency;
window.cleanupAllUsers = cleanupAllUsers;
window.cleanupAllData = cleanupAllData;
window.closeCleanupModal = closeCleanupModal;
window.selectAllCleanup = selectAllCleanup;
window.deselectAllCleanup = deselectAllCleanup;
window.confirmCleanup = confirmCleanup;
window.grantHelpRequest = grantHelpRequest;
window.denyHelpRequest = denyHelpRequest;

    // S'assurer que la modal d'édition est fermée au démarrage
    setTimeout(() => {
        hideEditCheckpointModal();
    }, 100);

    console.log('✅ Admin Script initialisé');

// ===== GESTION DES MODALS =====

function setupModalEvents() {
    // Modal création équipe
    document.getElementById('cancel-team-btn').addEventListener('click', hideCreateTeamModal);
    document.getElementById('create-team-form').addEventListener('submit', handleCreateTeam);
    
    // Modal création utilisateur supprimée - 1 équipe = 1 joueur
    
    // Modal modification parcours équipe
    const cancelEditTeamRouteBtn = document.getElementById('cancel-edit-team-route-btn');
    const editTeamRouteForm = document.getElementById('edit-team-route-form');
    
    if (cancelEditTeamRouteBtn) {
        cancelEditTeamRouteBtn.addEventListener('click', hideEditTeamRouteModal);
    } else {
        console.warn('⚠️ Élément cancel-edit-team-route-btn non trouvé');
    }
    
    if (editTeamRouteForm) {
        editTeamRouteForm.addEventListener('submit', handleEditTeamRoute);
    } else {
        console.warn('⚠️ Élément edit-team-route-form non trouvé');
    }
    
    // Modal création checkpoint
    document.getElementById('cancel-checkpoint-btn').addEventListener('click', hideCreateCheckpointModal);
    document.getElementById('create-checkpoint-form').addEventListener('submit', (e) => {
        e.preventDefault();
        createCheckpoint();
    });
    
    // Modal édition checkpoint
    const editCheckpointForm = document.getElementById('edit-checkpoint-form');
    if (editCheckpointForm) {
        editCheckpointForm.addEventListener('submit', (e) => {
            e.preventDefault();
            updateCheckpoint();
        });
    }
    
    // Event listener pour le changement de type dans l'édition
    const editCheckpointType = document.getElementById('edit-checkpoint-type');
    if (editCheckpointType) {
        editCheckpointType.addEventListener('change', () => {
            // Ne pas passer de checkpoint pour éviter les conflits
            updateEditDynamicContent(null);
        });
    }
    
    // Recherche d'adresse
    document.getElementById('search-btn').addEventListener('click', searchAddress);
    document.getElementById('address-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchAddress();
        }
    });
    
    // Autocomplétion des adresses
    setupAddressAutocomplete();
    
    // Changement de type de checkpoint
    document.getElementById('checkpoint-type').addEventListener('change', updateDynamicContent);
    
    // Modal création parcours
    document.getElementById('cancel-route-btn').addEventListener('click', hideCreateRouteModal);
    document.getElementById('create-route-form').addEventListener('submit', (e) => {
        e.preventDefault();
        createRoute();
    });
    
    // Modal modification parcours
    const cancelEditRouteBtn = document.getElementById('cancel-edit-route-btn');
    const editRouteForm = document.getElementById('edit-route-form');
    
    if (cancelEditRouteBtn) {
        cancelEditRouteBtn.addEventListener('click', hideEditRouteModal);
    } else {
        console.warn('⚠️ Élément cancel-edit-route-btn non trouvé');
    }
    
    if (editRouteForm) {
        editRouteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleEditRoute();
        });
    } else {
        console.warn('⚠️ Élément edit-route-form non trouvé');
    }
    
    // Modal modification équipe
    const cancelEditTeamBtn = document.getElementById('cancel-edit-team-btn');
    const editTeamForm = document.getElementById('edit-team-form');
    
    if (cancelEditTeamBtn) {
        cancelEditTeamBtn.addEventListener('click', hideEditTeamModal);
    } else {
        console.warn('⚠️ Élément cancel-edit-team-btn non trouvé');
    }
    
    if (editTeamForm) {
        editTeamForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleEditTeam();
        });
    } else {
        console.warn('⚠️ Élément edit-team-form non trouvé');
    }
    
    // Modal visualisation parcours
    document.getElementById('close-routes-map-btn').addEventListener('click', hideRoutesMapModal);
}

async function showCreateTeamModal() {
    // Charger les parcours disponibles
    await loadRouteSelectOptions();
    document.getElementById('create-team-modal').style.display = 'flex';
    document.body.classList.add('modal-open');
}

async function loadRouteSelectOptions() {
    try {
        const [routes, checkpoints] = await Promise.all([
            firebaseService.getAllRoutes(),
            firebaseService.getAllCheckpoints()
        ]);
        
        const select = document.getElementById('team-route');
        
        // Vider les options existantes (sauf la première)
        select.innerHTML = '<option value="">-- Choisir un parcours --</option>';
        
        if (checkpoints.length === 0) {
            select.innerHTML += '<option value="" disabled>⚠️ Créez d\'abord des checkpoints</option>';
            showNotification('⚠️ Créez d\'abord des checkpoints avant de créer des équipes', 'error');
            return;
        }
        
        if (routes.length === 0) {
            select.innerHTML += '<option value="" disabled>⚠️ Créez d\'abord des parcours</option>';
            showNotification('⚠️ Créez d\'abord des parcours avant de créer des équipes', 'error');
            return;
        }
        
        // Vérifier que chaque route a des checkpoints valides
        const validRoutes = routes.filter(route => {
            const hasValidCheckpoints = route.route.every(checkpointId => 
                checkpoints.some(cp => cp.id === checkpointId)
            );
            if (!hasValidCheckpoints) {
                console.warn(`⚠️ Parcours "${route.name}" contient des checkpoints invalides:`, route.route);
            }
            return hasValidCheckpoints;
        });
        
        if (validRoutes.length === 0) {
            select.innerHTML += '<option value="" disabled>⚠️ Aucun parcours valide trouvé</option>';
            showNotification('⚠️ Tous les parcours contiennent des checkpoints invalides', 'error');
            return;
        }
        
        // Ajouter les parcours valides depuis Firebase
        validRoutes.forEach(route => {
            const option = document.createElement('option');
            option.value = route.route.join(',');
            option.textContent = `${route.name} (${route.route.length} points)`;
            select.appendChild(option);
        });
        
        console.log('✅ Parcours valides chargés dans le sélecteur:', validRoutes.length);
        
        if (validRoutes.length < routes.length) {
            showNotification(`⚠️ ${routes.length - validRoutes.length} parcours ignorés (checkpoints manquants)`, 'warning');
        }
        
    } catch (error) {
        console.error('❌ Erreur chargement parcours pour sélection:', error);
        const select = document.getElementById('team-route');
        select.innerHTML = '<option value="">-- Erreur chargement --</option>';
        showNotification('❌ Erreur lors du chargement des parcours', 'error');
    }
}

function hideCreateTeamModal() {
    document.getElementById('create-team-modal').style.display = 'none';
    document.getElementById('create-team-form').reset();
    document.body.classList.remove('modal-open');
}

// function showCreateUserModal() - Supprimée : 1 équipe = 1 joueur
// function hideCreateUserModal() - Supprimée : 1 équipe = 1 joueur

// function updateTeamSelectOptions() - Supprimée : 1 équipe = 1 joueur

// ===== CRÉATION D'ÉQUIPES =====

async function handleCreateTeam(e) {
    e.preventDefault();
    
    const teamName = document.getElementById('team-name').value.trim();
    const teamColor = document.getElementById('team-color').value;
    const teamPassword = document.getElementById('team-password').value.trim();
    const teamRoute = document.getElementById('team-route').value.split(',').map(Number);
    
    if (!teamName || !teamPassword || !teamRoute.length) {
        showNotification('Veuillez remplir tous les champs (nom, mot de passe, parcours)', 'error');
        return;
    }
    
    try {
        const teamData = {
            name: teamName,
            color: teamColor,
            password: teamPassword,
            route: teamRoute
        };
        
        const teamId = await firebaseService.createTeam(teamData);
        console.log('✅ Équipe créée:', teamId);
        
        hideCreateTeamModal();
        showNotification(`Équipe "${teamName}" créée avec succès !`, 'success');
        
        // Actualiser la liste
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur création équipe:', error);
        showNotification('Erreur lors de la création de l\'équipe', 'error');
    }
}

// ===== CRÉATION D'UTILISATEURS - SUPPRIMÉE : 1 équipe = 1 joueur =====

// ===== CHARGEMENT DES DONNÉES DE GESTION =====

async function loadManagementData() {
    try {
        // Charger les équipes pour la gestion
        managementTeamsData = await firebaseService.getAllTeams();
        updateTeamsManagementDisplay();
        
        // Peupler le select des logs avec les équipes
        populateTeamsLogsSelect();
        
        // Plus de chargement utilisateurs - 1 équipe = 1 joueur
        
        // Charger les checkpoints et parcours
        await loadCheckpoints();
        await loadRoutes();
        
        console.log(`✅ Données chargées: ${checkpointsData.length} checkpoints, ${routesData.length} routes`);
        
        // Mettre à jour les statuts de configuration
        updateConfigurationStatus();
        
    } catch (error) {
        console.error('❌ Erreur chargement données gestion:', error);
    }
}

// Variables globales pour les données
let routesData = [];

// ===== SYSTÈME DE VÉRIFICATION DE SANTÉ =====

function updateConfigurationStatus() {
    console.log('🔍 Vérification de la santé de la configuration...');
    
    const checkpointsStatus = analyzeCheckpointsHealth();
    const routesStatus = analyzeRoutesHealth();
    const teamsStatus = analyzeTeamsHealth();
    const usersStatus = analyzeUsersHealth();
    
    updateStatusIndicators({
        checkpoints: checkpointsStatus,
        routes: routesStatus,
        teams: teamsStatus,
        users: usersStatus
    });
}

function analyzeCheckpointsHealth() {
    const issues = [];
    let status = 'healthy';
    
    if (checkpointsData.length === 0) {
        issues.push('Aucun checkpoint créé');
        status = 'critical';
    } else {
        const hasLobby = checkpointsData.some(cp => cp.isLobby || cp.type === 'lobby');
        if (!hasLobby) {
            issues.push('Aucun lobby configuré');
            status = 'critical';
        }
        
        const enigmaCount = checkpointsData.filter(cp => cp.clue?.riddle).length;
        if (enigmaCount === 0 && checkpointsData.length > 1) {
            issues.push('Aucune énigme configurée');
            status = status === 'healthy' ? 'warning' : status;
        }
        
        // Vérifier les coordonnées valides
        const invalidCoords = checkpointsData.filter(cp => 
            !cp.coordinates || cp.coordinates.length !== 2 || 
            isNaN(cp.coordinates[0]) || isNaN(cp.coordinates[1])
        );
        
        if (invalidCoords.length > 0) {
            issues.push(`${invalidCoords.length} checkpoint(s) avec coordonnées invalides`);
            status = 'critical';
        }
    }
    
    return {
        status,
        count: checkpointsData.length,
        issues,
        details: `${checkpointsData.length} checkpoint(s)`
    };
}

function analyzeRoutesHealth() {
    const issues = [];
    let status = 'healthy';
    
    if (routesData.length === 0) {
        issues.push('Aucun parcours créé');
        status = checkpointsData.length > 0 ? 'critical' : 'warning';
    } else {
        // Vérifier que tous les checkpoints des routes existent
        routesData.forEach(route => {
            const invalidCheckpoints = route.route.filter(checkpointId => 
                !checkpointsData.some(cp => cp.id === checkpointId)
            );
            
            if (invalidCheckpoints.length > 0) {
                issues.push(`Parcours "${route.name}" contient des checkpoints inexistants`);
                status = 'critical';
            }
            
            if (route.route.length < 2) {
                issues.push(`Parcours "${route.name}" trop court (< 2 points)`);
                status = status === 'healthy' ? 'warning' : status;
            }
        });
    }
    
    return {
        status,
        count: routesData.length,
        issues,
        details: `${routesData.length} parcours`
    };
}

function analyzeTeamsHealth() {
    const issues = [];
    let status = 'healthy';
    
    if (managementTeamsData.length === 0) {
        issues.push('Aucune équipe créée');
        status = routesData.length > 0 ? 'warning' : 'info';
    } else {
        // Vérifier que toutes les équipes ont des parcours valides
        managementTeamsData.forEach(team => {
            if (!team.route || team.route.length === 0) {
                issues.push(`Équipe "${team.name}" sans parcours`);
                status = 'critical';
            } else {
                const invalidCheckpoints = team.route.filter(checkpointId => 
                    !checkpointsData.some(cp => cp.id === checkpointId)
                );
                
                if (invalidCheckpoints.length > 0) {
                    issues.push(`Équipe "${team.name}" a un parcours avec checkpoints manquants`);
                    status = 'critical';
                }
            }
        });
    }
    
    return {
        status,
        count: managementTeamsData.length,
        issues,
        details: `${managementTeamsData.length} équipe(s)`
    };
}

function analyzeUsersHealth() {
    // Plus de gestion utilisateurs - 1 équipe = 1 joueur
    return {
        status: 'info',
        count: managementTeamsData.length,
        issues: [],
        details: `${managementTeamsData.length} équipe(s) = ${managementTeamsData.length} joueur(s)`
    };
}

function updateStatusIndicators(statuses) {
    // Mettre à jour les indicateurs de statut dans l'interface
    updateSectionStatus('checkpoints-management', statuses.checkpoints);
    updateSectionStatus('routes-management', statuses.routes);
    updateSectionStatus('teams-management', statuses.teams);
    updateSectionStatus('users-management', statuses.users);
    
    // Mettre à jour le guide de configuration
    updateConfigGuideStatus(statuses);
}

function updateSectionStatus(sectionClass, healthData) {
    const section = document.querySelector(`.${sectionClass}`);
    if (!section) return;
    
    const header = section.querySelector('h2');
    if (!header) return;
    
    // Supprimer les anciens indicateurs
    const oldIndicators = header.querySelectorAll('.status-indicator');
    oldIndicators.forEach(indicator => indicator.remove());
    
    // Créer le nouvel indicateur
    const indicator = document.createElement('span');
    indicator.className = `status-indicator status-${healthData.status}`;
    
    const statusIcons = {
        healthy: '✅',
        warning: '⚠️',
        critical: '❌',
        info: 'ℹ️'
    };
    
    const statusTexts = {
        healthy: 'OK',
        warning: 'Attention',
        critical: 'Erreur',
        info: 'À faire'
    };
    
    indicator.innerHTML = `${statusIcons[healthData.status]} ${statusTexts[healthData.status]} (${healthData.details})`;
    
    // Ajouter le tooltip avec les détails
    if (healthData.issues.length > 0) {
        indicator.title = healthData.issues.join('\n');
    }
    
    header.appendChild(indicator);
}

function updateConfigGuideStatus(statuses) {
    const configSteps = document.querySelectorAll('.config-step');
    
    const stepStatuses = [
        statuses.checkpoints,  // Étape 1
        statuses.routes,       // Étape 2
        statuses.teams,        // Étape 3
        statuses.users         // Étape 4
    ];
    
    configSteps.forEach((step, index) => {
        const stepStatus = stepStatuses[index];
        if (!stepStatus) return;
        
        // Supprimer les anciennes classes de statut
        step.classList.remove('step-healthy', 'step-warning', 'step-critical', 'step-info');
        
        // Ajouter la nouvelle classe
        step.classList.add(`step-${stepStatus.status}`);
        
        // Ajouter/mettre à jour l'indicateur de statut
        let statusIndicator = step.querySelector('.config-step-status');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.className = 'config-step-status';
            step.appendChild(statusIndicator);
        }
        
        const statusIcons = {
            healthy: '✅',
            warning: '⚠️',
            critical: '❌',
            info: '⏳'
        };
        
        statusIndicator.innerHTML = `${statusIcons[stepStatus.status]} ${stepStatus.details}`;
        
        if (stepStatus.issues.length > 0) {
            statusIndicator.title = stepStatus.issues.join('\n');
        }
    });
}

function updateTeamsManagementDisplay() {
    const container = document.getElementById('teams-management-list');
    
    if (managementTeamsData.length === 0) {
        container.innerHTML = '<p class="no-data">Aucune équipe créée</p>';
        return;
    }
    
    container.innerHTML = managementTeamsData.map(team => `
        <div class="management-item">
            <div class="management-item-info">
                <h4 style="color: ${team.color};">${team.name}</h4>
                <p><strong>Parcours:</strong> ${team.route.join(' → ')}</p>
                <p><strong>Créée:</strong> ${formatDate(team.createdAt)}</p>
            </div>
            <div class="management-actions">
                <button class="edit-btn" onclick="editTeam('${team.id}')">✏️ Modifier équipe</button>
                <button class="edit-route-btn" onclick="editTeamRoute('${team.id}')">🛤️ Modifier parcours</button>
                <button class="delete-btn" onclick="deleteTeam('${team.id}')">🗑️ Supprimer</button>
            </div>
        </div>
    `).join('');
}

// function updateUsersManagementDisplay() - Supprimée : 1 équipe = 1 joueur

// ===== ACTIONS DE GESTION =====

// Variables pour la modification de parcours
let currentEditingTeamId = null;

async function editTeamRoute(teamId) {
    try {
        currentEditingTeamId = teamId;
        const team = managementTeamsData.find(t => t.id === teamId);
        
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        // Remplir les informations de l'équipe
        document.getElementById('edit-team-name').textContent = team.name;
        document.getElementById('edit-current-route').textContent = team.route.join(' → ');
        
        // Charger les parcours disponibles
        await loadRouteSelectOptionsForEdit();
        
        // Afficher la modal
        document.getElementById('edit-team-route-modal').style.display = 'flex';
        document.body.classList.add('modal-open');
        
    } catch (error) {
        console.error('❌ Erreur ouverture modal modification parcours:', error);
        showNotification('Erreur lors de l\'ouverture', 'error');
    }
}

function hideEditTeamRouteModal() {
    document.getElementById('edit-team-route-modal').style.display = 'none';
    document.getElementById('edit-team-route-form').reset();
    document.body.classList.remove('modal-open');
    currentEditingTeamId = null;
}

async function loadRouteSelectOptionsForEdit() {
    try {
        const routes = await firebaseService.getAllRoutes();
        const select = document.getElementById('edit-team-route-select');
        
        // Vider les options existantes (sauf la première)
        select.innerHTML = '<option value="">-- Choisir un nouveau parcours --</option>';
        
        if (routes.length === 0) {
            select.innerHTML += '<option value="" disabled>Aucun parcours créé</option>';
            return;
        }
        
        // Ajouter les parcours depuis Firebase
        routes.forEach(route => {
            const option = document.createElement('option');
            option.value = route.route.join(',');
            option.textContent = `${route.name} (${route.route.length} points)`;
            select.appendChild(option);
        });
        
        console.log('✅ Parcours chargés pour modification:', routes.length);
    } catch (error) {
        console.error('❌ Erreur chargement parcours pour modification:', error);
        const select = document.getElementById('edit-team-route-select');
        select.innerHTML = '<option value="">-- Erreur chargement --</option>';
    }
}

async function handleEditTeamRoute(e) {
    e.preventDefault();
    
    if (!currentEditingTeamId) {
        showNotification('Erreur: aucune équipe sélectionnée', 'error');
        return;
    }
    
    const newRouteString = document.getElementById('edit-team-route-select').value;
    
    if (!newRouteString) {
        showNotification('Veuillez sélectionner un parcours', 'error');
        return;
    }
    
    try {
        const newRoute = newRouteString.split(',').map(Number);
        const team = managementTeamsData.find(t => t.id === currentEditingTeamId);
        
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        // Confirmation avec avertissement sur la progression
        let confirmMessage = `⚠️ MODIFICATION DU PARCOURS\n\n`;
        confirmMessage += `Équipe: "${team.name}"\n`;
        confirmMessage += `Ancien parcours: ${team.route.join(' → ')}\n`;
        confirmMessage += `Nouveau parcours: ${newRoute.join(' → ')}\n\n`;
        confirmMessage += `🚨 ATTENTION: Cette action va réinitialiser la progression de l'équipe.\n\n`;
        confirmMessage += `Continuer ?`;
        
        if (!confirm(confirmMessage)) return;
        
        showNotification('🔄 Modification du parcours en cours...', 'info');
        
        // Mettre à jour l'équipe avec le nouveau parcours (1 équipe = 1 joueur)
        await firebaseService.updateTeamProgress(currentEditingTeamId, {
            route: newRoute,
            foundCheckpoints: [], // Reset progression
            unlockedCheckpoints: [0], // Seulement le lobby
            currentCheckpoint: 0
        });
        
        hideEditTeamRouteModal();
        showNotification(`✅ Parcours modifié pour l'équipe "${team.name}" ! Équipe réinitialisée.`, 'success');
        
        // Actualiser les données
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur modification parcours:', error);
        showNotification('Erreur lors de la modification', 'error');
    }
}

async function deleteTeam(teamId) {
    try {
        // Analyser l'impact avant suppression (1 équipe = 1 joueur)
        const team = managementTeamsData.find(t => t.id === teamId);
        
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        // Message de confirmation détaillé
        let confirmMessage = `⚠️ SUPPRESSION\n\nCette action va supprimer :\n`;
        confirmMessage += `• 1 équipe : "${team.name}"\n`;
        confirmMessage += `\n🚨 Cette action est IRRÉVERSIBLE !\n\nContinuer ?`;
        
        if (!confirm(confirmMessage)) return;
        
        showNotification('🗑️ Suppression en cours...', 'info');
        
        const result = await firebaseService.deleteTeam(teamId);
        
        showNotification(
            `✅ Équipe "${result.teamName}" supprimée !`, 
            'success'
        );
        
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur suppression équipe:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

// async function deleteUser() - Supprimée : 1 équipe = 1 joueur
// async function resetUser() - Supprimée : 1 équipe = 1 joueur

// ===== GESTION DES CHECKPOINTS =====
let checkpointMap = null;
let checkpointMarker = null;
let selectedCoordinates = null;

function showCreateCheckpointModal() {
    document.getElementById('create-checkpoint-modal').style.display = 'block';
    document.body.classList.add('modal-open');
    
    // Initialiser la carte après un court délai pour s'assurer que le modal est visible
    setTimeout(() => {
        initializeCheckpointMap();
    }, 100);
}

function hideCreateCheckpointModal() {
    document.getElementById('create-checkpoint-modal').style.display = 'none';
    document.body.classList.remove('modal-open');
    
    // Détruire la carte pour éviter les conflits
    if (checkpointMap) {
        checkpointMap.remove();
        checkpointMap = null;
        checkpointMarker = null;
        selectedCoordinates = null;
    }
    
    // Reset form
    document.getElementById('checkpoint-name').value = '';
    document.getElementById('checkpoint-emoji').value = '';
    document.getElementById('checkpoint-lat').value = '';
    document.getElementById('checkpoint-lng').value = '';
    document.getElementById('checkpoint-type').value = '';
    document.getElementById('address-search').value = '';
    document.getElementById('dynamic-content').innerHTML = '<p class="content-instruction">Sélectionnez un type de checkpoint pour voir les options</p>';
}

function initializeCheckpointMap() {
    // Détruire la carte existante si elle existe
    if (checkpointMap) {
        checkpointMap.remove();
    }
    
    // Coordonnées par défaut (Luxembourg)
    const defaultCoords = [49.6116, 6.1319];
    
    // Créer la carte
    checkpointMap = L.map('checkpoint-map').setView(defaultCoords, 13);
    
    // Ajouter les tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(checkpointMap);
    
    // Demander la géolocalisation pour centrer sur la position actuelle
    if (navigator.geolocation) {
        console.log('🌍 Demande de géolocalisation...');
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                console.log('📍 Position obtenue:', userLat, userLng);
                
                // Centrer la carte sur la position de l'utilisateur
                checkpointMap.setView([userLat, userLng], 16);
                
                // Ajouter un marqueur pour indiquer la position actuelle
                const userLocationIcon = L.divIcon({
                    className: 'user-location-marker',
                    html: '📍',
                    iconSize: [25, 25],
                    iconAnchor: [12, 12]
                });
                
                L.marker([userLat, userLng], { icon: userLocationIcon })
                    .addTo(checkpointMap)
                    .bindPopup('📍 Votre position actuelle')
                    .openPopup();
                
                showNotification('🌍 Carte centrée sur votre position', 'success');
            },
            function(error) {
                console.warn('⚠️ Géolocalisation échouée:', error.message);
                showNotification('⚠️ Géolocalisation non disponible - carte centrée sur Luxembourg', 'warning');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    } else {
        console.warn('⚠️ Géolocalisation non supportée par ce navigateur');
        showNotification('⚠️ Géolocalisation non supportée - carte centrée sur Luxembourg', 'warning');
    }
    
    // Gérer les clics sur la carte
    checkpointMap.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Supprimer le marqueur existant
        if (checkpointMarker) {
            checkpointMap.removeLayer(checkpointMarker);
        }
        
        // Ajouter un nouveau marqueur
        checkpointMarker = L.marker([lat, lng]).addTo(checkpointMap);
        
        // Mettre à jour les coordonnées
        selectedCoordinates = { lat, lng };
        document.getElementById('checkpoint-lat').value = lat.toFixed(8);
        document.getElementById('checkpoint-lng').value = lng.toFixed(8);
        
        console.log('📍 Coordonnées sélectionnées:', lat, lng);
    });
    
    // Forcer le redimensionnement de la carte
    setTimeout(() => {
        checkpointMap.invalidateSize();
    }, 200);
}

async function searchAddress() {
    const address = document.getElementById('address-search').value.trim();
    if (!address) {
        showNotification('Veuillez entrer une adresse', 'error');
        return;
    }
    
    try {
        // Utiliser un proxy CORS pour la géocodage
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const response = await fetch(proxyUrl + encodeURIComponent(nominatimUrl));
        const data = await response.json();
        
        if (data.length === 0) {
            showNotification('Adresse non trouvée', 'error');
            return;
        }
        
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        // Centrer la carte sur l'adresse trouvée
        checkpointMap.setView([lat, lng], 16);
        
        // Supprimer le marqueur existant
        if (checkpointMarker) {
            checkpointMap.removeLayer(checkpointMarker);
        }
        
        // Ajouter un marqueur à l'adresse trouvée
        checkpointMarker = L.marker([lat, lng]).addTo(checkpointMap);
        
        // Mettre à jour les coordonnées
        selectedCoordinates = { lat, lng };
        document.getElementById('checkpoint-lat').value = lat.toFixed(8);
        document.getElementById('checkpoint-lng').value = lng.toFixed(8);
        
        showNotification(`Adresse trouvée: ${result.display_name}`, 'success');
        
    } catch (error) {
        console.error('❌ Erreur recherche adresse:', error);
        showNotification('Erreur recherche adresse. Cliquez sur la carte ou entrez les coordonnées manuellement.', 'warning');
    }
}

function updateDynamicContent() {
    const type = document.getElementById('checkpoint-type').value;
    const dynamicContent = document.getElementById('dynamic-content');
    
    if (!type) {
        dynamicContent.innerHTML = '<p class="content-instruction">Sélectionnez un type de checkpoint pour voir les options</p>';
        return;
    }
    
    let content = '<div class="dynamic-fields">';
    
    switch (type) {
        case 'lobby':
            content += `
                <div>
                    <label class="field-label">Message d'accueil :</label>
                    <textarea id="lobby-message" placeholder="Bienvenue au point de rassemblement ! Utilisez le GPS pour commencer votre aventure." rows="3"></textarea>
                </div>
            `;
            break;
            
        case 'enigma':
            content += `
                <div>
                    <label class="field-label">Question de l'énigme :</label>
                    <textarea id="enigma-question" placeholder="Posez votre énigme ici..." rows="3" required></textarea>
                </div>
                <div>
                    <label class="field-label">Réponse attendue :</label>
                    <input type="text" id="enigma-answer" placeholder="Réponse exacte (insensible à la casse)" required>
                </div>
                <div>
                    <label class="field-label">Message de succès :</label>
                    <textarea id="enigma-success" placeholder="Bravo ! Vous avez résolu l'énigme !" rows="2"></textarea>
                </div>
            `;
            break;
            
        case 'photo':
            content += `
                <div>
                    <label class="field-label">Instructions pour la photo :</label>
                    <textarea id="photo-instructions" placeholder="Prenez une photo de... avec votre caméra" rows="3" required></textarea>
                </div>
                <div class="info-box">
                    <p><strong>ℹ️ Système de photos intégré :</strong></p>
                    <ul>
                        <li>📷 Caméra intégrée dans l'application</li>
                        <li>🗜️ Compression automatique (max 1MB)</li>
                        <li>✅ Validation directe dans l'interface admin</li>
                        <li>🚫 Plus besoin de WhatsApp</li>
                    </ul>
                </div>
            `;
            break;
            
        case 'audio':
            content += `
                <div>
                    <label class="field-label">Instructions pour l'épreuve audio :</label>
                    <textarea id="audio-instructions" placeholder="Faites du bruit pour débloquer ce checkpoint ! Criez, tapez des mains, chantez..." rows="3" required></textarea>
                </div>
                <div>
                    <label class="field-label">Seuil de volume (0-100) :</label>
                    <input type="number" id="audio-threshold" placeholder="70" min="0" max="100" value="70" required>
                    <small style="color: #666;">
                        Équivalences approximatives :<br>
                        • 20-30 = ~40-50 dB (chuchotement)<br>
                        • 40-50 = ~50-60 dB (conversation calme)<br>
                        • 60-70 = ~60-70 dB (conversation normale)<br>
                        • 80-90 = ~70-80 dB (parler fort, crier)<br>
                        • 95+ = ~80+ dB (crier très fort, applaudir)
                    </small>
                </div>
                <div>
                    <label class="field-label">Durée requise (secondes) :</label>
                    <input type="number" id="audio-duration" placeholder="3" min="1" max="30" value="3" required>
                    <small style="color: #666;">Temps pendant lequel maintenir le niveau sonore</small>
                </div>
                <div>
                    <label class="field-label">Message de succès :</label>
                    <textarea id="audio-success" placeholder="Bravo ! Vous avez fait assez de bruit pour débloquer ce point !" rows="2"></textarea>
                </div>
                <div class="info-box">
                    <p><strong>🎤 Épreuve audio :</strong></p>
                    <ul>
                        <li>🔊 Détection du niveau sonore via microphone</li>
                        <li>⏱️ Validation automatique après la durée requise</li>
                        <li>📊 Jauge de progression visuelle pour l'utilisateur</li>
                        <li>🎯 Seuil et durée configurables</li>
                    </ul>
                </div>
            `;
            break;
            
        case 'qcm':
            content += `
                <div>
                    <label class="field-label">Question du QCM :</label>
                    <textarea id="qcm-question" placeholder="Quelle est la date de construction de ce monument ?" rows="3" required></textarea>
                </div>
                <div>
                    <label class="field-label">Réponses possibles :</label>
                    <div class="qcm-answers">
                        <div class="qcm-answer-item">
                            <input type="text" id="qcm-answer-1" placeholder="Réponse A" required>
                            <label><input type="checkbox" id="qcm-correct-1"> Correcte</label>
                        </div>
                        <div class="qcm-answer-item">
                            <input type="text" id="qcm-answer-2" placeholder="Réponse B" required>
                            <label><input type="checkbox" id="qcm-correct-2"> Correcte</label>
                        </div>
                        <div class="qcm-answer-item">
                            <input type="text" id="qcm-answer-3" placeholder="Réponse C" required>
                            <label><input type="checkbox" id="qcm-correct-3"> Correcte</label>
                        </div>
                        <div class="qcm-answer-item">
                            <input type="text" id="qcm-answer-4" placeholder="Réponse D (optionnelle)">
                            <label><input type="checkbox" id="qcm-correct-4"> Correcte</label>
                        </div>
                    </div>
                </div>
                <div>
                    <label class="field-label">Explication (optionnelle) :</label>
                    <textarea id="qcm-explanation" placeholder="Explication affichée après la réponse..." rows="2"></textarea>
                </div>
                <div>
                    <label class="field-label">Message de succès :</label>
                    <textarea id="qcm-success" placeholder="Bravo ! Bonne réponse !" rows="2"></textarea>
                </div>
                <div class="info-box">
                    <p><strong>📋 QCM Culturel :</strong></p>
                    <ul>
                        <li>🎯 Une question avec 3-4 réponses possibles</li>
                        <li>✅ Cochez les réponses correctes (peut y en avoir plusieurs)</li>
                        <li>📚 Parfait pour l'aspect éducatif et culturel</li>
                        <li>💡 Ajoutez une explication pour enrichir l'apprentissage</li>
                    </ul>
                </div>
            `;
            break;
            
        case 'instruction':
            content += `
                <div>
                    <label class="field-label">Instructions à afficher :</label>
                    <textarea id="instruction-text" placeholder="Rendez-vous à la fontaine et observez les statues..." rows="4" required></textarea>
                </div>
                <div class="info-box">
                    <p><strong>📄 Instructions simples :</strong></p>
                    <ul>
                        <li>📋 Affiche un texte d'instructions aux joueurs</li>
                        <li>✅ Bouton "J'ai compris" pour valider et passer au suivant</li>
                        <li>🔄 Possibilité de relire les instructions depuis le menu</li>
                        <li>🎯 Parfait pour des consignes, directions ou explications</li>
                    </ul>
                </div>
            `;
            break;
            
        case 'info':
            content += `
                <div>
                    <label class="field-label">Information à trouver :</label>
                    <textarea id="info-question" placeholder="Quelle est la date inscrite sur la statue ?" rows="2" required></textarea>
                </div>
                <div>
                    <label class="field-label">Réponse attendue :</label>
                    <input type="text" id="info-answer" placeholder="Réponse exacte" required>
                </div>
                <div>
                    <label class="field-label">Aide/Localisation :</label>
                    <textarea id="info-help" placeholder="Cherchez près de l'entrée principale..." rows="2"></textarea>
                </div>
            `;
            break;
            
        case 'final':
            content += `
                <div>
                    <label class="field-label">Message de félicitations :</label>
                    <textarea id="final-message" placeholder="Félicitations ! Vous avez terminé le jeu de piste !" rows="3"></textarea>
                </div>
                <div>
                    <label class="field-label">Instructions finales :</label>
                    <textarea id="final-instructions" placeholder="Rendez-vous au point de rassemblement pour la suite..." rows="2"></textarea>
                </div>
            `;
            break;
    }
    
    content += '</div>';
    dynamicContent.innerHTML = content;
}

async function createCheckpoint() {
    const name = document.getElementById('checkpoint-name').value.trim();
    const emoji = document.getElementById('checkpoint-emoji').value.trim();
    const lat = parseFloat(document.getElementById('checkpoint-lat').value);
    const lng = parseFloat(document.getElementById('checkpoint-lng').value);
    const type = document.getElementById('checkpoint-type').value;

    if (!name || !emoji || isNaN(lat) || isNaN(lng) || !type) {
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    try {
        let clueData = {
            title: `${name} découvert !`,
            text: '',
            riddle: null
        };

        // Construire les données selon le type
        switch (type) {
            case 'lobby':
                const lobbyMessage = document.getElementById('lobby-message')?.value || 'Bienvenue au point de rassemblement !';
                clueData.text = lobbyMessage;
                break;
                
            case 'enigma':
                const enigmaQuestion = document.getElementById('enigma-question')?.value.trim();
                const enigmaAnswer = document.getElementById('enigma-answer')?.value.trim();
                const enigmaSuccess = document.getElementById('enigma-success')?.value.trim() || 'Bravo ! Énigme résolue !';
                
                if (!enigmaQuestion || !enigmaAnswer) {
                    showNotification('Veuillez remplir la question et la réponse de l\'énigme', 'error');
                    return;
                }
                
                clueData.text = enigmaSuccess;
                clueData.riddle = {
                    question: enigmaQuestion,
                    answer: enigmaAnswer.toLowerCase(),
                    hint: `Résolvez l'énigme pour débloquer le prochain point`
                };
                break;
                
            case 'photo':
                const photoInstructions = document.getElementById('photo-instructions')?.value.trim();
                
                if (!photoInstructions) {
                    showNotification('Veuillez remplir les instructions pour la photo', 'error');
                    return;
                }
                
                clueData.text = photoInstructions;
                // Plus besoin de WhatsApp - système intégré
                break;
                
            case 'audio':
                const audioInstructions = document.getElementById('audio-instructions')?.value.trim();
                const audioThreshold = parseInt(document.getElementById('audio-threshold')?.value);
                const audioDuration = parseInt(document.getElementById('audio-duration')?.value);
                const audioSuccess = document.getElementById('audio-success')?.value.trim() || 'Bravo ! Épreuve audio réussie !';
                
                if (!audioInstructions || isNaN(audioThreshold) || isNaN(audioDuration)) {
                    showNotification('Veuillez remplir tous les champs de l\'épreuve audio', 'error');
                    return;
                }
                
                if (audioThreshold < 0 || audioThreshold > 100) {
                    showNotification('Le seuil de volume doit être entre 0 et 100', 'error');
                    return;
                }
                
                if (audioDuration < 1 || audioDuration > 30) {
                    showNotification('La durée doit être entre 1 et 30 secondes', 'error');
                    return;
                }
                
                clueData.text = audioSuccess;
                clueData.audioChallenge = {
                    instructions: audioInstructions,
                    threshold: audioThreshold,
                    duration: audioDuration,
                    successMessage: audioSuccess
                };
                break;
                
            case 'qcm':
                const qcmQuestion = document.getElementById('qcm-question')?.value.trim();
                const qcmExplanation = document.getElementById('qcm-explanation')?.value.trim();
                const qcmSuccess = document.getElementById('qcm-success')?.value.trim() || 'Bravo ! Bonne réponse !';
                
                if (!qcmQuestion) {
                    showNotification('Veuillez remplir la question du QCM', 'error');
                    return;
                }
                
                // Récupérer les réponses et leurs statuts
                const answers = [];
                const correctAnswers = [];
                
                for (let i = 1; i <= 4; i++) {
                    const answerText = document.getElementById(`qcm-answer-${i}`)?.value.trim();
                    const isCorrect = document.getElementById(`qcm-correct-${i}`)?.checked;
                    
                    if (answerText) {
                        answers.push(answerText);
                        if (isCorrect) {
                            correctAnswers.push(i - 1); // Index 0-based
                        }
                    }
                }
                
                if (answers.length < 2) {
                    showNotification('Veuillez remplir au moins 2 réponses', 'error');
                    return;
                }
                
                if (correctAnswers.length === 0) {
                    showNotification('Veuillez cocher au moins une réponse correcte', 'error');
                    return;
                }
                
                clueData.text = qcmSuccess;
                clueData.qcm = {
                    question: qcmQuestion,
                    answers: answers,
                    correctAnswers: correctAnswers,
                    explanation: qcmExplanation,
                    successMessage: qcmSuccess
                };
                break;
                
            case 'instruction':
                const instructionText = document.getElementById('instruction-text')?.value.trim();
                
                if (!instructionText) {
                    showNotification('Veuillez remplir le texte des instructions', 'error');
                    return;
                }
                
                clueData.text = instructionText;
                clueData.instruction = {
                    text: instructionText
                };
                break;
                
            case 'info':
                const infoQuestion = document.getElementById('info-question')?.value.trim();
                const infoAnswer = document.getElementById('info-answer')?.value.trim();
                const infoHelp = document.getElementById('info-help')?.value.trim();
                
                if (!infoQuestion || !infoAnswer) {
                    showNotification('Veuillez remplir la question et la réponse', 'error');
                    return;
                }
                
                clueData.text = infoHelp || 'Trouvez l\'information demandée';
                clueData.riddle = {
                    question: infoQuestion,
                    answer: infoAnswer.toLowerCase(),
                    hint: infoHelp || 'Cherchez autour de vous'
                };
                break;
                
            case 'final':
                const finalMessage = document.getElementById('final-message')?.value.trim() || 'Félicitations !';
                const finalInstructions = document.getElementById('final-instructions')?.value.trim();
                
                clueData.text = finalMessage;
                if (finalInstructions) {
                    clueData.instructions = finalInstructions;
                }
                break;
        }

        const checkpointData = {
            name,
            emoji,
            coordinates: [lat, lng],
            type,
            isLobby: type === 'lobby',
            locked: type !== 'lobby',
            clue: clueData,
            createdAt: new Date()
        };

        await firebaseService.createCheckpoint(checkpointData);
        showNotification('Checkpoint créé avec succès', 'success');
        hideCreateCheckpointModal();
        loadCheckpoints();
    } catch (error) {
        console.error('❌ Erreur création checkpoint:', error);
        showNotification('Erreur lors de la création', 'error');
    }
}

// ===== GESTION DES PARCOURS =====
function showCreateRouteModal() {
    loadCheckpointsForRoute();
    document.getElementById('create-route-modal').style.display = 'block';
    document.body.classList.add('modal-open');
}

function hideCreateRouteModal() {
    document.getElementById('create-route-modal').style.display = 'none';
    document.getElementById('route-name').value = '';
    document.getElementById('checkpoint-order-list').innerHTML = '';
    document.body.classList.remove('modal-open');
}

async function loadCheckpointsForRoute() {
    try {
        const checkpoints = await firebaseService.getAllCheckpoints();
        const orderList = document.getElementById('checkpoint-order-list');
        
        if (checkpoints.length === 0) {
            orderList.innerHTML = '<p style="text-align: center; color: #666;">Créez d\'abord des checkpoints</p>';
            return;
        }

        orderList.innerHTML = '';
        checkpoints.forEach(checkpoint => {
            const item = document.createElement('div');
            item.className = 'checkpoint-order-item';
            item.draggable = true;
            item.dataset.checkpointId = checkpoint.id;
            item.innerHTML = `
                <input type="checkbox" id="create-checkpoint-${checkpoint.id}" 
                       value="${checkpoint.id}" 
                       onchange="updateCreateRouteSelection()">
                <span class="drag-handle">⋮⋮</span>
                <span class="checkpoint-info">${checkpoint.emoji} ${checkpoint.name}</span>
                <span class="checkpoint-type">${checkpoint.type}</span>
            `;
            
            // Ajouter les événements drag & drop
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            
            orderList.appendChild(item);
        });
        
        // Configurer le drop zone pour la création
        orderList.addEventListener('dragover', handleDragOver);
        orderList.addEventListener('drop', handleCreateRouteDrop);

    } catch (error) {
        console.error('❌ Erreur chargement checkpoints:', error);
    }
}

function updateCreateRouteSelection() {
    // Pas besoin de faire quoi que ce soit, l'ordre sera récupéré au moment de la création
    console.log('☑️ Sélection mise à jour pour création');
}

function handleCreateRouteDrop(e) {
    e.preventDefault();
    console.log('🔄 Drag & drop dans création de parcours');
}

function setupDragAndDrop() {
    const items = document.querySelectorAll('.checkpoint-order-item');
    const container = document.getElementById('checkpoint-order-list');

    items.forEach(item => {
        item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', item.dataset.checkpointId);
            item.classList.add('dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        const afterElement = getDragAfterElement(container, e.clientY);
        
        if (afterElement == null) {
            container.appendChild(dragging);
        } else {
            container.insertBefore(dragging, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.checkpoint-order-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function createRoute() {
    const name = document.getElementById('route-name').value.trim();
    
    if (!name) {
        showNotification('Veuillez entrer un nom de parcours', 'error');
        return;
    }

    // Récupérer seulement les checkpoints COCHÉS dans l'ordre DOM
    const allItems = document.querySelectorAll('#checkpoint-order-list .checkpoint-order-item');
    const route = [];
    
    allItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            route.push(parseInt(checkbox.value));
        }
    });

    if (route.length === 0) {
        showNotification('Veuillez sélectionner au moins un checkpoint', 'error');
        return;
    }

    console.log('🛤️ Création parcours avec ordre:', route);

    try {
        const routeData = {
            name,
            route,
            createdAt: new Date()
        };

        await firebaseService.createRoute(routeData);
        showNotification('Parcours créé avec succès', 'success');
        hideCreateRouteModal();
        loadRoutes();
    } catch (error) {
        console.error('❌ Erreur création parcours:', error);
        showNotification('Erreur lors de la création', 'error');
    }
}

// ===== CHARGEMENT DES DONNÉES =====
async function loadCheckpoints() {
    try {
        checkpointsData = await firebaseService.getAllCheckpoints();
        const list = document.getElementById('checkpoints-management-list');
        
        if (checkpointsData.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666;">Aucun checkpoint créé</p>';
            return;
        }

        list.innerHTML = checkpointsData.map(checkpoint => {
            // Analyser le statut de ce checkpoint
            const issues = [];
            if (!checkpoint.coordinates || checkpoint.coordinates.length !== 2) {
                issues.push('Coordonnées manquantes');
            }
            if (!checkpoint.clue || !checkpoint.clue.text) {
                issues.push('Contenu manquant');
            }
            if (checkpoint.type === 'enigma' && (!checkpoint.clue?.riddle || !checkpoint.clue.riddle.answer)) {
                issues.push('Énigme incomplète');
            }
            
            const statusIcon = issues.length === 0 ? '✅' : '⚠️';
            const statusClass = issues.length === 0 ? 'item-healthy' : 'item-warning';
            
            return `
                <div class="management-item ${statusClass}">
                    <div class="item-header">
                <h4>${checkpoint.emoji} ${checkpoint.name}</h4>
                        <span class="item-status" title="${issues.join(', ')}">${statusIcon}</span>
                    </div>
                <p><strong>Type:</strong> ${checkpoint.type}</p>
                    <p><strong>Coordonnées:</strong> ${checkpoint.coordinates ? `${checkpoint.coordinates[0]}, ${checkpoint.coordinates[1]}` : 'Non définies'}</p>
                <p><strong>Contenu:</strong> ${checkpoint.clue?.text || 'Aucun contenu'}</p>
                    ${issues.length > 0 ? `<div class="item-issues">⚠️ ${issues.join(', ')}</div>` : ''}
                <div class="item-actions">
                    <button onclick="editCheckpoint('${checkpoint.id}')" class="edit-btn">✏️ Modifier</button>
                    <button onclick="deleteCheckpoint('${checkpoint.id}')" class="warning-btn">🗑️ Supprimer</button>
                </div>
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error('❌ Erreur chargement checkpoints:', error);
        checkpointsData = [];
    }
}

async function loadRoutes() {
    try {
        routesData = await firebaseService.getAllRoutes();
        const list = document.getElementById('routes-management-list');
        
        if (routesData.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666;">Aucun parcours créé</p>';
            return;
        }

        list.innerHTML = routesData.map(route => {
            // Analyser le statut de ce parcours
            const issues = [];
            if (!route.route || route.route.length < 2) {
                issues.push('Parcours trop court');
            }
            
            // Vérifier que tous les checkpoints existent
            const missingCheckpoints = route.route.filter(checkpointId => 
                !checkpointsData.some(cp => cp.id === checkpointId)
            );
            
            if (missingCheckpoints.length > 0) {
                issues.push(`${missingCheckpoints.length} checkpoint(s) manquant(s)`);
            }
            
            const statusIcon = issues.length === 0 ? '✅' : '❌';
            const statusClass = issues.length === 0 ? 'item-healthy' : 'item-critical';
            
            // Créer la liste des checkpoints avec leurs noms
            const checkpointNames = route.route.map(checkpointId => {
                const checkpoint = checkpointsData.find(cp => cp.id === checkpointId);
                return checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `❓ ID:${checkpointId}`;
            }).join(' → ');
            
            return `
                <div class="management-item ${statusClass}">
                    <div class="item-header">
                <h4>🛤️ ${route.name}</h4>
                        <span class="item-status" title="${issues.join(', ')}">${statusIcon}</span>
                    </div>
                    <p><strong>Checkpoints:</strong> ${checkpointNames}</p>
                    <p><strong>Longueur:</strong> ${route.route.length} points</p>
                    ${issues.length > 0 ? `<div class="item-issues">❌ ${issues.join(', ')}</div>` : ''}
                <div class="item-actions">
                    <button onclick="editRoute('${route.id}')" class="edit-btn">✏️ Modifier</button>
                    <button onclick="deleteRoute('${route.id}')" class="warning-btn">🗑️ Supprimer</button>
                </div>
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error('❌ Erreur chargement parcours:', error);
        routesData = [];
    }
}

// ===== ÉDITION DE CHECKPOINT =====

async function editCheckpoint(checkpointId) {
    try {
        // S'assurer que les données sont chargées
        if (!checkpointsData || checkpointsData.length === 0) {
            console.log('🔄 Rechargement des checkpoints...');
            checkpointsData = await firebaseService.getAllCheckpoints();
        }
        
        // Trouver le checkpoint à éditer
        const checkpoint = checkpointsData.find(cp => cp.id == checkpointId); // Utiliser == pour la comparaison
        if (!checkpoint) {
            console.error('❌ Checkpoint non trouvé:', {
                searchId: checkpointId,
                availableIds: checkpointsData.map(cp => cp.id),
                checkpointsCount: checkpointsData.length
            });
            showNotification('Checkpoint non trouvé', 'error');
            return;
        }
        
        currentEditingCheckpointId = checkpointId;
        
        // Remplir le formulaire avec les données existantes
        document.getElementById('edit-checkpoint-name').value = checkpoint.name || '';
        document.getElementById('edit-checkpoint-emoji').value = checkpoint.emoji || '';
        document.getElementById('edit-checkpoint-lat').value = checkpoint.coordinates ? checkpoint.coordinates[0] : '';
        document.getElementById('edit-checkpoint-lng').value = checkpoint.coordinates ? checkpoint.coordinates[1] : '';
        document.getElementById('edit-checkpoint-type').value = checkpoint.type || '';
        
        // Générer le contenu dynamique selon le type
        updateEditDynamicContent(checkpoint);
        
        // Afficher la modal
        document.getElementById('edit-checkpoint-modal').style.display = 'flex';
        
        console.log('✏️ Édition du checkpoint:', checkpoint);
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'édition:', error);
        showNotification('Erreur lors de l\'édition', 'error');
    }
}

function hideEditCheckpointModal() {
    const modal = document.getElementById('edit-checkpoint-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentEditingCheckpointId = null;
    
    // Réinitialiser le formulaire
    const form = document.getElementById('edit-checkpoint-form');
    if (form) {
        form.reset();
    }
    
    const dynamicContent = document.getElementById('edit-dynamic-content');
    if (dynamicContent) {
        dynamicContent.innerHTML = '';
    }
}

function updateEditDynamicContent(checkpoint = null) {
    const typeElement = document.getElementById('edit-checkpoint-type');
    const dynamicContent = document.getElementById('edit-dynamic-content');
    
    if (!typeElement || !dynamicContent) {
        console.warn('⚠️ Éléments de la modal d\'édition non trouvés');
        return;
    }
    
    const type = typeElement.value;
    
    let content = '';
    
    switch (type) {
        case 'lobby':
            content = `
                <div>
                    <label class="field-label">Message d'accueil :</label>
                    <textarea id="edit-lobby-welcome" placeholder="Bienvenue dans le jeu de piste !" rows="3">${checkpoint?.clue?.text || ''}</textarea>
                </div>
                <div class="info-box">
                    <p><strong>🏠 Point de Départ :</strong></p>
                    <ul>
                        <li>🎯 Premier point accessible aux équipes</li>
                        <li>📍 Définit le point de rassemblement</li>
                        <li>🚀 Lance officiellement le parcours</li>
                    </ul>
                </div>
            `;
            break;
            
        case 'enigma':
            content = `
                <div>
                    <label class="field-label">Énigme à résoudre :</label>
                    <textarea id="edit-riddle-question" placeholder="Quelle est cette énigme ?" rows="3" required>${checkpoint?.clue?.riddle?.question || ''}</textarea>
                </div>
                <div>
                    <label class="field-label">Réponse attendue :</label>
                    <input type="text" id="edit-riddle-answer" placeholder="Réponse (insensible à la casse)" required value="${checkpoint?.clue?.riddle?.answer || ''}">
                </div>
                <div>
                    <label class="field-label">Indice (optionnel) :</label>
                    <textarea id="edit-riddle-hint" placeholder="Un petit indice pour aider..." rows="2">${checkpoint?.clue?.riddle?.hint || ''}</textarea>
                </div>
                <div>
                    <label class="field-label">Message de succès :</label>
                    <textarea id="edit-riddle-success" placeholder="Bravo ! Vous avez trouvé !" rows="2">${checkpoint?.clue?.text || ''}</textarea>
                </div>
            `;
            break;
            
        case 'photo':
            content = `
                <div>
                    <label class="field-label">Instructions pour la photo :</label>
                    <textarea id="edit-photo-instructions" placeholder="Prenez une photo de..." rows="3" required>${checkpoint?.clue?.text || ''}</textarea>
                </div>
                <div>
                    <label class="field-label">Message de succès :</label>
                    <textarea id="edit-photo-success" placeholder="Parfait ! Photo validée !" rows="2">${checkpoint?.clue?.successMessage || ''}</textarea>
                </div>
            `;
            break;
            
        case 'audio':
            const audioConfig = checkpoint?.clue?.audio || {};
            content = `
                <div>
                    <label class="field-label">Instructions pour l'épreuve :</label>
                    <textarea id="edit-audio-instructions" placeholder="Faites du bruit pendant..." rows="3" required>${checkpoint?.clue?.text || ''}</textarea>
                </div>
                <div class="audio-config">
                    <div>
                        <label class="field-label">Seuil de volume (0-100) :</label>
                        <input type="number" id="edit-audio-threshold" min="0" max="100" value="${audioConfig.threshold || 50}" required>
                        <small>~${Math.round((audioConfig.threshold || 50) * 0.7)} dB</small>
                    </div>
                    <div>
                        <label class="field-label">Durée requise (secondes) :</label>
                        <input type="number" id="edit-audio-duration" min="1" max="30" value="${audioConfig.duration || 3}" required>
                    </div>
                </div>
                <div>
                    <label class="field-label">Message de succès :</label>
                    <textarea id="edit-audio-success" placeholder="Bravo ! Défi audio réussi !" rows="2">${audioConfig.successMessage || ''}</textarea>
                </div>
            `;
            break;
            
        case 'qcm':
            const qcmConfig = checkpoint?.clue?.qcm || {};
            content = `
                <div>
                    <label class="field-label">Question du QCM :</label>
                    <textarea id="edit-qcm-question" placeholder="Quelle est la date de construction de ce monument ?" rows="3" required>${qcmConfig.question || ''}</textarea>
                </div>
                <div>
                    <label class="field-label">Réponses possibles :</label>
                    <div class="qcm-answers">
            `;
            
            for (let i = 1; i <= 4; i++) {
                const answer = qcmConfig.answers ? qcmConfig.answers[i-1] || '' : '';
                const isCorrect = qcmConfig.correctAnswers ? qcmConfig.correctAnswers.includes(i-1) : false;
                content += `
                    <div class="qcm-answer-item">
                        <input type="text" id="edit-qcm-answer-${i}" placeholder="Réponse ${String.fromCharCode(64+i)}" ${i <= 3 ? 'required' : ''} value="${answer}">
                        <label><input type="checkbox" id="edit-qcm-correct-${i}" ${isCorrect ? 'checked' : ''}> Correcte</label>
                    </div>
                `;
            }
            
            content += `
                    </div>
                </div>
                <div>
                    <label class="field-label">Explication (optionnelle) :</label>
                    <textarea id="edit-qcm-explanation" placeholder="Explication affichée après la réponse..." rows="2">${qcmConfig.explanation || ''}</textarea>
                </div>
                <div>
                    <label class="field-label">Message de succès :</label>
                    <textarea id="edit-qcm-success" placeholder="Bravo ! Bonne réponse !" rows="2">${qcmConfig.successMessage || ''}</textarea>
                </div>
            `;
            break;
            
        case 'instruction':
            content = `
                <div>
                    <label class="field-label">Instructions à afficher :</label>
                    <textarea id="edit-instruction-text" placeholder="Rendez-vous à la fontaine et observez les statues..." rows="4" required>${checkpoint?.clue?.instruction?.text || checkpoint?.clue?.text || ''}</textarea>
                </div>
                <div class="info-box">
                    <p><strong>📄 Instructions simples :</strong></p>
                    <ul>
                        <li>📋 Affiche un texte d'instructions aux joueurs</li>
                        <li>✅ Bouton "J'ai compris" pour valider et passer au suivant</li>
                        <li>🔄 Possibilité de relire les instructions depuis le menu</li>
                    </ul>
                </div>
            `;
            break;
            
        case 'info':
            content = `
                <div>
                    <label class="field-label">Question à poser :</label>
                    <textarea id="edit-info-question" placeholder="Quelle est l'année de construction ?" rows="3" required>${checkpoint?.clue?.riddle?.question || ''}</textarea>
                </div>
                <div>
                    <label class="field-label">Réponse attendue :</label>
                    <input type="text" id="edit-info-answer" placeholder="1889" required value="${checkpoint?.clue?.riddle?.answer || ''}">
                </div>
                <div>
                    <label class="field-label">Aide pour trouver :</label>
                    <textarea id="edit-info-help" placeholder="Regardez la plaque..." rows="2">${checkpoint?.clue?.riddle?.hint || ''}</textarea>
                </div>
            `;
            break;
            
        case 'final':
            content = `
                <div>
                    <label class="field-label">Message de félicitations :</label>
                    <textarea id="edit-final-message" placeholder="Félicitations ! Vous avez terminé !" rows="3">${checkpoint?.clue?.text || ''}</textarea>
                </div>
                <div>
                    <label class="field-label">Instructions finales (optionnel) :</label>
                    <textarea id="edit-final-instructions" placeholder="Rendez-vous au point de rassemblement..." rows="2">${checkpoint?.clue?.instructions || ''}</textarea>
                </div>
            `;
            break;
    }
    
    dynamicContent.innerHTML = content;
}

async function updateCheckpoint() {
    if (!currentEditingCheckpointId) {
        showNotification('Erreur: Aucun checkpoint en cours d\'édition', 'error');
        return;
    }
    
    const name = document.getElementById('edit-checkpoint-name').value.trim();
    const emoji = document.getElementById('edit-checkpoint-emoji').value.trim();
    const lat = parseFloat(document.getElementById('edit-checkpoint-lat').value);
    const lng = parseFloat(document.getElementById('edit-checkpoint-lng').value);
    const type = document.getElementById('edit-checkpoint-type').value;

    if (!name || !emoji || isNaN(lat) || isNaN(lng) || !type) {
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }

    try {
        let clueData = {
            title: `${name} découvert !`,
            text: '',
            riddle: null
        };

        // Construire les données selon le type (même logique que createCheckpoint)
        switch (type) {
            case 'lobby':
                const lobbyWelcome = document.getElementById('edit-lobby-welcome')?.value.trim() || 'Bienvenue dans le jeu de piste !';
                clueData.text = lobbyWelcome;
                break;
                
            case 'enigma':
                const riddleQuestion = document.getElementById('edit-riddle-question')?.value.trim();
                const riddleAnswer = document.getElementById('edit-riddle-answer')?.value.trim();
                const riddleHint = document.getElementById('edit-riddle-hint')?.value.trim();
                const riddleSuccess = document.getElementById('edit-riddle-success')?.value.trim();
                
                if (!riddleQuestion || !riddleAnswer) {
                    showNotification('Veuillez remplir la question et la réponse de l\'énigme', 'error');
                    return;
                }
                
                clueData.text = riddleSuccess || 'Bravo ! Énigme résolue !';
                clueData.riddle = {
                    question: riddleQuestion,
                    answer: riddleAnswer.toLowerCase(),
                    hint: riddleHint || 'Cherchez bien autour de vous'
                };
                break;
                
            case 'photo':
                const photoInstructions = document.getElementById('edit-photo-instructions')?.value.trim();
                const photoSuccess = document.getElementById('edit-photo-success')?.value.trim();
                
                if (!photoInstructions) {
                    showNotification('Veuillez remplir les instructions pour la photo', 'error');
                    return;
                }
                
                clueData.text = photoInstructions;
                clueData.successMessage = photoSuccess || 'Parfait ! Photo validée !';
                break;
                
            case 'audio':
                const audioInstructions = document.getElementById('edit-audio-instructions')?.value.trim();
                const audioThreshold = parseInt(document.getElementById('edit-audio-threshold')?.value);
                const audioDuration = parseInt(document.getElementById('edit-audio-duration')?.value);
                const audioSuccess = document.getElementById('edit-audio-success')?.value.trim();
                
                if (!audioInstructions || isNaN(audioThreshold) || isNaN(audioDuration)) {
                    showNotification('Veuillez remplir tous les champs de l\'épreuve audio', 'error');
                    return;
                }
                
                clueData.text = audioInstructions;
                clueData.audio = {
                    threshold: audioThreshold,
                    duration: audioDuration,
                    successMessage: audioSuccess || 'Bravo ! Défi audio réussi !'
                };
                break;
                
            case 'qcm':
                const qcmQuestion = document.getElementById('edit-qcm-question')?.value.trim();
                const qcmExplanation = document.getElementById('edit-qcm-explanation')?.value.trim();
                const qcmSuccess = document.getElementById('edit-qcm-success')?.value.trim() || 'Bravo ! Bonne réponse !';
                
                if (!qcmQuestion) {
                    showNotification('Veuillez remplir la question du QCM', 'error');
                    return;
                }
                
                const answers = [];
                const correctAnswers = [];
                
                for (let i = 1; i <= 4; i++) {
                    const answerText = document.getElementById(`edit-qcm-answer-${i}`)?.value.trim();
                    const isCorrect = document.getElementById(`edit-qcm-correct-${i}`)?.checked;
                    
                    if (answerText) {
                        answers.push(answerText);
                        if (isCorrect) {
                            correctAnswers.push(i - 1);
                        }
                    }
                }
                
                if (answers.length < 2) {
                    showNotification('Veuillez remplir au moins 2 réponses', 'error');
                    return;
                }
                
                if (correctAnswers.length === 0) {
                    showNotification('Veuillez cocher au moins une réponse correcte', 'error');
                    return;
                }
                
                clueData.text = qcmSuccess;
                clueData.qcm = {
                    question: qcmQuestion,
                    answers: answers,
                    correctAnswers: correctAnswers,
                    explanation: qcmExplanation,
                    successMessage: qcmSuccess
                };
                break;
                
            case 'instruction':
                const editInstructionText = document.getElementById('edit-instruction-text')?.value.trim();
                
                if (!editInstructionText) {
                    showNotification('Veuillez remplir le texte des instructions', 'error');
                    return;
                }
                
                clueData.text = editInstructionText;
                clueData.instruction = {
                    text: editInstructionText
                };
                break;
                
            case 'info':
                const infoQuestion = document.getElementById('edit-info-question')?.value.trim();
                const infoAnswer = document.getElementById('edit-info-answer')?.value.trim();
                const infoHelp = document.getElementById('edit-info-help')?.value.trim();
                
                if (!infoQuestion || !infoAnswer) {
                    showNotification('Veuillez remplir la question et la réponse', 'error');
                    return;
                }
                
                clueData.text = infoHelp || 'Trouvez l\'information demandée';
                clueData.riddle = {
                    question: infoQuestion,
                    answer: infoAnswer.toLowerCase(),
                    hint: infoHelp || 'Cherchez autour de vous'
                };
                break;
                
            case 'final':
                const finalMessage = document.getElementById('edit-final-message')?.value.trim() || 'Félicitations !';
                const finalInstructions = document.getElementById('edit-final-instructions')?.value.trim();
                
                clueData.text = finalMessage;
                if (finalInstructions) {
                    clueData.instructions = finalInstructions;
                }
                break;
        }

        const checkpointData = {
            name,
            emoji,
            coordinates: [lat, lng],
            type,
            isLobby: type === 'lobby',
            locked: type !== 'lobby',
            clue: clueData,
            updatedAt: new Date()
        };

        await firebaseService.updateCheckpoint(currentEditingCheckpointId, checkpointData);
        
        showNotification('✅ Checkpoint modifié avec succès !', 'success');
        hideEditCheckpointModal();
        
        // Recharger la liste
        await loadCheckpoints();
        
        console.log('✅ Checkpoint mis à jour:', checkpointData);
        
    } catch (error) {
        console.error('❌ Erreur lors de la modification:', error);
        showNotification('Erreur lors de la modification', 'error');
    }
}

async function deleteCheckpoint(checkpointId) {
    try {
        // Analyser l'impact avant suppression
        const allRoutes = await firebaseService.getAllRoutes();
        const allTeams = await firebaseService.getAllTeams();
        const allUsers = await firebaseService.getAllUsers();
        
        const checkpointIdInt = parseInt(checkpointId);
        const affectedRoutes = allRoutes.filter(route => 
            route.route.includes(checkpointIdInt)
        );
        const affectedTeams = allTeams.filter(team => 
            team.route && team.route.includes(checkpointIdInt)
        );
        const affectedUsers = allUsers.filter(user => 
            affectedTeams.some(team => team.id === user.teamId)
        );
        
        // Message de confirmation détaillé
        let confirmMessage = `⚠️ SUPPRESSION EN CASCADE\n\nCette action va supprimer :\n`;
        confirmMessage += `• 1 checkpoint\n`;
        
        if (affectedRoutes.length > 0) {
            confirmMessage += `• ${affectedRoutes.length} parcours affectés :\n`;
            affectedRoutes.forEach(route => {
                const willBeEmpty = route.route.filter(id => id !== checkpointIdInt).length === 0;
                confirmMessage += `  - "${route.name}" ${willBeEmpty ? '(sera supprimé - devient vide)' : '(sera modifié)'}\n`;
            });
        }
        
        if (affectedTeams.length > 0) {
            confirmMessage += `• ${affectedTeams.length} équipes affectées :\n`;
            affectedTeams.forEach(team => {
                confirmMessage += `  - "${team.name}" (route nettoyée)\n`;
            });
        }
        
        if (affectedUsers.length > 0) {
            confirmMessage += `• ${affectedUsers.length} utilisateurs affectés :\n`;
            affectedUsers.forEach(user => {
                confirmMessage += `  - "${user.name}" (progression nettoyée)\n`;
            });
        }
        
        confirmMessage += `\n🚨 Cette action est IRRÉVERSIBLE !\n\nContinuer ?`;
        
        if (!confirm(confirmMessage)) return;
        
        showNotification('🗑️ Suppression en cascade en cours...', 'info');
        
        const result = await firebaseService.deleteCheckpoint(checkpointId);
        
        showNotification(
            `✅ Checkpoint supprimé ! Impact : ${result.affectedRoutes} routes, ${result.affectedTeams} équipes, ${result.affectedUsers} utilisateurs`, 
            'success'
        );
        
        loadCheckpoints();
        loadRoutes(); // Recharger les routes car certaines ont pu être supprimées/modifiées
        loadManagementData(); // Recharger les équipes et utilisateurs
        
    } catch (error) {
        console.error('❌ Erreur suppression checkpoint:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

async function deleteRoute(routeId) {
    try {
        // Analyser l'impact avant suppression
        const allRoutes = await firebaseService.getAllRoutes();
        const allTeams = await firebaseService.getAllTeams();
        const allUsers = await firebaseService.getAllUsers();
        
        const routeIdInt = parseInt(routeId);
        const routeToDelete = allRoutes.find(route => route.id === routeIdInt);
        
        if (!routeToDelete) {
            showNotification('Parcours non trouvé', 'error');
            return;
        }
        
        const affectedTeams = allTeams.filter(team => 
            team.route && JSON.stringify(team.route) === JSON.stringify(routeToDelete.route)
        );
        const affectedUsers = allUsers.filter(user => 
            affectedTeams.some(team => team.id === user.teamId)
        );
        
        // Message de confirmation détaillé
        let confirmMessage = `⚠️ SUPPRESSION EN CASCADE\n\nCette action va supprimer :\n`;
        confirmMessage += `• 1 parcours : "${routeToDelete.name}"\n`;
        
        if (affectedTeams.length > 0) {
            confirmMessage += `\nImpact sur les équipes :\n`;
            confirmMessage += `• ${affectedTeams.length} équipes seront réinitialisées au lobby :\n`;
            affectedTeams.forEach(team => {
                confirmMessage += `  - "${team.name}" (progression perdue)\n`;
            });
        }
        
        if (affectedUsers.length > 0) {
            confirmMessage += `\nImpact sur les utilisateurs :\n`;
            confirmMessage += `• ${affectedUsers.length} utilisateurs seront réinitialisés :\n`;
            affectedUsers.forEach(user => {
                confirmMessage += `  - "${user.name}" (progression perdue)\n`;
            });
        }
        
        confirmMessage += `\n🚨 Cette action est IRRÉVERSIBLE !\n\nContinuer ?`;
        
        if (!confirm(confirmMessage)) return;
        
        showNotification('🗑️ Suppression en cascade en cours...', 'info');
        
        const result = await firebaseService.deleteRoute(routeId);
        
        showNotification(
            `✅ Parcours "${result.routeName}" supprimé ! ${result.affectedTeams} équipes et ${result.affectedUsers} utilisateurs réinitialisés`, 
            'success'
        );
        
        loadRoutes();
        loadManagementData(); // Recharger les équipes et utilisateurs
        
    } catch (error) {
        console.error('❌ Erreur suppression parcours:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

// ===== VISUALISATION DES PARCOURS =====
let routesVisualizationMap = null;
const routeColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];

async function showRoutesMapModal() {
    document.getElementById('routes-map-modal').style.display = 'block';
    document.body.classList.add('modal-open');
    
    // Initialiser la carte après un court délai
    setTimeout(() => {
        initializeRoutesVisualizationMap();
    }, 100);
}

function hideRoutesMapModal() {
    document.getElementById('routes-map-modal').style.display = 'none';
    document.body.classList.remove('modal-open');
    
    // Détruire la carte pour éviter les conflits
    if (routesVisualizationMap) {
        routesVisualizationMap.remove();
        routesVisualizationMap = null;
    }
}

async function initializeRoutesVisualizationMap() {
    // Détruire la carte existante si elle existe
    if (routesVisualizationMap) {
        routesVisualizationMap.remove();
    }
    
    try {
        // Charger les données
        const [routes, checkpoints] = await Promise.all([
            firebaseService.getAllRoutes(),
            firebaseService.getAllCheckpoints()
        ]);
        
        if (checkpoints.length === 0) {
            document.getElementById('routes-legend-list').innerHTML = '<p>Aucun checkpoint créé</p>';
            return;
        }
        
        // Coordonnées par défaut (centre des checkpoints)
        const avgLat = checkpoints.reduce((sum, cp) => sum + cp.coordinates[0], 0) / checkpoints.length;
        const avgLng = checkpoints.reduce((sum, cp) => sum + cp.coordinates[1], 0) / checkpoints.length;
        
        // Créer la carte
        routesVisualizationMap = L.map('routes-visualization-map').setView([avgLat, avgLng], 14);
        
        // Ajouter les tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(routesVisualizationMap);
        
        // Ajouter tous les checkpoints
        const checkpointMarkers = {};
        checkpoints.forEach(checkpoint => {
            const marker = L.marker(checkpoint.coordinates)
                .bindPopup(`
                    <div style="text-align: center;">
                        <h4>${checkpoint.emoji} ${checkpoint.name}</h4>
                        <p><strong>Type:</strong> ${checkpoint.type}</p>
                        <p><strong>ID:</strong> ${checkpoint.id}</p>
                    </div>
                `)
                .addTo(routesVisualizationMap);
            
            checkpointMarkers[checkpoint.id] = marker;
        });
        
        // Afficher les parcours
        displayRoutesOnMap(routes, checkpoints, checkpointMarkers);
        
        // Forcer le redimensionnement de la carte
        setTimeout(() => {
            routesVisualizationMap.invalidateSize();
        }, 200);
        
    } catch (error) {
        console.error('❌ Erreur initialisation carte parcours:', error);
        document.getElementById('routes-legend-list').innerHTML = '<p>Erreur lors du chargement</p>';
    }
}

function displayRoutesOnMap(routes, checkpoints, checkpointMarkers) {
    const legendList = document.getElementById('routes-legend-list');
    
    if (routes.length === 0) {
        legendList.innerHTML = '<p>Aucun parcours créé</p>';
        return;
    }
    
    let legendHTML = '';
    
    routes.forEach((route, index) => {
        const color = routeColors[index % routeColors.length];
        
        // Créer la ligne du parcours
        const routeCoordinates = route.route.map(checkpointId => {
            const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
            return checkpoint ? checkpoint.coordinates : null;
        }).filter(coord => coord !== null);
        
        if (routeCoordinates.length > 1) {
            L.polyline(routeCoordinates, {
                color: color,
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 5'
            }).addTo(routesVisualizationMap);
            
            // Ajouter des flèches pour indiquer la direction
            routeCoordinates.forEach((coord, i) => {
                if (i < routeCoordinates.length - 1) {
                    const nextCoord = routeCoordinates[i + 1];
                    const midLat = (coord[0] + nextCoord[0]) / 2;
                    const midLng = (coord[1] + nextCoord[1]) / 2;
                    
                    L.marker([midLat, midLng], {
                        icon: L.divIcon({
                            className: 'route-arrow',
                            html: `<div style="color: ${color}; font-size: 16px; font-weight: bold;">→</div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    }).addTo(routesVisualizationMap);
                }
            });
        }
        
        // Ajouter à la légende
        const checkpointNames = route.route.map(id => {
            const checkpoint = checkpoints.find(cp => cp.id === id);
            return checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `Point ${id}`;
        }).join(' → ');
        
        legendHTML += `
            <div class="route-legend-item">
                <div class="route-color-indicator" style="background-color: ${color};"></div>
                <div class="route-info">
                    <div class="route-name">${route.name}</div>
                    <div class="route-details">${checkpointNames}</div>
                </div>
            </div>
        `;
    });
    
    legendList.innerHTML = legendHTML;
}

// ===== MODIFICATION DES PARCOURS =====

// Variables pour la modification de parcours
let currentEditingRouteId = null;
let selectedCheckpoints = [];

async function editRoute(routeId) {
    try {
        currentEditingRouteId = routeId;
        const route = routesData.find(r => r.id === parseInt(routeId));
        
        if (!route) {
            showNotification('Parcours non trouvé', 'error');
            return;
        }
        
        // Remplir les informations actuelles
        document.getElementById('edit-route-name').textContent = route.name;
        document.getElementById('edit-route-name-input').value = route.name;
        
        const checkpointNames = route.route.map(id => {
            const checkpoint = checkpointsData.find(cp => cp.id === id);
            return checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `Point ${id}`;
        }).join(' → ');
        document.getElementById('edit-current-checkpoints').textContent = checkpointNames;
        
        // Charger les checkpoints disponibles
        await loadCheckpointsForRouteEdit(route.route);
        
        // Afficher le modal
        document.getElementById('edit-route-modal').style.display = 'flex';
        document.body.classList.add('modal-open');
        
    } catch (error) {
        console.error('❌ Erreur ouverture modal modification parcours:', error);
        showNotification('Erreur lors de l\'ouverture', 'error');
    }
}

function hideEditRouteModal() {
    document.getElementById('edit-route-modal').style.display = 'none';
    document.getElementById('edit-route-form').reset();
    document.body.classList.remove('modal-open');
    currentEditingRouteId = null;
    selectedCheckpoints = [];
}

async function loadCheckpointsForRouteEdit(currentRoute = []) {
    try {
        const checkpoints = await firebaseService.getAllCheckpoints();
        const checkpointsList = document.getElementById('checkpoints-list');
        
        if (checkpoints.length === 0) {
            checkpointsList.innerHTML = '<p style="text-align: center; color: #666;">Aucun checkpoint disponible</p>';
            return;
        }
        
        // Initialiser les checkpoints sélectionnés avec le parcours actuel
        selectedCheckpoints = [...currentRoute];
        
        checkpointsList.innerHTML = '';
        checkpoints.forEach(checkpoint => {
            const isSelected = currentRoute.includes(checkpoint.id);
            
            const item = document.createElement('div');
            item.className = 'checkpoint-order-item';
            item.draggable = true;
            item.dataset.checkpointId = checkpoint.id;
            item.innerHTML = `
                <input type="checkbox" id="checkpoint-${checkpoint.id}" 
                       value="${checkpoint.id}" ${isSelected ? 'checked' : ''}
                       onchange="toggleCheckpointSelection(${checkpoint.id}, this.checked)">
                <span class="drag-handle">⋮⋮</span>
                <span class="checkpoint-info">${checkpoint.emoji} ${checkpoint.name}</span>
                <span class="checkpoint-type">${checkpoint.type}</span>
            `;
            
            // Ajouter les événements drag & drop
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            
            checkpointsList.appendChild(item);
        });
        
        // Configurer le drop zone pour la liste principale
        checkpointsList.addEventListener('dragover', handleDragOver);
        checkpointsList.addEventListener('drop', handleDrop);
        
    } catch (error) {
        console.error('❌ Erreur chargement checkpoints pour modification:', error);
    }
}

function toggleCheckpointSelection(checkpointId, isSelected) {
    // Reconstruire l'ordre selon l'ordre DOM actuel
    const allItems = document.querySelectorAll('#checkpoints-list .checkpoint-order-item');
    selectedCheckpoints = [];
    
    // Parcourir dans l'ordre DOM et ajouter seulement les cochés
    allItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            selectedCheckpoints.push(parseInt(checkbox.value));
        }
    });
    
    console.log('☑️ Ordre après sélection:', selectedCheckpoints);
}

function removeCheckpointFromSelection(checkpointId) {
    selectedCheckpoints = selectedCheckpoints.filter(id => id !== checkpointId);
    
    // Décocher la checkbox correspondante
    const checkbox = document.getElementById(`checkpoint-${checkpointId}`);
    if (checkbox) checkbox.checked = false;
    
    // Pas besoin - tout géré par les checkboxes
}

// Gestion du drag & drop pour réorganiser
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    const afterElement = getDragAfterElement(e.currentTarget, e.clientY);
    
    if (afterElement == null) {
        e.currentTarget.appendChild(draggedElement);
    } else {
        e.currentTarget.insertBefore(draggedElement, afterElement);
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    // Reconstruire l'ordre des checkpoints selon l'ordre des éléments DOM dans la liste principale
    const allItems = document.querySelectorAll('#checkpoints-list .checkpoint-order-item');
    selectedCheckpoints = [];
    
    // Parcourir dans l'ordre DOM et ajouter seulement les cochés
    allItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            selectedCheckpoints.push(parseInt(checkbox.value));
        }
    });
    
    console.log('🔄 Nouvel ordre après drag & drop:', selectedCheckpoints);
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.checkpoint-order-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function handleEditRoute() {
    const newName = document.getElementById('edit-route-name-input').value.trim();
    
    if (!newName) {
        showNotification('Veuillez entrer un nom de parcours', 'error');
        return;
    }
    
    if (selectedCheckpoints.length === 0) {
        showNotification('Veuillez sélectionner au moins un checkpoint', 'error');
        return;
    }
    
    try {
        // D'abord, identifier les équipes qui utilisent l'ANCIEN parcours
        const oldRoute = routesData.find(r => r.id === parseInt(currentEditingRouteId));
        console.log('🔍 Ancien parcours:', oldRoute);
        
        // Debug : afficher tous les parcours disponibles
        console.log('🔍 Tous les parcours:', routesData.map(r => ({
            id: r.id,
            name: r.name,
            route: r.route,
            length: r.route.length
        })));
        
        // Debug : afficher les parcours de toutes les équipes
        console.log('🔍 Parcours des équipes:', managementTeamsData.map(t => ({
            name: t.name,
            route: t.route,
            length: t.route?.length || 0
        })));
        
        const teamsUsingRoute = managementTeamsData.filter(team => {
            if (!team.route || !oldRoute) return false;
            
            // Comparer avec l'ancien parcours
            const teamRouteStr = JSON.stringify([...team.route].sort());
            const oldRouteStr = JSON.stringify([...oldRoute.route].sort());
            const matches = teamRouteStr === oldRouteStr;
            
            console.log(`🔍 Équipe ${team.name}:`, {
                teamRoute: team.route,
                teamRouteLength: team.route.length,
                oldRoute: oldRoute.route,
                oldRouteLength: oldRoute.route.length,
                teamRouteStr,
                oldRouteStr,
                matches
            });
            
            return matches;
        });
        
        console.log(`🔍 ${teamsUsingRoute.length} équipe(s) utilisent l'ancien parcours`);
        
        // Si aucune équipe ne correspond, chercher les équipes qui utilisent un parcours similaire
        if (teamsUsingRoute.length === 0) {
            console.log('🔍 Recherche d\'équipes avec parcours similaires...');
            managementTeamsData.forEach(team => {
                if (!team.route) return;
                
                // Chercher quel parcours cette équipe utilise
                const matchingRoute = routesData.find(route => {
                    const teamRouteStr = JSON.stringify([...team.route].sort());
                    const routeStr = JSON.stringify([...route.route].sort());
                    return teamRouteStr === routeStr;
                });
                
                console.log(`🔍 Équipe ${team.name} utilise:`, {
                    teamRoute: team.route,
                    matchingRoute: matchingRoute ? `${matchingRoute.name} (ID: ${matchingRoute.id})` : 'Aucun parcours correspondant'
                });
            });
        }
        
        const routeData = {
            name: newName,
            route: selectedCheckpoints,
            updatedAt: new Date()
        };
        
        await firebaseService.updateRoute(currentEditingRouteId, routeData);
        
        if (teamsUsingRoute.length > 0) {
            showNotification(`🔄 Mise à jour de ${teamsUsingRoute.length} équipe(s) utilisant ce parcours...`, 'info');
            
            for (const team of teamsUsingRoute) {
                console.log(`🔄 Mise à jour équipe ${team.name} (${team.id})`);
                
                const updateData = {
                    route: selectedCheckpoints,
                    // Réinitialiser la progression si le parcours a changé
                    foundCheckpoints: [],
                    unlockedCheckpoints: [0],
                    currentCheckpoint: 0
                };
                
                console.log('📝 Données de mise à jour:', updateData);
                
                await firebaseService.updateTeamProgress(team.id, updateData);
                console.log(`✅ Équipe ${team.name} mise à jour`);
            }
        }
        
        hideEditRouteModal();
        showNotification(`✅ Parcours "${newName}" et ${teamsUsingRoute.length} équipe(s) mis à jour`, 'success');
        loadRoutes();
        loadManagementData(); // Recharger les équipes
        
    } catch (error) {
        console.error('❌ Erreur modification parcours:', error);
        showNotification('Erreur lors de la modification', 'error');
    }
}

// ===== MODIFICATION DES ÉQUIPES =====

// currentEditingTeamId déjà déclaré plus haut dans le fichier

async function editTeam(teamId) {
    try {
        currentEditingTeamId = teamId;
        const team = managementTeamsData.find(t => t.id === teamId);
        
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        // Remplir les informations actuelles
        document.getElementById('edit-team-current-info').innerHTML = `
            <p><strong>Nom actuel:</strong> ${team.name}</p>
            <p><strong>Couleur actuelle:</strong> <span style="color: ${team.color};">●</span> ${team.color}</p>
            <p><strong>Créée le:</strong> ${formatDate(team.createdAt)}</p>
            <p><strong>Parcours:</strong> ${team.route.join(' → ')}</p>
        `;
        
        // Pré-remplir le formulaire
        document.getElementById('edit-team-name-input').value = team.name;
        document.getElementById('edit-team-color-input').value = team.color;
        document.getElementById('edit-team-password-input').value = ''; // Mot de passe vide par défaut
        
        // Afficher le modal
        document.getElementById('edit-team-modal').style.display = 'flex';
        document.body.classList.add('modal-open');
        
    } catch (error) {
        console.error('❌ Erreur ouverture modal modification équipe:', error);
        showNotification('Erreur lors de l\'ouverture', 'error');
    }
}

function hideEditTeamModal() {
    document.getElementById('edit-team-modal').style.display = 'none';
    document.getElementById('edit-team-form').reset();
    document.body.classList.remove('modal-open');
    currentEditingTeamId = null;
}

async function handleEditTeam() {
    const newName = document.getElementById('edit-team-name-input').value.trim();
    const newColor = document.getElementById('edit-team-color-input').value;
    const newPassword = document.getElementById('edit-team-password-input').value.trim();
    
    if (!newName) {
        showNotification('Veuillez entrer un nom d\'équipe', 'error');
        return;
    }
    
    try {
        const team = managementTeamsData.find(t => t.id === currentEditingTeamId);
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        // Préparer les données de mise à jour
        const updateData = {
            name: newName,
            color: newColor,
            updatedAt: new Date()
        };
        
        // Ajouter le mot de passe seulement s'il est fourni
        if (newPassword) {
            updateData.password = newPassword;
        }
        
        await firebaseService.updateTeam(currentEditingTeamId, updateData);
        
        hideEditTeamModal();
        showNotification(`✅ Équipe "${newName}" modifiée avec succès`, 'success');
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur modification équipe:', error);
        showNotification('Erreur lors de la modification', 'error');
    }
}

// ===== GESTION DES LOGS DE DEBUG =====

let currentLoadedLogs = null;

// Peupler le select avec les équipes
function populateTeamsLogsSelect() {
    const select = document.getElementById('team-logs-select');
    if (!select) return;
    
    // Garder l'option par défaut
    select.innerHTML = '<option value="">Sélectionner une équipe...</option>';
    
    // Ajouter toutes les équipes
    managementTeamsData.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = `${team.name} (${team.id})`;
        select.appendChild(option);
    });
}

// Charger les logs de debug d'une équipe
async function loadDebugLogs() {
    const teamId = document.getElementById('team-logs-select').value;
    const logsContainer = document.getElementById('debug-logs-list');
    const downloadBtn = document.getElementById('download-logs-btn');
    
    if (!teamId) {
        showNotification('⚠️ Veuillez sélectionner une équipe', 'warning');
        return;
    }
    
    if (!firebaseService) {
        showNotification('❌ Firebase non disponible', 'error');
        return;
    }
    
    try {
        logsContainer.innerHTML = '<p style="text-align: center; color: #666;">🔄 Chargement des logs...</p>';
        downloadBtn.style.display = 'none';
        
        console.log(`📥 Chargement logs pour équipe: ${teamId}`);
        const logs = await firebaseService.getTeamDebugLogs(teamId);
        
        currentLoadedLogs = { teamId, logs };
        
        if (!logs || logs.length === 0) {
            logsContainer.innerHTML = '<p class="no-data">Aucun log trouvé pour cette équipe</p>';
            showNotification('ℹ️ Aucun log trouvé', 'info');
            return;
        }
        
        console.log(`✅ ${logs.length} sessions de logs récupérées`);
        
        // Afficher les logs
        let html = `<div class="logs-summary">
            <strong>📊 ${logs.length} session(s) de logging trouvée(s)</strong>
        </div>`;
        
        logs.forEach((logSession, index) => {
            const sessionDate = new Date(logSession.createdAt).toLocaleString('fr-FR');
            const sessionId = logSession.sessionId || 'N/A';
            const logCount = logSession.logs ? logSession.logs.length : 0;
            
            html += `
                <div class="log-session-card">
                    <div class="log-session-header">
                        <div class="log-session-info">
                            <strong>Session ${index + 1}</strong>
                            <div class="log-meta">
                                📅 ${sessionDate}<br>
                                🆔 ${sessionId.substring(0, 40)}...
                            </div>
                        </div>
                        <span class="log-session-badge">
                            ${logCount} logs
                        </span>
                    </div>
                    
                    <div class="log-console-container">
            `;
            
            if (logSession.logs && logSession.logs.length > 0) {
                logSession.logs.forEach(log => {
                    const logClass = `log-${log.type}`;
                    
                    html += `<div class="log-entry ${logClass}">
                        <span class="log-timestamp">[${log.timestamp}]</span>
                        <span class="log-type ${log.type}">${log.type}</span>
                        ${escapeHtml(log.message)}
                    </div>`;
                });
            } else {
                html += '<div class="log-entry" style="color: rgba(255, 255, 255, 0.5);">Aucun log dans cette session</div>';
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        logsContainer.innerHTML = html;
        downloadBtn.style.display = 'inline-block';
        
        // Afficher aussi le bouton de suppression si des logs ont été chargés
        const deleteBtn = document.getElementById('delete-team-logs-btn');
        if (deleteBtn) {
            deleteBtn.style.display = 'inline-block';
        }
        
        showNotification(`✅ ${logs.length} session(s) chargée(s)`, 'success');
        
    } catch (error) {
        console.error('❌ Erreur chargement logs:', error);
        logsContainer.innerHTML = '<p class="no-data">❌ Erreur lors du chargement des logs</p>';
        showNotification('❌ Erreur lors du chargement', 'error');
    }
}

// Télécharger les logs en fichier texte
function downloadDebugLogsFile() {
    if (!currentLoadedLogs || !currentLoadedLogs.logs || currentLoadedLogs.logs.length === 0) {
        showNotification('❌ Aucun log à télécharger', 'error');
        return;
    }
    
    const { teamId, logs } = currentLoadedLogs;
    const team = managementTeamsData.find(t => t.id === teamId);
    const teamName = team ? team.name : 'Inconnu';
    
    // Créer le contenu du fichier
    let content = `=== LOGS DEBUG - ${teamName} (${teamId}) ===\n`;
    content += `Date de téléchargement: ${new Date().toLocaleString('fr-FR')}\n`;
    content += `Nombre de sessions: ${logs.length}\n`;
    content += `\n${'='.repeat(80)}\n\n`;
    
    logs.forEach((logSession, index) => {
        content += `--- Session ${index + 1} ---\n`;
        content += `Date: ${new Date(logSession.createdAt).toLocaleString('fr-FR')}\n`;
        content += `ID: ${logSession.sessionId}\n`;
        if (logSession.deviceInfo) {
            content += `Appareil: ${logSession.deviceInfo.platform} - ${logSession.deviceInfo.userAgent}\n`;
        }
        content += `\n`;
        
        if (logSession.logs && logSession.logs.length > 0) {
            logSession.logs.forEach(log => {
                content += `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}\n`;
            });
        }
        
        content += `\n${'='.repeat(80)}\n\n`;
    });
    
    // Télécharger le fichier
    const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${teamName}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('✅ Logs téléchargés', 'success');
}

// Fonction utilitaire pour échapper le HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Supprimer les logs d'une équipe
async function deleteTeamLogs() {
    const teamId = document.getElementById('team-logs-select').value;
    
    if (!teamId) {
        showNotification('⚠️ Veuillez sélectionner une équipe', 'warning');
        return;
    }
    
    const team = managementTeamsData.find(t => t.id === teamId);
    const teamName = team ? team.name : 'cette équipe';
    
    if (!confirm(`🗑️ Êtes-vous sûr de vouloir supprimer TOUS les logs de l'équipe "${teamName}" ?\n\nCette action est irréversible !`)) {
        return;
    }
    
    if (!firebaseService) {
        showNotification('❌ Firebase non disponible', 'error');
        return;
    }
    
    try {
        showNotification('🗑️ Suppression en cours...', 'info');
        
        const count = await firebaseService.deleteTeamDebugLogs(teamId);
        
        showNotification(`✅ ${count} log(s) supprimé(s) pour ${teamName}`, 'success');
        
        // Recharger les logs (affichera "Aucun log")
        loadDebugLogs();
        
    } catch (error) {
        console.error('❌ Erreur suppression logs équipe:', error);
        showNotification('❌ Erreur lors de la suppression', 'error');
    }
}

// Supprimer TOUS les logs de debug
async function deleteAllLogs() {
    if (!confirm(`🚨 ATTENTION ! Vous allez supprimer TOUS les logs de TOUTES les équipes !\n\nCette action est IRRÉVERSIBLE !\n\nVoulez-vous vraiment continuer ?`)) {
        return;
    }
    
    if (!confirm(`⚠️ Dernière confirmation : Supprimer TOUS les logs de debug ?`)) {
        return;
    }
    
    if (!firebaseService) {
        showNotification('❌ Firebase non disponible', 'error');
        return;
    }
    
    try {
        showNotification('🗑️ Suppression de tous les logs...', 'info');
        
        const count = await firebaseService.deleteAllDebugLogs();
        
        showNotification(`✅ ${count} log(s) supprimé(s) au total`, 'success');
        
        // Réinitialiser l'affichage
        const logsContainer = document.getElementById('debug-logs-list');
        const downloadBtn = document.getElementById('download-logs-btn');
        const deleteBtn = document.getElementById('delete-team-logs-btn');
        
        if (logsContainer) {
            logsContainer.innerHTML = '<p class="no-data">Tous les logs ont été supprimés</p>';
        }
        
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        currentLoadedLogs = null;
        
    } catch (error) {
        console.error('❌ Erreur suppression tous les logs:', error);
        showNotification('❌ Erreur lors de la suppression', 'error');
    }
}

// ===== CARTE DE TRACKING EN TEMPS RÉEL =====
let trackingMap = null;
let trackingTeamMarkers = {};
let trackingCheckpointMarkers = {};
let trackingUpdateInterval = null;

// Couleurs pour différencier les équipes
const teamColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#c0392b'];

function startTrackingUpdates() {
    // Démarrer les mises à jour automatiques toutes les 5 secondes
    if (trackingUpdateInterval) {
        clearInterval(trackingUpdateInterval);
    }
    trackingUpdateInterval = setInterval(() => {
        updateTrackingMap();
    }, 5000);
}

async function initializeTrackingMap() {
    try {
        // Vérifier que les données sont chargées
        if (!checkpointsData || checkpointsData.length === 0) {
            await loadCheckpoints();
        }
        
        if (checkpointsData.length === 0) {
            showNotification('⚠️ Aucun checkpoint créé', 'warning');
            return;
        }
        
        // Calculer le centre par défaut (moyenne des checkpoints)
        const avgLat = checkpointsData.reduce((sum, cp) => sum + cp.coordinates[0], 0) / checkpointsData.length;
        const avgLng = checkpointsData.reduce((sum, cp) => sum + cp.coordinates[1], 0) / checkpointsData.length;
        
        // Créer la carte
        trackingMap = L.map('tracking-live-map').setView([avgLat, avgLng], 14);
        
        // Ajouter les tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(trackingMap);
        
        // Ajouter tous les checkpoints (en gris/transparents)
        checkpointsData.forEach(checkpoint => {
            const marker = L.marker(checkpoint.coordinates, {
                icon: L.divIcon({
                    className: 'tracking-checkpoint-marker',
                    html: `<div style="font-size: 20px; opacity: 0.5;">${checkpoint.emoji}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                })
            }).addTo(trackingMap);
            
            marker.bindPopup(`
                <strong>${checkpoint.emoji} ${checkpoint.name}</strong><br>
                <small>Type: ${checkpoint.type}</small>
            `);
            
            trackingCheckpointMarkers[checkpoint.id] = marker;
        });
        
        // Ajouter les marqueurs des équipes
        updateTrackingMap();
        
        // Forcer le redimensionnement de la carte
        setTimeout(() => {
            trackingMap.invalidateSize();
        }, 200);
        
        console.log('✅ Carte de tracking initialisée');
        
    } catch (error) {
        console.error('❌ Erreur initialisation carte tracking:', error);
        showNotification('Erreur lors de l\'initialisation de la carte', 'error');
    }
}

function updateTrackingMap() {
    if (!trackingMap) return;
    
    // Filtrer les équipes qui ont une position GPS
    const teamsWithPosition = teamsData.filter(team => 
        team.lastPosition && 
        team.lastPosition.lat && 
        team.lastPosition.lng
    );
    
    // Mettre à jour le compteur
    document.getElementById('tracking-teams-count').textContent = `${teamsWithPosition.length} équipe(s) en jeu`;
    document.getElementById('tracking-last-update').textContent = `Dernière mise à jour : ${new Date().toLocaleTimeString()}`;
    
    // Supprimer les anciens markers des équipes qui n'existent plus
    Object.keys(trackingTeamMarkers).forEach(teamId => {
        if (!teamsWithPosition.find(t => t.id === teamId)) {
            trackingMap.removeLayer(trackingTeamMarkers[teamId].marker);
            if (trackingTeamMarkers[teamId].accuracyCircle) {
                trackingMap.removeLayer(trackingTeamMarkers[teamId].accuracyCircle);
            }
            delete trackingTeamMarkers[teamId];
        }
    });
    
    // Mettre à jour ou créer les markers des équipes
    teamsWithPosition.forEach((team, index) => {
        const position = [team.lastPosition.lat, team.lastPosition.lng];
        const color = teamColors[index % teamColors.length];
        
        // Calculer la progression
        const progress = getTeamProgress(team);
        const foundCount = team.foundCheckpoints.filter(id => {
            const cp = checkpointsData.find(c => c.id === id);
            return cp && !cp.isLobby;
        }).length;
        const totalCount = team.route.filter(id => {
            const cp = checkpointsData.find(c => c.id === id);
            return cp && !cp.isLobby;
        }).length;
        
        // Trouver le prochain checkpoint
        const nextCheckpoint = getNextUnlockedCheckpoint(team);
        
        if (trackingTeamMarkers[team.id]) {
            // Mettre à jour la position existante
            trackingTeamMarkers[team.id].marker.setLatLng(position);
            trackingTeamMarkers[team.id].marker.setPopupContent(`
                <div style="min-width: 200px;">
                    <h3 style="color: ${color}; margin: 0 0 10px 0;">${team.name}</h3>
                    <div style="margin: 5px 0;">
                        <strong>📊 Progression:</strong> ${foundCount}/${totalCount} (${progress}%)
                    </div>
                    <div style="margin: 5px 0;">
                        <strong>📍 Prochain objectif:</strong><br>${nextCheckpoint}
                    </div>
                    <div style="margin: 5px 0;">
                        <strong>🕐 Position mise à jour:</strong><br>${new Date(team.updatedAt?.seconds * 1000 || Date.now()).toLocaleTimeString()}
                    </div>
                    ${team.lastPosition.accuracy ? `<div style="margin: 5px 0; color: #7f8c8d;"><small>Précision GPS: ±${Math.round(team.lastPosition.accuracy)}m</small></div>` : ''}
                </div>
            `);
            
            // Mettre à jour le cercle de précision GPS
            if (team.lastPosition.accuracy && trackingTeamMarkers[team.id].accuracyCircle) {
                trackingTeamMarkers[team.id].accuracyCircle.setLatLng(position);
                trackingTeamMarkers[team.id].accuracyCircle.setRadius(team.lastPosition.accuracy);
            } else if (team.lastPosition.accuracy && !trackingTeamMarkers[team.id].accuracyCircle) {
                // Créer le cercle s'il n'existe pas
                trackingTeamMarkers[team.id].accuracyCircle = L.circle(position, {
                    radius: team.lastPosition.accuracy,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 1,
                    opacity: 0.4
                }).addTo(trackingMap);
            }
        } else {
            // Créer un nouveau marker
            const marker = L.marker(position, {
                icon: L.divIcon({
                    className: 'tracking-team-marker',
                    html: `
                        <div style="
                            background-color: ${color};
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            border: 3px solid white;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: bold;
                            color: white;
                            font-size: 14px;
                        ">
                            ${team.name.substring(0, 2).toUpperCase()}
                        </div>
                    `,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                })
            }).addTo(trackingMap);
            
            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <h3 style="color: ${color}; margin: 0 0 10px 0;">${team.name}</h3>
                    <div style="margin: 5px 0;">
                        <strong>📊 Progression:</strong> ${foundCount}/${totalCount} (${progress}%)
                    </div>
                    <div style="margin: 5px 0;">
                        <strong>📍 Prochain objectif:</strong><br>${nextCheckpoint}
                    </div>
                    <div style="margin: 5px 0;">
                        <strong>🕐 Position mise à jour:</strong><br>${new Date(team.updatedAt?.seconds * 1000 || Date.now()).toLocaleTimeString()}
                    </div>
                    ${team.lastPosition.accuracy ? `<div style="margin: 5px 0; color: #7f8c8d;"><small>Précision GPS: ±${Math.round(team.lastPosition.accuracy)}m</small></div>` : ''}
                </div>
            `);
            
            // Créer le cercle de précision GPS
            let accuracyCircle = null;
            if (team.lastPosition.accuracy) {
                accuracyCircle = L.circle(position, {
                    radius: team.lastPosition.accuracy,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 1,
                    opacity: 0.4
                }).addTo(trackingMap);
            }
            
            trackingTeamMarkers[team.id] = {
                marker: marker,
                accuracyCircle: accuracyCircle
            };
        }
    });
    
    // Mettre à jour la liste des équipes dans la légende
    updateTrackingLegend(teamsWithPosition);
}

function updateTrackingLegend(teams) {
    const legendList = document.getElementById('tracking-teams-list');
    
    if (teams.length === 0) {
        legendList.innerHTML = '<p>Aucune équipe avec position GPS</p>';
        return;
    }
    
    legendList.innerHTML = teams.map((team, index) => {
        const color = teamColors[index % teamColors.length];
        const progress = getTeamProgress(team);
        const foundCount = team.foundCheckpoints.filter(id => {
            const cp = checkpointsData.find(c => c.id === id);
            return cp && !cp.isLobby;
        }).length;
        const totalCount = team.route.filter(id => {
            const cp = checkpointsData.find(c => c.id === id);
            return cp && !cp.isLobby;
        }).length;
        
        return `
            <div class="tracking-team-item" onclick="centerOnTeam('${team.id}')" style="cursor: pointer; padding: 10px; margin: 5px 0; border-left: 4px solid ${color}; background: #f8f9fa; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="
                        background-color: ${color};
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: 2px solid white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: white;
                        font-size: 11px;
                        flex-shrink: 0;
                    ">${team.name.substring(0, 2).toUpperCase()}</div>
                    <div style="flex: 1;">
                        <strong>${team.name}</strong>
                        <div style="font-size: 12px; color: #666;">
                            ${foundCount}/${totalCount} checkpoints (${progress}%)
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function centerOnTeam(teamId) {
    const team = teamsData.find(t => t.id === teamId);
    if (team && team.lastPosition && trackingMap) {
        trackingMap.setView([team.lastPosition.lat, team.lastPosition.lng], 16);
        
        // Ouvrir le popup du marker
        if (trackingTeamMarkers[teamId] && trackingTeamMarkers[teamId].marker) {
            trackingTeamMarkers[teamId].marker.openPopup();
        }
    }
}

function centerOnAllTeams() {
    if (!trackingMap) return;
    
    const teamsWithPosition = teamsData.filter(team => 
        team.lastPosition && 
        team.lastPosition.lat && 
        team.lastPosition.lng
    );
    
    if (teamsWithPosition.length === 0) {
        showNotification('⚠️ Aucune équipe avec position GPS', 'warning');
        return;
    }
    
    // Créer un groupe de toutes les positions
    const bounds = L.latLngBounds(
        teamsWithPosition.map(team => [team.lastPosition.lat, team.lastPosition.lng])
    );
    
    // Centrer la carte sur toutes les équipes
    trackingMap.fitBounds(bounds, { padding: [50, 50] });
}

// Event listener pour le bouton de centrage
document.getElementById('tracking-center-all-btn')?.addEventListener('click', centerOnAllTeams);

// Exposer les nouvelles fonctions globalement
window.toggleCheckpointSelection = toggleCheckpointSelection;
window.removeCheckpointFromSelection = removeCheckpointFromSelection;
window.updateCreateRouteSelection = updateCreateRouteSelection;
window.loadDebugLogs = loadDebugLogs;
window.downloadDebugLogsFile = downloadDebugLogsFile;
window.deleteTeamLogs = deleteTeamLogs;
window.deleteAllLogs = deleteAllLogs;
window.centerOnTeam = centerOnTeam;
