'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GeolocationPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'requesting' | 'checking' | 'denied' | 'error'>('requesting')
  const [message, setMessage] = useState('Запрос разрешения на геолокацию...')

  useEffect(() => {
    requestGeolocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setStatus('error')
      setMessage('Геолокация не поддерживается вашим браузером')
      return
    }

    setStatus('requesting')
    setMessage('Запрос разрешения на геолокацию...')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setStatus('checking')
        setMessage('Проверка местоположения...')

        try {
          // Отправляем координаты на сервер для проверки
          const response = await fetch('/api/geolocation/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ latitude, longitude }),
          })

          const data = await response.json()

          if (data.success) {
            // Cookie уже установлен в verify endpoint
            // Редирект на исходную страницу или на логин
            const returnUrl = new URLSearchParams(window.location.search).get('return') || '/login'
            router.push(returnUrl)
            router.refresh()
          } else {
            setStatus('denied')
            // Показываем детальное сообщение с расстоянием
            const distance = data.data?.distance ? ` (${parseFloat(data.data.distance).toFixed(0)}м от зоны)` : ''
            const requiredRadius = data.data?.requiredRadius ? ` (требуется быть в пределах ${data.data.requiredRadius}м)` : ''
            setMessage(data.message || `Сайт недоступен в вашем регионе${distance}${requiredRadius}`)
          }
        } catch (error) {
          setStatus('error')
          setMessage('Ошибка при проверке местоположения')
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus('denied')
          setMessage('Доступ к геолокации запрещен. Сайт недоступен в вашем регионе.')
        } else {
          setStatus('error')
          setMessage('Ошибка при получении геолокации: ' + error.message)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            {status === 'requesting' && (
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mx-auto"></div>
            )}
            {status === 'checking' && (
              <div className="animate-pulse">
                <svg
                  className="w-16 h-16 mx-auto text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            )}
            {(status === 'denied' || status === 'error') && (
              <div className="text-red-500 text-6xl mb-4">🚫</div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white mb-4">
            {status === 'requesting' && 'Проверка местоположения'}
            {status === 'checking' && 'Проверка местоположения'}
            {status === 'denied' && 'Доступ запрещен'}
            {status === 'error' && 'Ошибка'}
          </h1>

          <p className="text-gray-300 mb-6">{message}</p>

          {status === 'denied' && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-300 text-sm">
                Сайт недоступен в вашем регионе. Для доступа необходимо находиться в разрешенной зоне.
              </p>
            </div>
          )}

          {status === 'error' && (
            <button
              onClick={requestGeolocation}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Попробовать снова
            </button>
          )}

          {status === 'denied' && (
            <button
              onClick={requestGeolocation}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors mb-2"
            >
              Проверить снова
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

