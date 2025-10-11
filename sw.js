// Service Worker pour mode offline
const CACHE_NAME = 'team-building-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

// Fichiers à mettre en cache immédiatement
const STATIC_FILES = [
    './',
    './index.html',
    './admin.html',
    './script.js',
    './admin-script.js',
    './style.css',
    './admin-style.css',
    './firebase-service.js'
];

// URLs à ne jamais mettre en cache
const NEVER_CACHE = [
    'firebase-config.js', // Config sensible
    'api.openrouteservice.org', // API externe
    'https://www.gstatic.com/firebasejs/', // Firebase SDK
    'chrome-extension://' // Extensions navigateur
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installation');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('📦 Mise en cache des fichiers statiques');
                return cache.addAll(STATIC_FILES.filter(url => 
                    !NEVER_CACHE.some(never => url.includes(never))
                ));
            })
            .catch(error => {
                console.error('❌ Erreur cache statique:', error);
            })
    );
    
    // Forcer l'activation immédiate
    self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker: Activation');
    
    event.waitUntil(
        // Nettoyer les anciens caches
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('🗑️ Suppression ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Prendre le contrôle immédiatement
    self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    
    // Ignorer les requêtes à ne pas mettre en cache
    if (NEVER_CACHE.some(never => url.includes(never))) {
        return; // Laisser passer sans intervention
    }
    
    // Ignorer les requêtes POST/PUT/DELETE
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        // Stratégie: Cache First pour les fichiers statiques
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    console.log('📦 Depuis cache:', url);
                    return cachedResponse;
                }
                
                // Pas en cache, aller chercher sur le réseau
                return fetch(event.request)
                    .then(networkResponse => {
                        // Vérifier si la réponse est valide
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Cloner la réponse pour la mettre en cache
                        const responseToCache = networkResponse.clone();
                        
                        // Mettre en cache dynamiquement
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                console.log('💾 Mise en cache:', url);
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('❌ Erreur réseau:', url, error);
                        
                        // Fallback pour les pages HTML
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        
                        // Fallback générique
                        return new Response('Contenu non disponible hors ligne', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Gestion des messages depuis l'app principale
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_CACHE_STATUS') {
        caches.keys().then(cacheNames => {
            event.ports[0].postMessage({
                caches: cacheNames,
                isOnline: navigator.onLine
            });
        });
    }
});

// Synchronisation en arrière-plan (pour plus tard)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('🔄 Synchronisation en arrière-plan');
        // TODO: Synchroniser les données avec Firebase
    }
});

console.log('🚀 Service Worker chargé et prêt !');
