"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '../../../components/Layout'
import { getBalance, getExchangeRates, Balance, ExchangeRate } from '@/lib/crypto-pay'

export default function CryptoPage() {
  const router = useRouter()
  const [balances, setBalances] = useState<Balance[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [cryptoPayments, setCryptoPayments] = useState<any[]>([])

  const fetchCryptoData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Получаем балансы
      const balancesData = await getBalance()
      setBalances(balancesData)
      
      // Получаем курсы обмена
      const ratesData = await getExchangeRates()
      setExchangeRates(ratesData)
      
      // Получаем список крипто-платежей
      const response = await fetch('/api/crypto-pay/payments')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCryptoPayments(data.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching crypto data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCryptoData()
    // Обновляем данные каждые 30 секунд
    const interval = setInterval(fetchCryptoData, 30000)
    return () => clearInterval(interval)
  }, [fetchCryptoData])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/20 text-green-400 border-green-500'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500'
      case 'expired':
        return 'bg-red-500/20 text-red-400 border-red-500'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Оплачено'
      case 'pending':
        return 'Ожидает оплаты'
      case 'expired':
        return 'Истекло'
      default:
        return status
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Крипто-операции</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            ← Назад
          </button>
        </div>

        {/* Балансы */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white/70">Загрузка...</p>
            </div>
          ) : balances.length > 0 ? (
            balances.map((balance) => (
              <div key={balance.currency_code} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{balance.currency_code}</h3>
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/70">Доступно:</span>
                    <span className="text-white font-bold">{parseFloat(balance.available).toFixed(6)}</span>
                  </div>
                  {parseFloat(balance.onhold) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-white/70">В ожидании:</span>
                      <span className="text-yellow-400">{parseFloat(balance.onhold).toFixed(6)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-white/70">
              Нет доступных балансов
            </div>
          )}
        </div>

        {/* Курсы обмена */}
        {exchangeRates.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Курсы обмена</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {exchangeRates
                .filter(rate => rate.is_valid && rate.is_crypto && rate.target === 'USD')
                .slice(0, 8)
                .map((rate) => (
                  <div key={`${rate.source}-${rate.target}`} className="bg-gray-900 rounded p-3">
                    <div className="text-sm text-white/70">{rate.source}</div>
                    <div className="text-lg font-bold text-white">${parseFloat(rate.rate).toFixed(2)}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Крипто-платежи */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">История платежей</h2>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white/70">Загрузка...</p>
            </div>
          ) : cryptoPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-white/70">Invoice ID</th>
                    <th className="text-left py-3 px-4 text-white/70">Сумма</th>
                    <th className="text-left py-3 px-4 text-white/70">Актив</th>
                    <th className="text-left py-3 px-4 text-white/70">Статус</th>
                    <th className="text-left py-3 px-4 text-white/70">Заявка</th>
                    <th className="text-left py-3 px-4 text-white/70">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {cryptoPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                      <td className="py-3 px-4 text-white font-mono text-sm">{payment.invoice_id}</td>
                      <td className="py-3 px-4 text-white">{parseFloat(payment.amount).toFixed(6)}</td>
                      <td className="py-3 px-4 text-white">{payment.asset}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(payment.status)}`}>
                          {getStatusText(payment.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {payment.request_id ? (
                          <button
                            onClick={() => router.push(`/dashboard/requests/${payment.request_id}`)}
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            #{payment.request_id}
                          </button>
                        ) : (
                          <span className="text-white/50">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-white/70 text-sm">
                        {payment.paid_at ? formatDate(payment.paid_at) : formatDate(payment.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-white/70">
              Платежей пока нет
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

