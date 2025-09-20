# 🏛️ Jeu de Piste Turin - Séminaire

Une application web interactive de jeu de piste géolocalisé pour découvrir Turin lors de votre séminaire.

## 🎯 Fonctionnalités

- **Carte interactive** avec OpenStreetMap (API gratuite)
- **Géolocalisation GPS** en temps réel
- **5 points d'intérêt** emblématiques de Turin
- **Détection de proximité** automatique (50m)
- **Interface mobile-first** optimisée
- **Pop-ups d'indices** avec informations historiques
- **Suivi de progression** en temps réel

## 📍 Points d'Intérêt

1. **🏛️ Mole Antonelliana** - Le symbole de Turin
2. **👑 Palazzo Reale** - L'ancienne résidence royale
3. **🏰 Piazza Castello** - Le cœur de la ville
4. **🏺 Museo Egizio** - Les trésors de l'Égypte antique
5. **🛒 Porta Palazzo** - Le plus grand marché d'Europe

## 🚀 Utilisation

1. Ouvrez `index.html` dans votre navigateur mobile
2. Autorisez la géolocalisation
3. Suivez les indices pour découvrir Turin
4. Approchez-vous des points d'intérêt (moins de 50m)
5. Découvrez les indices historiques !

## 🛠️ Technologies

- **HTML5** avec géolocalisation
- **CSS3** avec design responsive
- **JavaScript** vanilla (pas de framework)
- **Leaflet.js** pour la cartographie
- **OpenStreetMap** pour les tuiles de carte

## 📱 Compatibilité

- ✅ Smartphones iOS/Android
- ✅ Navigateurs modernes (Chrome, Safari, Firefox)
- ✅ HTTPS requis pour la géolocalisation

## 🌐 Déploiement GitHub Pages

1. Créez un repository GitHub
2. Uploadez tous les fichiers
3. Activez GitHub Pages dans les paramètres
4. Votre jeu sera accessible à `https://username.github.io/repository-name`

## 🧪 Test en Local

Pour tester sans être à Turin, utilisez la console du navigateur :

```javascript
// Simuler une position près de la Mole Antonelliana
simulatePosition(45.0692, 7.6934);
```

## 📝 Personnalisation

Modifiez le fichier `script.js` pour :
- Changer les coordonnées des points d'intérêt
- Ajuster la distance de détection (`proximityThreshold`)
- Personnaliser les indices et descriptions
- Ajouter de nouveaux checkpoints

## ⚠️ Notes Importantes

- **HTTPS obligatoire** pour la géolocalisation
- Testez sur mobile pour une expérience optimale
- La précision GPS peut varier selon l'environnement
- Prévoyez une connexion internet pour charger la carte

## 🎉 Bon séminaire à Turin !

Profitez de cette découverte interactive de la magnifique capitale piémontaise !
