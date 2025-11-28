"use client"
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from './LanguageContext'

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
  videoSrc: string
  title?: string
}

export default function VideoModal({ isOpen, onClose, videoSrc, title }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoError, setVideoError] = useState(false)
  const { language } = useLanguage()

  const translations = {
    ru: {
      close: 'Закрыть',
      howToDeposit: 'Как пополнить',
      howToWithdraw: 'Как вывести'
    },
    en: {
      close: 'Close',
      howToDeposit: 'How to deposit',
      howToWithdraw: 'How to withdraw'
    },
    ky: {
      close: 'Жабуу',
      howToDeposit: 'Капкалды кантип кошуу керек',
      howToWithdraw: 'Кантип чыгаруу керек'
    },
    uz: {
      close: 'Yopish',
      howToDeposit: 'Qanday to\'ldirish kerak',
      howToWithdraw: 'Qanday yechib olish kerak'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  useEffect(() => {
    if (isOpen && videoRef.current && !videoError) {
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err)
      })
    } else if (!isOpen && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
      setVideoError(false) // Сбрасываем ошибку при закрытии
    }
  }, [isOpen, videoError])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full max-w-4xl max-h-[90vh] m-4 flex flex-col bg-gray-900 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {title || t.howToDeposit}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label={t.close}
          >
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>

        {/* Видео плеер */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black">
          {videoSrc.includes('streamable.com') ? (
            (() => {
              // Извлекаем ID видео из ссылки Streamable
              // Поддерживаем: /e/VIDEO_ID, streamable.com/e/VIDEO_ID
              const match = videoSrc.match(/\/e\/([a-zA-Z0-9_-]+)/)
              const videoId = match ? match[1] : null
              
              if (!videoId) {
                return (
                  <div className="text-white text-center">
                    Неверная ссылка на Streamable
                  </div>
                )
              }
              
              // Определяем параметры в зависимости от типа видео
              // Для вывода используем muted, для пополнения - без muted
              const isWithdraw = title?.toLowerCase().includes('вывести') || title?.toLowerCase().includes('withdraw')
              const streamableUrl = isWithdraw 
                ? `https://streamable.com/e/${videoId}?autoplay=1&muted=1`
                : `https://streamable.com/e/${videoId}?autoplay=1`
              
              return (
                <div className="relative w-full h-full max-h-[calc(90vh-120px)]" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={streamableUrl}
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    allow="fullscreen;autoplay"
                    allowFullScreen
                    style={{ border: 'none' }}
                    title={title || t.howToDeposit}
                  />
                </div>
              )
            })()
          ) : videoSrc.includes('drive.google.com') || videoSrc.includes('docs.google.com') ? (
            (() => {
              // Извлекаем ID файла из разных форматов ссылок Google Drive
              // Поддерживаем: /d/FILE_ID, /videos/d/FILE_ID, /file/d/FILE_ID
              let match = videoSrc.match(/\/d\/([a-zA-Z0-9_-]+)/)
              if (!match) {
                match = videoSrc.match(/\/videos\/d\/([a-zA-Z0-9_-]+)/)
              }
              const fileId = match ? match[1] : null
              
              if (!fileId) {
                return (
                  <div className="text-white text-center">
                    Неверная ссылка на Google Drive
                  </div>
                )
              }
              
              // Используем наш прокси для получения прямого потока видео
              // Это обходит проблему с авторизацией
              const proxyVideoUrl = `/api/video-proxy?id=${fileId}`
              
              return (
                <video
                  ref={videoRef}
                  src={proxyVideoUrl}
                  controls
                  className="w-full h-full max-h-[calc(90vh-120px)] object-contain rounded-lg"
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  onError={() => {
                    console.error('Video load error, trying iframe fallback')
                    setVideoError(true)
                  }}
                >
                  Ваш браузер не поддерживает воспроизведение видео.
                </video>
              )
            })()
          ) : (
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              className="w-full h-full max-h-[calc(90vh-120px)] object-contain rounded-lg"
              playsInline
              preload="metadata"
            >
              Ваш браузер не поддерживает воспроизведение видео.
            </video>
          )}
        </div>

        {/* Кнопка закрытия внизу */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full btn btn-primary py-3"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}

