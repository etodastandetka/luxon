"use client"
import { useEffect, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import NotificationSystem from './NotificationSystem'

/**
 * Компонент для фиксированных элементов в хедере (языковой селектор и уведомления)
 * Рендерится через Portal напрямую в document.body для гарантированного фиксированного позиционирования
 */
function FixedHeaderControls() {
  // Временно отключаем фиксированные элементы (языковой селектор и уведомления)
  return null
}

export default memo(FixedHeaderControls)

