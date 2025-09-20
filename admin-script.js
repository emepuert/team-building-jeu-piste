// Script Admin - Jeu de Piste
console.log('🔧 Admin Script chargé');

// Variables globales
let firebaseService = null;
let firebaseAuth = null;
let isAuthenticated = false;
let currentUser = null;
let teamsData = [];
let validationsData = [];
let usersData = [];
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
    
    // Gestion équipes et utilisateurs
    document.getElementById('create-team-btn').addEventListener('click', showCreateTeamModal);
    document.getElementById('create-user-btn').addEventListener('click', showCreateUserModal);
    
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
    });
    
    // Écouter les validations en attente (temporairement désactivé - problème d'index Firebase)
    // firebaseService.onValidationRequests((validations) => {
    //     console.log('⏳ Validations en attente:', validations);
    //     validationsData = validations;
    //     updateValidationsDisplay();
    //     updateStats();
    // });
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
                <p><strong>Checkpoint actuel:</strong> ${getCurrentCheckpointName(team)}</p>
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
    
    validationsContainer.innerHTML = validationsData.map(validation => `
        <div class="validation-card">
            <div class="validation-header">
                <div>
                    <h4>${getTeamName(validation.teamId)} - ${getCheckpointName(validation.checkpointId)}</h4>
                    <span class="validation-type">${validation.type.toUpperCase()}</span>
                </div>
                <small>${formatDate(validation.createdAt)}</small>
            </div>
            
            <div class="validation-content">
                <p><strong>Données:</strong> ${validation.data}</p>
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
    `).join('');
}

// Mise à jour des statistiques
function updateStats() {
    document.getElementById('active-teams-count').textContent = teamsData.filter(t => t.status === 'active').length;
    document.getElementById('pending-validations-count').textContent = validationsData.length;
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
        if (!team) return;
        
        const nextCheckpointId = team.currentCheckpoint + 1;
        await firebaseService.unlockCheckpointForTeam(teamId, nextCheckpointId);
        showNotification(`✅ Checkpoint ${nextCheckpointId} débloqué pour ${team.name}`, 'success');
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
    console.log('👥 usersData:', usersData);
    console.log('🔍 Longueurs:', {teams: managementTeamsData.length, users: usersData.length});
    
    if (!confirm('🏠 Remettre toutes les équipes au lobby ? Cela va effacer toute la progression actuelle.')) {
        console.log('❌ Reset annulé par l\'utilisateur');
        return;
    }
    
    try {
        showNotification('🔄 Reset des progressions en cours...', 'info');
        console.log('🚀 Début du reset...');
        
        let resetCount = 0;
        
        // Reset chaque équipe
        console.log(`🏆 Reset de ${managementTeamsData.length} équipes...`);
        for (const team of managementTeamsData) {
            console.log(`🔄 Reset équipe: ${team.name} (${team.id})`);
            await firebaseService.resetTeam(team.id);
            resetCount++;
            console.log(`✅ Équipe ${team.name} resetée`);
        }
        
        // Reset tous les utilisateurs
        console.log(`👤 Reset de ${usersData.length} utilisateurs...`);
        for (const user of usersData) {
            console.log(`🔄 Reset utilisateur: ${user.name} (${user.userId})`);
            await firebaseService.resetUser(user.userId);
            console.log(`✅ Utilisateur ${user.name} reseté`);
        }
        
        console.log(`🎉 Reset terminé: ${resetCount} équipes`);
        
        // Vider le localStorage pour forcer le rechargement des données
        console.log('🗑️ Nettoyage localStorage...');
        if (typeof(Storage) !== "undefined") {
            // Supprimer les données utilisateur en cache
            localStorage.removeItem('currentUserId');
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
        
        // Reset tous les utilisateurs de cette équipe
        const teamUsers = usersData.filter(user => user.teamId === teamId);
        console.log(`👤 Reset de ${teamUsers.length} utilisateurs de l'équipe...`);
        
        for (const user of teamUsers) {
            console.log(`🔄 Reset utilisateur: ${user.name} (${user.userId})`);
            await firebaseService.resetUser(user.userId);
            console.log(`✅ Utilisateur ${user.name} reseté`);
        }
        
        // Vider le localStorage pour cette équipe (si des utilisateurs sont connectés)
        console.log('🗑️ Nettoyage localStorage...');
        if (typeof(Storage) !== "undefined") {
            localStorage.removeItem('currentUserId');
            console.log('✅ localStorage nettoyé');
        }
        
        console.log(`🎉 Reset équipe "${team.name}" terminé`);
        showNotification(`✅ Équipe "${team.name}" remise au lobby ! Les joueurs doivent recharger la page.`, 'success');
        
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

// Exposer les fonctions globalement pour les onclick
window.initializeAdmin = initializeAdmin;
window.unlockNextCheckpoint = unlockNextCheckpoint;
window.resetTeam = resetTeam;
window.resetTeamProgression = resetTeamProgression;
window.approveValidation = approveValidation;
window.rejectValidation = rejectValidation;
window.showTeamDetails = showTeamDetails;
window.deleteTeam = deleteTeam;
window.deleteUser = deleteUser;
window.resetUser = resetUser;

    console.log('✅ Admin Script initialisé');

// ===== GESTION DES MODALS =====

function setupModalEvents() {
    // Modal création équipe
    document.getElementById('cancel-team-btn').addEventListener('click', hideCreateTeamModal);
    document.getElementById('create-team-form').addEventListener('submit', handleCreateTeam);
    
    // Modal création utilisateur
    document.getElementById('cancel-user-btn').addEventListener('click', hideCreateUserModal);
    document.getElementById('create-user-form').addEventListener('submit', handleCreateUser);
    
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
    
    // Changement de type de checkpoint
    document.getElementById('checkpoint-type').addEventListener('change', updateDynamicContent);
    
    // Modal création parcours
    document.getElementById('cancel-route-btn').addEventListener('click', hideCreateRouteModal);
    document.getElementById('create-route-form').addEventListener('submit', (e) => {
        e.preventDefault();
        createRoute();
    });
    
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
        const routes = await firebaseService.getAllRoutes();
        const select = document.getElementById('team-route');
        
        // Vider les options existantes (sauf la première)
        select.innerHTML = '<option value="">-- Choisir un parcours --</option>';
        
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
        
        console.log('✅ Parcours chargés dans le sélecteur:', routes.length);
    } catch (error) {
        console.error('❌ Erreur chargement parcours pour sélection:', error);
        const select = document.getElementById('team-route');
        select.innerHTML = '<option value="">-- Erreur chargement --</option>';
    }
}

function hideCreateTeamModal() {
    document.getElementById('create-team-modal').style.display = 'none';
    document.getElementById('create-team-form').reset();
    document.body.classList.remove('modal-open');
}

function showCreateUserModal() {
    // Mettre à jour la liste des équipes disponibles
    updateTeamSelectOptions();
    document.getElementById('create-user-modal').style.display = 'flex';
    document.body.classList.add('modal-open');
}

function hideCreateUserModal() {
    document.getElementById('create-user-modal').style.display = 'none';
    document.getElementById('create-user-form').reset();
    document.body.classList.remove('modal-open');
}

function updateTeamSelectOptions() {
    const teamSelect = document.getElementById('user-team');
    teamSelect.innerHTML = '<option value="">-- Choisir une équipe --</option>';
    
    managementTeamsData.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });
}

// ===== CRÉATION D'ÉQUIPES =====

async function handleCreateTeam(e) {
    e.preventDefault();
    
    const teamName = document.getElementById('team-name').value.trim();
    const teamColor = document.getElementById('team-color').value;
    const teamRoute = document.getElementById('team-route').value.split(',').map(Number);
    
    if (!teamName || !teamRoute.length) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    try {
        const teamData = {
            name: teamName,
            color: teamColor,
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

// ===== CRÉATION D'UTILISATEURS =====

async function handleCreateUser(e) {
    e.preventDefault();
    
    const userName = document.getElementById('user-name').value.trim();
    const userId = document.getElementById('user-id-input').value.trim();
    const userPassword = document.getElementById('user-password-input').value;
    const teamId = document.getElementById('user-team').value;
    
    if (!userName || !userId || !userPassword || !teamId) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    try {
        // Vérifier si l'ID utilisateur existe déjà
        const existingUser = await firebaseService.getUser(userId);
        if (existingUser) {
            showNotification('Cet identifiant existe déjà', 'error');
            return;
        }
        
        // Récupérer les infos de l'équipe
        const team = managementTeamsData.find(t => t.id === teamId);
        if (!team) {
            showNotification('Équipe non trouvée', 'error');
            return;
        }
        
        const userData = {
            userId: userId,
            name: userName,
            password: userPassword,
            teamId: teamId,
            teamName: team.name
        };
        
        await firebaseService.createUser(userData);
        console.log('✅ Utilisateur créé:', userId);
        
        hideCreateUserModal();
        showNotification(`Utilisateur "${userName}" créé avec succès !`, 'success');
        
        // Actualiser la liste
        loadManagementData();
        
    } catch (error) {
        console.error('❌ Erreur création utilisateur:', error);
        showNotification('Erreur lors de la création de l\'utilisateur', 'error');
    }
}

// ===== CHARGEMENT DES DONNÉES DE GESTION =====

async function loadManagementData() {
    try {
        // Charger les équipes pour la gestion
        managementTeamsData = await firebaseService.getAllTeams();
        updateTeamsManagementDisplay();
        
        // Charger les utilisateurs
        usersData = await firebaseService.getAllUsers();
        updateUsersManagementDisplay();
        
        // Charger les checkpoints et parcours
        loadCheckpoints();
        loadRoutes();
        
    } catch (error) {
        console.error('❌ Erreur chargement données gestion:', error);
    }
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
                <button class="delete-btn" onclick="deleteTeam('${team.id}')">🗑️ Supprimer</button>
            </div>
        </div>
    `).join('');
}

function updateUsersManagementDisplay() {
    const container = document.getElementById('users-management-list');
    
    if (usersData.length === 0) {
        container.innerHTML = '<p class="no-data">Aucun utilisateur créé</p>';
        return;
    }
    
    container.innerHTML = usersData.map(user => `
        <div class="management-item">
            <div class="management-item-info">
                <h4>${user.name}</h4>
                <p><strong>ID:</strong> ${user.userId}</p>
                <p><strong>Équipe:</strong> ${user.teamName}</p>
                <p><strong>Progression:</strong> ${user.foundCheckpoints?.length || 0} points trouvés</p>
            </div>
            <div class="management-actions">
                <button class="reset-btn" onclick="resetUser('${user.userId}')">🔄 Reset</button>
                <button class="delete-btn" onclick="deleteUser('${user.userId}')">🗑️ Supprimer</button>
            </div>
        </div>
    `).join('');
}

// ===== ACTIONS DE GESTION =====

async function deleteTeam(teamId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette équipe ?')) return;
    
    try {
        await firebaseService.deleteTeam(teamId);
        showNotification('Équipe supprimée', 'success');
        loadManagementData();
    } catch (error) {
        console.error('❌ Erreur suppression équipe:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    
    try {
        await firebaseService.deleteUser(userId);
        showNotification('Utilisateur supprimé', 'success');
        loadManagementData();
    } catch (error) {
        console.error('❌ Erreur suppression utilisateur:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

async function resetUser(userId) {
    if (!confirm('Êtes-vous sûr de vouloir reset cet utilisateur ?')) return;
    
    try {
        await firebaseService.resetUser(userId);
        showNotification('Utilisateur reseté', 'success');
        loadManagementData();
    } catch (error) {
        console.error('❌ Erreur reset utilisateur:', error);
        showNotification('Erreur lors du reset', 'error');
    }
}

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
        // Utiliser l'API Nominatim d'OpenStreetMap pour la géocodage
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
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
        showNotification('Erreur lors de la recherche', 'error');
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
                    <textarea id="photo-instructions" placeholder="Prenez une photo de... et envoyez-la via WhatsApp" rows="3" required></textarea>
                </div>
                <div>
                    <label class="field-label">Numéro WhatsApp admin :</label>
                    <input type="tel" id="photo-whatsapp" placeholder="+352 XX XX XX XX" required>
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
                const photoWhatsapp = document.getElementById('photo-whatsapp')?.value.trim();
                
                if (!photoInstructions || !photoWhatsapp) {
                    showNotification('Veuillez remplir les instructions et le numéro WhatsApp', 'error');
                    return;
                }
                
                clueData.text = photoInstructions;
                clueData.whatsapp = photoWhatsapp;
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
        const checkpoints = await firebaseService.getAllCheckpoints();
        const list = document.getElementById('checkpoints-management-list');
        
        if (checkpoints.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666;">Aucun checkpoint créé</p>';
            return;
        }

        list.innerHTML = checkpoints.map(checkpoint => `
            <div class="management-item">
                <h4>${checkpoint.emoji} ${checkpoint.name}</h4>
                <p><strong>Type:</strong> ${checkpoint.type}</p>
                <p><strong>Coordonnées:</strong> ${checkpoint.coordinates[0]}, ${checkpoint.coordinates[1]}</p>
                <p><strong>Contenu:</strong> ${checkpoint.clue?.text || 'Aucun contenu'}</p>
                <div class="item-actions">
                    <button onclick="deleteCheckpoint('${checkpoint.id}')" class="warning-btn">🗑️ Supprimer</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Erreur chargement checkpoints:', error);
    }
}

async function loadRoutes() {
    try {
        const routes = await firebaseService.getAllRoutes();
        const list = document.getElementById('routes-management-list');
        
        if (routes.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666;">Aucun parcours créé</p>';
            return;
        }

        list.innerHTML = routes.map(route => `
            <div class="management-item">
                <h4>🛤️ ${route.name}</h4>
                <p><strong>Ordre:</strong> ${route.route.join(' → ')}</p>
                <div class="item-actions">
                    <button onclick="deleteRoute('${route.id}')" class="warning-btn">🗑️ Supprimer</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Erreur chargement parcours:', error);
    }
}

async function deleteCheckpoint(checkpointId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce checkpoint ?')) return;
    
    try {
        await firebaseService.deleteCheckpoint(checkpointId);
        showNotification('Checkpoint supprimé', 'success');
        loadCheckpoints();
    } catch (error) {
        console.error('❌ Erreur suppression checkpoint:', error);
        showNotification('Erreur lors de la suppression', 'error');
    }
}

async function deleteRoute(routeId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce parcours ?')) return;
    
    try {
        await firebaseService.deleteRoute(routeId);
        showNotification('Parcours supprimé', 'success');
        loadRoutes();
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
