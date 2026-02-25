// Service Worker para Push Notifications - Laços 3.0

self.addEventListener('push', (event) => {
  let data = { title: 'Laços', body: 'Nova notificação', icon: '/icon-192x192.png' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Erro ao parsear push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/dashboard'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já tem uma aba aberta, foca nela
      for (const client of windowClients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre uma nova
      return clients.openWindow(url);
    })
  );
});
