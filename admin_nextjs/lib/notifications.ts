// Утилиты для browser push-уведомлений

/**
 * Запрашивает разрешение на уведомления и регистрирует Service Worker
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Браузер не поддерживает уведомления')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

/**
 * Регистрирует Service Worker для push-уведомлений
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Браузер не поддерживает Service Worker')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    })
    
    console.log('✅ Service Worker registered:', registration)
    
    // Ждем активации
    if (registration.installing) {
      console.log('Service Worker installing...')
    } else if (registration.waiting) {
      console.log('Service Worker waiting...')
      // Активируем сразу
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    } else if (registration.active) {
      console.log('Service Worker active')
    }
    
    return registration
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error)
    return null
  }
}

/**
 * Показывает уведомление о пополнении
 */
export async function showDepositNotification(
  amount: number,
  bookmaker: string,
  accountId: string,
  requestId: number
) {
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) {
    console.log('Нет разрешения на уведомления')
    return
  }

  const registration = await registerServiceWorker()
  if (!registration) {
    // Fallback: показываем уведомление напрямую если Service Worker не работает
    if (Notification.permission === 'granted') {
      new Notification('💰 Пополнение выполнено!', {
        body: `${bookmaker} - ${accountId}: ${amount} сом`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `deposit-${requestId}`,
        data: {
          url: `/dashboard/requests/${requestId}`,
          requestId
        }
      })
    }
    return
  }

  // Отправляем сообщение в Service Worker для показа уведомления
  registration.showNotification('💰 Пополнение выполнено!', {
    body: `${bookmaker} - ${accountId}: ${amount} сом`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `deposit-${requestId}`,
    requireInteraction: false,
    data: {
      url: `/dashboard/requests/${requestId}`,
      requestId,
      amount,
      bookmaker,
      accountId
    }
  }).catch(err => {
    console.error('Error showing notification:', err)
    // Fallback: отправляем сообщение в Service Worker
    if (registration.active) {
      registration.active.postMessage({
        type: 'SHOW_DEPOSIT_NOTIFICATION',
        data: { requestId, amount, bookmaker, accountId }
      })
    }
  })
}

/**
 * Показывает уведомление о выводе
 */
export async function showWithdrawNotification(
  amount: number,
  bookmaker: string,
  accountId: string,
  requestId: number
) {
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) {
    console.log('Нет разрешения на уведомления')
    return
  }

  const registration = await registerServiceWorker()
  if (!registration) {
    // Fallback: показываем уведомление напрямую если Service Worker не работает
    if (Notification.permission === 'granted') {
      new Notification('🔴 Новая заявка на вывод!', {
        body: `${bookmaker} - ${accountId}: ${amount} сом`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `withdraw-${requestId}`,
        data: {
          url: `/dashboard/requests/${requestId}`,
          requestId
        }
      })
    }
    return
  }

  // Отправляем сообщение в Service Worker для показа уведомления
  registration.showNotification('🔴 Новая заявка на вывод!', {
    body: `${bookmaker} - ${accountId}: ${amount} сом`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `withdraw-${requestId}`,
    requireInteraction: true, // Для выводов требуем взаимодействия
    data: {
      url: `/dashboard/requests/${requestId}`,
      requestId,
      amount,
      bookmaker,
      accountId
    }
  }).catch(err => {
    console.error('Error showing notification:', err)
    // Fallback: отправляем сообщение в Service Worker
    if (registration.active) {
      registration.active.postMessage({
        type: 'SHOW_WITHDRAW_NOTIFICATION',
        data: { requestId, amount, bookmaker, accountId }
      })
    }
  })
}

/**
 * Инициализирует систему уведомлений
 */
export async function initNotifications(): Promise<boolean> {
  try {
    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) {
      console.log('Пользователь не дал разрешение на уведомления')
      return false
    }

    const registration = await registerServiceWorker()
    return registration !== null
  } catch (error) {
    console.error('Ошибка инициализации уведомлений:', error)
    return false
  }
}
