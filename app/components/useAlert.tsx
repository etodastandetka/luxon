'use client'

import { useState } from 'react'
import CustomAlert from './CustomAlert'

interface AlertConfig {
  title?: string
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  autoClose?: number
}

export function useAlert() {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null)

  const showAlert = (config: AlertConfig | string) => {
    if (typeof config === 'string') {
      setAlertConfig({ message: config, type: 'info' })
    } else {
      setAlertConfig(config)
    }
  }

  const closeAlert = () => {
    setAlertConfig(null)
  }

  const AlertComponent = alertConfig ? (
    <CustomAlert
      show={true}
      title={alertConfig.title}
      message={alertConfig.message}
      type={alertConfig.type}
      onClose={closeAlert}
      autoClose={alertConfig.autoClose}
    />
  ) : null

  return {
    showAlert,
    closeAlert,
    AlertComponent
  }
}

