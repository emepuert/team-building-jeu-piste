# 🏛️ Jeu de Piste - Application Web Interactive

Une application web interactive de jeu de piste géolocalisé pour découvrir des lieux lors d'événements de team building ou touristiques.

## 🎯 Fonctionnalités

- **Carte interactive** avec OpenStreetMap (API gratuite)
- **Géolocalisation GPS** en temps réel
- **Interface admin** complète pour gérer les équipes et parcours
- **Détection de proximité** automatique (50m)
- **Interface mobile-first** optimisée
- **Firebase backend** pour la synchronisation temps réel
- **Système d'équipes** avec progression individuelle
- **Types de défis variés** (énigmes, photos, informations)

## 🚀 Installation

### 1. Configuration Firebase

1. Créez un projet Firebase sur [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Activez Firestore Database et Authentication
3. Copiez `firebase-config.template.js` vers `firebase-config.js`
4. Remplacez les valeurs par vos vraies clés Firebase :

```javascript
export const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJECT_ID.firebaseapp.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID",
    measurementId: "VOTRE_MEASUREMENT_ID"
};
```

### 2. Déploiement

- **GitHub Pages** : Activez GitHub Pages dans les paramètres du repository
- **Netlify/Vercel** : Connectez votre repository pour un déploiement automatique
- **Serveur local** : Utilisez `python -m http.server` ou `npx serve`

## 🎮 Utilisation

### Interface Joueur
1. Ouvrez `index.html` dans votre navigateur mobile
2. Connectez-vous avec vos identifiants fournis par l'organisateur
3. Autorisez la géolocalisation
4. Suivez les indices pour découvrir les points d'intérêt

### Interface Admin
1. Accédez à `admin.html`
2. Connectez-vous avec votre compte Firebase
3. Créez des équipes, utilisateurs, checkpoints et parcours
4. Suivez la progression en temps réel
5. Gérez les validations manuelles

## 📱 Compatibilité

- ✅ Smartphones iOS/Android
- ✅ Navigateurs modernes (Chrome, Safari, Firefox)
- ✅ HTTPS requis pour la géolocalisation

## 🛠️ Technologies

- **Frontend** : HTML5, CSS3, JavaScript vanilla
- **Cartographie** : Leaflet.js + OpenStreetMap
- **Backend** : Firebase (Firestore + Authentication)
- **Navigation GPS** : OpenRouteService API
- **Déploiement** : GitHub Pages compatible

## 🧪 Test en Local

Pour tester sans être sur le terrain, utilisez la console du navigateur :

```javascript
// Simuler une position
simulatePosition(49.0928, 6.1907);
```

## ⚠️ Sécurité

- **Ne commitez jamais** le fichier `firebase-config.js` avec de vraies clés
- Utilisez le template `firebase-config.template.js` 
- Configurez les règles de sécurité Firestore appropriées
- HTTPS obligatoire pour la géolocalisation

## 🎉 Fonctionnalités Avancées

- **Synchronisation temps réel** entre joueurs et admin
- **Types de défis multiples** : énigmes, photos, informations
- **Gestion d'équipes** avec couleurs et parcours personnalisés
- **Interface admin mobile-friendly**
- **Notifications en temps réel**
- **Système de reset et gestion des progressions**

---

🚀 **Prêt pour votre prochain événement de team building !**