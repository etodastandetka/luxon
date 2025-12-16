"use client"
import { useState, useEffect } from 'react'

interface LoadingScreenProps {
  message?: string
  showProgress?: boolean
  progress?: number
}

export default function LoadingScreen({ 
  message = 'LUX ON', 
  showProgress = false, 
  progress = 0
}: LoadingScreenProps) {
  useEffect(() => {
    // Добавляем класс на body чтобы скрыть меню и гирлянды
    const addLoadingClass = () => {
      document.body.classList.add('loading-active')
    }
    
    // Скрываем элементы напрямую
    const hideElements = () => {
      const nav = document.querySelector('.bottom-navigation') as HTMLElement
      const garlands = document.querySelector('.new-year-garlands') as HTMLElement
      
      if (nav) {
        nav.style.setProperty('display', 'none', 'important')
        nav.style.setProperty('visibility', 'hidden', 'important')
        nav.style.setProperty('opacity', '0', 'important')
        nav.style.setProperty('z-index', '-1', 'important')
      }
      if (garlands) {
        garlands.style.setProperty('display', 'none', 'important')
        garlands.style.setProperty('visibility', 'hidden', 'important')
        garlands.style.setProperty('opacity', '0', 'important')
        garlands.style.setProperty('z-index', '-1', 'important')
      }
    }
    
    // Выполняем сразу
    addLoadingClass()
    hideElements()
    
    // Повторяем через небольшие интервалы для надежности
    const interval1 = setTimeout(hideElements, 10)
    const interval2 = setTimeout(hideElements, 50)
    const interval3 = setTimeout(hideElements, 100)
    
    // Также используем MutationObserver для отслеживания появления элементов
    const observer = new MutationObserver(() => {
      hideElements()
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
    
    return () => {
      // Убираем класс когда компонент размонтируется
      document.body.classList.remove('loading-active')
      
      // Показываем элементы обратно
      const nav = document.querySelector('.bottom-navigation') as HTMLElement
      const garlands = document.querySelector('.new-year-garlands') as HTMLElement
      
      if (nav) {
        nav.style.removeProperty('display')
        nav.style.removeProperty('visibility')
        nav.style.removeProperty('opacity')
        nav.style.removeProperty('z-index')
      }
      if (garlands) {
        garlands.style.removeProperty('display')
        garlands.style.removeProperty('visibility')
        garlands.style.removeProperty('opacity')
        garlands.style.removeProperty('z-index')
      }
      
      clearTimeout(interval1)
      clearTimeout(interval2)
      clearTimeout(interval3)
      observer.disconnect()
    }
  }, [])

  return (
    <div 
      className="fixed inset-0 z-[99999] loading-screen" 
      style={{
        background: 'linear-gradient(135deg, #0f1b0f 0%, #1a2e1a 50%, #0f1b0f 100%)',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Контент */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-6">
          {/* Логотип LUX ON */}
          <h1 className="text-5xl font-bold text-white drop-shadow-lg tracking-wider">
            {message}
          </h1>
          
          {/* Прогресс бар */}
          {showProgress && (
            <div className="w-64 mx-auto">
              <div className="relative bg-black/40 backdrop-blur rounded-full h-2 overflow-hidden border border-white/20">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
