'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function TwoFactorForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    // Получаем userId из query параметров
    const userIdParam = searchParams.get('userId')
    if (userIdParam) {
      setUserId(parseInt(userIdParam))
    } else {
      // Если userId нет, редиректим на логин
      router.push('/login')
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!userId) {
      setError('User ID is required')
      setLoading(false)
      return
    }

    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Важно: включаем отправку cookie
        body: JSON.stringify({ userId, token: code }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Invalid 2FA code')
        setLoading(false)
        return
      }

      // Cookie уже установлен сервером в заголовках ответа
      // Проверяем, что cookie установлен, делая запрос к /api/auth/me
      // Это гарантирует, что cookie доступен перед редиректом
      try {
        const checkResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        })
        const checkData = await checkResponse.json()
        
        if (checkData.success && checkData.data) {
          // Cookie установлен и валиден, можно редиректить
          console.log('✅ Cookie verified, redirecting to dashboard')
          window.location.href = '/dashboard'
        } else {
          // Cookie не установлен, пробуем еще раз через небольшую задержку
          console.warn('⚠️ Cookie not verified, retrying...')
          await new Promise(resolve => setTimeout(resolve, 200))
          window.location.href = '/dashboard'
        }
      } catch (checkErr) {
        // Если проверка не удалась, все равно редиректим
        console.warn('⚠️ Cookie check failed, redirecting anyway:', checkErr)
        await new Promise(resolve => setTimeout(resolve, 200))
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Введите 6-значный код из приложения-аутентификатора
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
              2FA Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              className="appearance-none relative block w-full px-3 py-3 bg-gray-900 border border-gray-700 placeholder-gray-500 text-white text-center text-2xl font-mono rounded-xl focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                // Только цифры, максимум 6
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(value)
              }}
              autoFocus
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-xl text-black bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              Вернуться к логину
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Загрузка...</div>
      </div>
    }>
      <TwoFactorForm />
    </Suspense>
  )
}

