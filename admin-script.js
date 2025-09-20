// Script Admin - Jeu de Piste
console.log('🔧 Admin Script chargé');

// Variables globales
let firebaseService = null;
let firebaseAuth = null;
let isAuthenticated = false;
let currentUser = null;
let teamsData = [];
let validationsData = [];

// Configuration admin - Emails autorisés
const ADMIN_CONFIG = {
    authorizedEmails: [
        'votre.email@gmail.com', // ← Remplacez par votre email !
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
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('refresh-data').addEventListener('click', refreshData);
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
    
    // Écouter les validations en attente
    firebaseService.onValidationRequests((validations) => {
        console.log('⏳ Validations en attente:', validations);
        validationsData = validations;
        updateValidationsDisplay();
        updateStats();
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
                <small>${team.foundCheckpoints.length} / ${team.route.length} points trouvés</small>
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
    return Math.round((team.foundCheckpoints.length / team.route.length) * 100);
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
window.approveValidation = approveValidation;
window.rejectValidation = rejectValidation;
window.showTeamDetails = showTeamDetails;

console.log('✅ Admin Script initialisé');
