// ====================== SERVICE WORKER — NOVA FOLGA TRABALHADA ======================
// Versão com FCM Push Notifications + cache PWA offline-first

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// ── Firebase config (deve ser idêntica ao index.html) ──────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyA6OzNUzlHVJaG3CsnQ3m-cfcuOkf6Ve-Q",
  authDomain:        "nova-folga-trabalhada.firebaseapp.com",
  projectId:         "nova-folga-trabalhada",
  storageBucket:     "nova-folga-trabalhada.firebasestorage.app",
  messagingSenderId: "187145497152",
  appId:             "1:187145497152:web:8f943193dffdadd2340da5"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ── Nome do cache ───────────────────────────────────────────────────────────
const CACHE_NAME = 'ft-app-v3-push';

// ── Instalação ──────────────────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  console.log('[SW] Instalado — versão: ' + CACHE_NAME);
  self.skipWaiting();
});

// ── Ativação ────────────────────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  console.log('[SW] Ativado');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ── Push via FCM (background) ───────────────────────────────────────────────
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Push recebido em background:', payload);

  var notification = payload.notification || {};
  var data         = payload.data         || {};

  var title   = notification.title || data.title || '⚠️ FT Alert';
  var body    = notification.body  || data.body  || 'Você tem pendências de Folga Trabalhada!';

  var options = {
    body:     body,
    icon:     '/icon-192.png',
    badge:    '/icon-72.png',
    vibrate:  [200, 100, 200, 100, 200],
    tag:      'ft-pendencia',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open',    title: '🟢 Abrir App' },
      { action: 'dismiss', title: 'Fechar'        }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Push direto (não FCM) — fallback ────────────────────────────────────────
self.addEventListener('push', function(event) {
  var data = { title: '⚠️ Nova Folga Trabalhada', body: 'Você tem pendências!' };
  try {
    if (event.data) data = event.data.json();
  } catch(e) {}

  var options = {
    body:     data.body    || 'Clique para abrir o app',
    icon:     '/icon-192.png',
    badge:    '/icon-72.png',
    vibrate:  [200, 100, 200, 100, 200],
    tag:      'ft-pendencia',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open',    title: '🟢 Abrir App' },
      { action: 'dismiss', title: 'Fechar'        }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '⚠️ FT Alert', options)
  );
});

// ── Clique na notificação ───────────────────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  var url = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se já tem aba aberta, foca nela
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url.indexOf(url) !== -1 && 'focus' in c) {
          return c.focus();
        }
      }
      // Senão, abre nova aba
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Cache offline-first ─────────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  // Ignora requisições não-GET e requests cross-origin do Firebase/CDN
  if (event.request.method !== 'GET') return;
  var url = event.request.url;
  if (url.indexOf('firestore.googleapis.com') !== -1) return;
  if (url.indexOf('gstatic.com') !== -1) return;
  if (url.indexOf('googleapis.com') !== -1) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        // Armazena no cache apenas respostas válidas de mesma origem
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});

console.log('[SW] Service Worker FT com Push Notifications carregado — ' + CACHE_NAME);
