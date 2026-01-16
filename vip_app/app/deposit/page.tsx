"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DepositPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/deposit/step1')
  }, [router])

  return null
}

