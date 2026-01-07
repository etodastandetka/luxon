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
      className="loading-screen" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #0f1b0f 0%, #1a2e1a 50%, #0f1b0f 100%)',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Контент */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Логотип LUX ON */}
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            color: '#ffffff',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
            letterSpacing: '0.05em',
            margin: 0
          }}>
            {message}
          </h1>
          
          {/* Прогресс бар */}
          {showProgress && (
            <div style={{
              width: '256px',
              margin: '0 auto'
            }}>
              <div style={{
                position: 'relative',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(8px)',
                borderRadius: '9999px',
                height: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div 
                  style={{
                    background: 'linear-gradient(to right, #4ade80, #22c55e)',
                    height: '100%',
                    transition: 'width 300ms ease-out',
                    width: `${progress}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
