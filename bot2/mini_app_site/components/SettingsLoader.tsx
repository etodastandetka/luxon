"use client"

import { useState, useEffect } from 'react'
import { getApiBase } from '../utils/fetch'

interface BotSettings {
  bot_name: string
  welcome_message: string
  platform_description: string
  supported_bookmakers: string[]
  supported_banks: string[]
  min_deposit: number
  max_deposit: number
  min_withdraw: number
  max_withdraw: number
  referral_percentage: number
  support_contact: string
}

export const useBotSettings = () => {
  const [settings, setSettings] = useState<BotSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const apiUrl = getApiBase()
        console.log('📋 [SettingsLoader] Загрузка настроек с:', `${apiUrl}/api/public/payment-settings`)
        
        const response = await fetch(`${apiUrl}/api/public/payment-settings`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('📋 [SettingsLoader] Настройки загружены:', data)
        
        if (data.success && data.settings) {
          setSettings(data.settings)
        } else if (data && !data.success && !data.error) {
          // Если API возвращает настройки напрямую (без обёртки success)
          setSettings(data)
        } else {
          throw new Error(data.error || 'Failed to load settings')
        }
      } catch (err) {
        console.error('Error loading bot settings:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        
        // Fallback settings
        setSettings({
          bot_name: 'LUXON',
          welcome_message: 'Добро пожаловать!',
          platform_description: 'Платформа для пополнения и вывода средств в казино',
          supported_bookmakers: ['1xBet', 'Melbet', 'Mostbet', '1Win', 'Winwin', '888starz'],
          supported_banks: ['DemirBank', 'O! bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank'],
          min_deposit: 35,
          max_deposit: 100000,
          min_withdraw: 100,
          max_withdraw: 50000,
          referral_percentage: 5,
          support_contact: '@operator_luxon_bot'
        })
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  return { settings, loading, error }
}

export default useBotSettings
