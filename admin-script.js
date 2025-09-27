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

// Configuration admin - Emails autorisés
const ADMIN_CONFIG = {
    authorizedEmails: [
        'tran@go-inicio.com'
        // 'autre.admin@gmail.com' // Autres admins si besoin
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
                <small>${team.foundCheckpoints.filter(id => id !== 0).length} / ${team.route.filter(id => id !== 0).length} défis résolus</small>
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
                <button class="unlock-btn" onclick="unlockNextCheckpoint('${team.id}')">
                    🔓 Débloquer suivant
                </button>
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
        
        const typeText = helpRequest.type === 'location' ? 'Localisation' : 'Énigme';
        const typeIcon = helpRequest.type === 'location' ? '📍' : '🧩';
        
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
    // Exclure le lobby (ID 0) du calcul de progression
    const nonLobbyFound = team.foundCheckpoints.filter(id => id !== 0);
    const nonLobbyTotal = team.route.filter(id => id !== 0).length;
    
    if (nonLobbyTotal === 0) return 0;
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
        
        // Déterminer le statut et la couleur
        let statusIcon, statusText, statusColor;
        
        if (isFound) {
            statusIcon = '✅';
            statusText = 'trouvé';
            statusColor = '#27ae60';
        } else if (isUnlocked) {
            statusIcon = '🔓';
            statusText = 'débloqué';
            statusColor = '#f39c12';
        } else {
            statusIcon = '⏳';
            statusText = 'à débloquer';
            statusColor = '#95a5a6';
        }
        
        progressHTML += `
            <div class="checkpoint-progress-item" style="color: ${statusColor};">
                ${statusIcon} ${index + 1}. ${checkpointName} <small>(${statusText})</small>
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
async function unlockNextCheckpoint(teamId) {
    try {
        const team = teamsData.find(t => t.id === teamId);
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        // SYSTÈME SIMPLIFIÉ : On se base UNIQUEMENT sur foundCheckpoints
        const foundCheckpoints = team.foundCheckpoints || [];
        const teamRoute = team.route || [];
        
        console.log(`🔓 SYSTÈME SIMPLIFIÉ - Recherche prochain checkpoint pour ${team.name}:`, {
            route: teamRoute,
            found: foundCheckpoints
        });
        
        // Chercher le PREMIER checkpoint de la route qui n'est PAS ENCORE DÉBLOQUÉ
        // (Logique : on débloque les checkpoints dans l'ordre, pas selon les trouvés)
        const currentUnlockedTemp = team.unlockedCheckpoints || [0];
        let nextCheckpointId = null;
        
        for (const checkpointId of teamRoute) {
            if (checkpointId === 0) continue; // Ignorer le lobby
            
            const isFound = foundCheckpoints.includes(checkpointId);
            const isUnlocked = currentUnlockedTemp.includes(checkpointId);
            
            console.log(`  Checkpoint ${checkpointId}: found=${isFound}, unlocked=${isUnlocked}`);
            
            // On cherche le premier checkpoint PAS ENCORE DÉBLOQUÉ ET PAS ENCORE TROUVÉ
            // (Un checkpoint trouvé ne doit JAMAIS être redébloqué !)
            if (!isUnlocked && !isFound) {
                nextCheckpointId = checkpointId;
                console.log(`  ➡️ À débloquer (rendre accessible): ${checkpointId}`);
                break;
            } else if (isFound && !isUnlocked) {
                console.log(`  ⚠️ INCOHÉRENCE: Checkpoint ${checkpointId} trouvé mais pas débloqué - IGNORÉ`);
            }
        }
        
        if (!nextCheckpointId) {
            // Vérifier s'il y a des incohérences à corriger (checkpoints trouvés mais pas débloqués)
            const foundButNotUnlocked = foundCheckpoints.filter(id => !currentUnlockedTemp.includes(id));
            if (foundButNotUnlocked.length > 0) {
                console.log(`🔧 CORRECTION AUTO: Checkpoints trouvés mais pas débloqués:`, foundButNotUnlocked);
                showNotification(`🔧 Correction automatique des incohérences pour ${team.name}`, 'info');
                
                // Auto-corriger en ajoutant les checkpoints trouvés aux débloqués
                const correctedUnlocked = [...new Set([...currentUnlockedTemp, ...foundCheckpoints])];
                await firebaseService.updateTeamProgress(teamId, {
                    unlockedCheckpoints: correctedUnlocked
                });
                return;
            }
            
            showNotification(`Équipe ${team.name} a déjà tous ses checkpoints disponibles`, 'warning');
            return;
        }
        
        console.log(`🔧 Checkpoint trouvé à débloquer: ${nextCheckpointId}`);
        console.log(`🔧 Team data:`, team);
        
        // NOUVEAU : On ajoute le checkpoint aux "unlockedCheckpoints" pour le rendre accessible
        // Mais on garde la logique basée sur foundCheckpoints comme référence
        let currentUnlocked;
        try {
            currentUnlocked = team.unlockedCheckpoints || [0];
            console.log(`🔧 currentUnlocked extrait:`, currentUnlocked);
        } catch (error) {
            console.error(`❌ Erreur extraction unlockedCheckpoints:`, error);
            currentUnlocked = [0];
        }
        console.log(`🔧 currentUnlocked:`, currentUnlocked);
        console.log(`🔧 nextCheckpointId:`, nextCheckpointId);
        console.log(`🔧 includes check:`, currentUnlocked.includes(nextCheckpointId));
        
        if (!currentUnlocked.includes(nextCheckpointId)) {
            // AVANT de débloquer, corriger les incohérences (checkpoints trouvés doivent être débloqués)
            const correctedUnlocked = [...new Set([...currentUnlocked, ...foundCheckpoints, 0])]; // Merge + dédoublonner
            const finalUnlocked = [...correctedUnlocked, nextCheckpointId];
            
            console.log(`🔧 Avant update Firebase:`, {
                correctedUnlocked,
                finalUnlocked,
                teamId
            });
            
            try {
                await firebaseService.updateTeamProgress(teamId, {
                    unlockedCheckpoints: finalUnlocked
                });
                console.log(`✅ Firebase update réussi !`);
            } catch (error) {
                console.error(`❌ Erreur Firebase update:`, error);
                throw error;
            }
        } else {
            console.log(`ℹ️ Checkpoint ${nextCheckpointId} déjà dans unlocked:`, currentUnlocked);
            showNotification(`Checkpoint ${nextCheckpointId} déjà accessible pour ${team.name}`, 'info');
            return;
        }
        
        // Trouver le nom du checkpoint
        const checkpointsData = await firebaseService.getAllCheckpoints();
        const checkpoint = checkpointsData.find(cp => cp.id === nextCheckpointId);
        const checkpointName = checkpoint ? checkpoint.name : `Point ${nextCheckpointId}`;
        
        console.log(`🔓 Admin rend accessible checkpoint ${nextCheckpointId} (${checkpointName}) pour équipe ${team.name}`);
        showNotification(`✅ "${checkpointName}" rendu accessible pour ${team.name}`, 'success');
        
    } catch (error) {
        console.error('Erreur déblocage checkpoint:', error);
        showNotification('❌ Erreur lors du déblocage', 'error');
    }
}

async function resetTeam(teamId) {
    if (!confirm('Êtes-vous sûr de vouloir reset cette équipe ?')) return;
    
    try {
        await firebaseService.resetTeam(teamId);
        const team = teamsData.find(t => t.id === teamId);
        showNotification(`🔄 Équipe ${team?.name} resetée`, 'success');
    } catch (error) {
        console.error('Erreur reset équipe:', error);
        showNotification('❌ Erreur lors du reset', 'error');
    }
}

async function approveValidation(validationId) {
    try {
        await firebaseService.updateValidation(validationId, 'approved', 'Validé par admin');
        showNotification('✅ Validation approuvée', 'success');
    } catch (error) {
        console.error('Erreur approbation:', error);
        showNotification('❌ Erreur lors de l\'approbation', 'error');
    }
}

async function rejectValidation(validationId) {
    const reason = prompt('Raison du rejet (optionnel):') || 'Rejeté par admin';
    
    try {
        await firebaseService.updateValidation(validationId, 'rejected', reason);
        showNotification('❌ Validation rejetée', 'info');
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

async function cleanupAllData() {
    console.log('🚨 cleanupAllData() appelée');
    
    if (!confirm('🚨 NETTOYAGE COMPLET FIREBASE\n\nCela va supprimer TOUTES les données :\n• Tous les utilisateurs\n• Toutes les équipes\n• Tous les checkpoints\n• Tous les parcours\n\n⚠️ Cette action est IRRÉVERSIBLE !\n\nTaper "SUPPRIMER TOUT" pour confirmer:')) {
        console.log('❌ Nettoyage complet annulé par utilisateur');
        return;
    }
    
    const confirmation = prompt('Tapez "SUPPRIMER TOUT" en majuscules pour confirmer :');
    if (confirmation !== 'SUPPRIMER TOUT') {
        showNotification('❌ Nettoyage annulé', 'info');
        return;
    }
    
    try {
        showNotification('🧹 Nettoyage complet de Firebase...', 'info');
        
        const result = await firebaseService.cleanupAllData();
        
        showNotification(
            `✅ Firebase nettoyé ! Supprimé : ${result.users} users, ${result.teams} teams, ${result.checkpoints} checkpoints, ${result.routes} routes`, 
            'success'
        );
        
        // Actualiser l'interface
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur nettoyage complet:', error);
        showNotification('❌ Erreur lors du nettoyage complet', 'error');
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
        
        const typeText = helpRequest.type === 'location' ? 'localisation' : 'résolution d\'énigme';
        
        if (!confirm(`Accorder l'aide (${typeText}) pour "${checkpointName}" à l'équipe "${teamName}" ?`)) {
            return;
        }
        
        showNotification('🔄 Traitement de la demande d\'aide...', 'info');
        
        await firebaseService.resolveHelpRequest(helpId, 'granted', `Aide accordée par admin`);
        
        showNotification(`✅ Aide accordée à l'équipe "${teamName}" pour "${checkpointName}"`, 'success');
        
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
        
    } catch (error) {
        console.error('❌ Erreur lors du refus d\'aide:', error);
        showNotification('❌ Erreur lors du traitement', 'error');
    }
}

// Exposer les fonctions globalement pour les onclick
window.initializeAdmin = initializeAdmin;
window.unlockNextCheckpoint = unlockNextCheckpoint;
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
window.grantHelpRequest = grantHelpRequest;
window.denyHelpRequest = denyHelpRequest;

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
let checkpointsData = [];
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
                <span class="drag-handle">⋮⋮</span>
                <span class="checkpoint-info">${checkpoint.emoji} ${checkpoint.name}</span>
                <span class="checkpoint-type">${checkpoint.type}</span>
            `;
            orderList.appendChild(item);
        });

        // Ajouter la fonctionnalité drag & drop
        setupDragAndDrop();
    } catch (error) {
        console.error('❌ Erreur chargement checkpoints:', error);
    }
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
    const orderItems = document.querySelectorAll('.checkpoint-order-item');
    
    if (!name) {
        showNotification('Veuillez entrer un nom de parcours', 'error');
        return;
    }

    if (orderItems.length === 0) {
        showNotification('Aucun checkpoint disponible', 'error');
        return;
    }

    const route = Array.from(orderItems).map(item => parseInt(item.dataset.checkpointId));

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
            item.className = 'checkpoint-checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="checkpoint-${checkpoint.id}" 
                       value="${checkpoint.id}" ${isSelected ? 'checked' : ''}
                       onchange="toggleCheckpointSelection(${checkpoint.id}, this.checked)">
                <label for="checkpoint-${checkpoint.id}">
                    ${checkpoint.emoji} ${checkpoint.name} (${checkpoint.type})
                </label>
            `;
            checkpointsList.appendChild(item);
        });
        
        // Mettre à jour l'ordre initial
        updateSelectedCheckpointsOrder();
        
    } catch (error) {
        console.error('❌ Erreur chargement checkpoints pour modification:', error);
    }
}

function toggleCheckpointSelection(checkpointId, isSelected) {
    if (isSelected) {
        if (!selectedCheckpoints.includes(checkpointId)) {
            selectedCheckpoints.push(checkpointId);
        }
    } else {
        selectedCheckpoints = selectedCheckpoints.filter(id => id !== checkpointId);
    }
    
    updateSelectedCheckpointsOrder();
}

function updateSelectedCheckpointsOrder() {
    const orderContainer = document.getElementById('selected-checkpoints-order');
    
    if (selectedCheckpoints.length === 0) {
        orderContainer.innerHTML = '<p>Sélectionnez des checkpoints ci-dessus</p>';
        return;
    }
    
    orderContainer.innerHTML = '';
    selectedCheckpoints.forEach((checkpointId, index) => {
        const checkpoint = checkpointsData.find(cp => cp.id === checkpointId);
        const checkpointName = checkpoint ? `${checkpoint.emoji} ${checkpoint.name}` : `Point ${checkpointId}`;
        
        const item = document.createElement('div');
        item.className = 'selected-checkpoint-item';
        item.draggable = true;
        item.dataset.checkpointId = checkpointId;
        item.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <span class="checkpoint-info">${index + 1}. ${checkpointName}</span>
            <button class="remove-btn" onclick="removeCheckpointFromSelection(${checkpointId})" title="Retirer">×</button>
        `;
        
        // Ajouter les événements drag & drop
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        
        orderContainer.appendChild(item);
    });
    
    // Configurer le drop zone
    orderContainer.addEventListener('dragover', handleDragOver);
    orderContainer.addEventListener('drop', handleDrop);
}

function removeCheckpointFromSelection(checkpointId) {
    selectedCheckpoints = selectedCheckpoints.filter(id => id !== checkpointId);
    
    // Décocher la checkbox correspondante
    const checkbox = document.getElementById(`checkpoint-${checkpointId}`);
    if (checkbox) checkbox.checked = false;
    
    updateSelectedCheckpointsOrder();
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
    
    // Reconstruire l'ordre des checkpoints selon l'ordre des éléments DOM
    const items = document.querySelectorAll('.selected-checkpoint-item');
    selectedCheckpoints = Array.from(items).map(item => parseInt(item.dataset.checkpointId));
    
    updateSelectedCheckpointsOrder();
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.selected-checkpoint-item:not(.dragging)')];
    
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
        const routeData = {
            name: newName,
            route: selectedCheckpoints,
            updatedAt: new Date()
        };
        
        await firebaseService.updateRoute(currentEditingRouteId, routeData);
        
        hideEditRouteModal();
        showNotification(`✅ Parcours "${newName}" modifié avec succès`, 'success');
        loadRoutes();
        
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

// Exposer les nouvelles fonctions globalement
window.toggleCheckpointSelection = toggleCheckpointSelection;
window.removeCheckpointFromSelection = removeCheckpointFromSelection;
