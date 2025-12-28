'use client'

import { useEffect } from 'react'

export default function VersionChecker() {
  useEffect(() => {
    // Получаем версию из meta-тега или env
    const getCurrentVersion = () => {
      const metaVersion = document.querySelector('meta[name="app-version"]')?.getAttribute('content')
      return metaVersion || process.env.NEXT_PUBLIC_APP_VERSION || Date.now().toString()
    }
    
    const currentVersion = getCurrentVersion()
    
    // Сохраняем версию в sessionStorage при первой загрузке
    const storedVersion = sessionStorage.getItem('app_version')
    if (!storedVersion) {
      sessionStorage.setItem('app_version', currentVersion)
      return
    }

    // Функция проверки обновлений
    const checkForUpdates = async () => {
      try {
        // Загружаем главную страницу с no-cache для получения актуальной версии
        const response = await fetch(window.location.origin + '/', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest'
          }
        })
        
        // Парсим HTML для получения версии из meta-тега
        const html = await response.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const serverVersionMeta = doc.querySelector('meta[name="app-version"]')
        const serverVersion = serverVersionMeta?.getAttribute('content') || 
                            response.headers.get('x-version') || 
                            response.headers.get('etag') ||
                            currentVersion
        
        // Если версия изменилась - перезагружаем страницу
        if (serverVersion && serverVersion !== storedVersion && serverVersion !== currentVersion) {
          console.log('🔄 Обнаружена новая версия приложения, перезагружаем...', {
            stored: storedVersion,
            server: serverVersion,
            current: currentVersion
          })
          
          // Очищаем кеш
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys()
              await Promise.all(cacheNames.map(name => caches.delete(name)))
            } catch (e) {
              console.warn('Не удалось очистить кеш:', e)
            }
          }
          
          // Очищаем sessionStorage и localStorage
          sessionStorage.clear()
          localStorage.removeItem('app_version')
          
          // Перезагружаем страницу с очисткой кеша
          window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now()
        }
      } catch (error) {
        // Тихая ошибка, не мешаем работе приложения
        console.debug('Проверка обновлений:', error)
      }
    }

    // Проверяем обновления только при фокусе окна (реже, чтобы не мешать работе)
    const handleFocus = () => {
      // Задержка 2 секунды после фокуса, чтобы не мешать пользователю
      setTimeout(checkForUpdates, 2000)
    }
    window.addEventListener('focus', handleFocus)

    // Проверяем обновления реже - каждые 5 минут, а не 30 секунд
    const interval = setInterval(checkForUpdates, 300000) // Каждые 5 минут

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null // Компонент не рендерит ничего
}

