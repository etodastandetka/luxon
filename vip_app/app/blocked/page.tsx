"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FixedHeaderControls from '../../components/FixedHeaderControls'
import { getApiBase } from '../../utils/fetch'

export default function BlockedPage() {
  const router = useRouter()

  useEffect(() => {
    // Получаем ID пользователя из Telegram WebApp
    const tg = (window as any).Telegram?.WebApp
    let userId: string | null = null
    
    if (tg?.initDataUnsafe?.user?.id) {
      userId = String(tg.initDataUnsafe.user.id)
    } else if (tg?.initData) {
      try {
        const params = new URLSearchParams(tg.initData)
        const userParam = params.get('user')
        if (userParam) {
          const user = JSON.parse(decodeURIComponent(userParam))
          userId = String(user.id)
        }
      } catch (e) {
        console.error('Error parsing initData:', e)
      }
    }

    // Периодически проверяем, не разблокировали ли пользователя
    if (userId) {
      const checkInterval = setInterval(async () => {
        try {
          const apiUrl = getApiBase()
          const response = await fetch(`${apiUrl}/api/public/check-user-status?user_id=${userId}`)
          const data = await response.json()
          
          if (data.success && data.data.isActive) {
            // Пользователь разблокирован, перенаправляем на главную
            clearInterval(checkInterval)
            router.push('/')
          }
        } catch (error) {
          console.error('Error checking user status:', error)
        }
      }, 5000) // Проверяем каждые 5 секунд

      return () => clearInterval(checkInterval)
    }
  }, [router])

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-4 relative">
      <FixedHeaderControls />
      <div className="bg-gray-800/90 rounded-2xl p-6 max-w-md w-full border border-gray-700 text-center flex flex-col items-center justify-center">
        <div className="mb-4">
          <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Вы заблокированы</h1>
        <p className="text-gray-300 mb-4 text-sm leading-relaxed">
          Ваш аккаунт был заблокирован администратором.
        </p>
        <p className="text-gray-400 text-xs leading-relaxed">
          Обратитесь в поддержку для получения дополнительной информации.
        </p>
      </div>
    </div>
  )
}



