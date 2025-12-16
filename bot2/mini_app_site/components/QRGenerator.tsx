    "use client"
import { useEffect, useState } from 'react'

interface QRGeneratorProps {
  bankKey: string
  amount: number
  playerId: string
  onGenerated: (url: string) => void
  paymentUrl?: string
}

interface QRResponse {
  success: boolean
  qr_hash: string
  primary_url: string
  all_bank_urls: Record<string, string>
  amount: number
  bank: string
}

export default function QRGenerator({ bankKey, amount, playerId, onGenerated, paymentUrl }: QRGeneratorProps) {
  const [qrCode, setQrCode] = useState<string>('')
  const [qrData, setQrData] = useState<QRResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const generateQR = async () => {
      if (paymentUrl) {
        // Если есть готовая ссылка, используем её
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUrl)}&bgcolor=transparent&color=000000&margin=0&format=png`
        setQrCode(qrUrl)
        return
      }

      if (!amount || !bankKey) return

      setLoading(true)
      setError('')

      try {
        const response = await fetch('/api/generate-qr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amount,
            bank: bankKey.toUpperCase(),
            playerId: playerId
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: QRResponse = await response.json()
        setQrData(data)
        
        // Генерируем QR код для основной ссылки
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.primary_url)}&bgcolor=transparent&color=000000&margin=0&format=png`
        setQrCode(qrUrl)
        
        // Уведомляем родительский компонент
        onGenerated(data.primary_url)
      } catch (err) {
        console.error('Error generating QR:', err)
        setError(err instanceof Error ? err.message : 'Ошибка генерации QR кода')
      } finally {
        setLoading(false)
      }
    }

    generateQR()
  }, [amount, bankKey, playerId, paymentUrl, onGenerated])

  if (loading) {
    return (
      <div className="w-48 h-48 bg-black/30 backdrop-blur rounded-lg flex items-center justify-center border border-white/10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
          <span className="text-white/70 text-sm">Генерация QR...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-48 h-48 bg-red-900/20 backdrop-blur rounded-lg flex items-center justify-center border border-red-500/30">
        <div className="text-center p-4">
          <span className="text-red-400 text-sm">Ошибка: {error}</span>
        </div>
      </div>
    )
  }

  if (!qrCode) {
    return (
      <div className="w-48 h-48 bg-black/30 backdrop-blur rounded-lg flex items-center justify-center border border-white/10">
        <span className="text-white/70">Загрузка QR...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <img 
        src={qrCode} 
        alt="QR код для оплаты" 
        className="w-48 h-48 mx-auto"
      />
      {qrData && (
        <div className="text-center">
          <p className="text-white/70 text-sm mb-2">
            Сумма: {qrData.amount} сом
          </p>
          <p className="text-white/70 text-sm">
            Банк: {qrData.bank}
          </p>
        </div>
      )}
    </div>
  )
}

