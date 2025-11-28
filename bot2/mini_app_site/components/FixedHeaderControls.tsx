"use client"
import { useEffect, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import NotificationSystem from './NotificationSystem'

/**
 * Компонент для фиксированных элементов в хедере (языковой селектор и уведомления)
 * Рендерится через Portal напрямую в document.body для гарантированного фиксированного позиционирования
 */
function FixedHeaderControls() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // Рендерим через Portal напрямую в body, чтобы избежать проблем с позиционированием
  return createPortal(
    <NotificationSystem />,
    document.body
  )
}

export default memo(FixedHeaderControls)

