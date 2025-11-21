// Service Worker для push-уведомлений о пополнениях
// Работает даже когда сайт закрыт

const CACHE_NAME = 'luxon-admin-v1'
const NOTIFICATION_TITLE = 'LUX ON Admin'

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  self.skipWaiting()
})

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(self.clients.claim())
})

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event)
  
  let notificationData = {
    title: NOTIFICATION_TITLE,
    body: 'Новое уведомление!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'notification',
    requireInteraction: false,
    silent: false
  }
  
  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = {
        ...notificationData,
        title: data.title || NOTIFICATION_TITLE,
        body: data.body || notificationData.body,
        data: data.data || {},
        tag: data.tag || 'notification',
        requireInteraction: data.requireInteraction || false
      }
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e)
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  )
})

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event)
  event.notification.close()
  
  const urlToOpen = event.notification.data?.url || '/dashboard'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Если есть открытое окно - фокусируемся на нем
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // Иначе открываем новое окно
      if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
    })
  )
})

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  // Обработка уведомлений о пополнениях и выводах от клиента
  if (event.data && event.data.type === 'SHOW_DEPOSIT_NOTIFICATION') {
    const { requestId, amount, bookmaker, accountId } = event.data.data || {}
    self.registration.showNotification('💰 Пополнение выполнено!', {
      body: `${bookmaker} - ${accountId}: ${amount} сом`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `deposit-${requestId}`,
      requireInteraction: false,
      data: {
        url: `/dashboard/requests/${requestId}`,
        requestId
      }
    })
  }
  
  if (event.data && event.data.type === 'SHOW_WITHDRAW_NOTIFICATION') {
    const { requestId, amount, bookmaker, accountId } = event.data.data || {}
    self.registration.showNotification('🔴 Новая заявка на вывод!', {
      body: `${bookmaker} - ${accountId}: ${amount} сом`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `withdraw-${requestId}`,
      requireInteraction: true,
      data: {
        url: `/dashboard/requests/${requestId}`,
        requestId
      }
    })
  }
})

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(self.clients.claim())
})

