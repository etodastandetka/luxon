"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WithdrawPage() {
  const router = useRouter()

  useEffect(() => {
    // Перенаправляем на первую страницу вывода
    router.push('/withdraw/step1')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
        <p className="mt-2 text-white/70">Перенаправление...</p>
      </div>
    </div>
  )
}
