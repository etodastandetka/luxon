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
          {videoSrc.includes('drive.google.com') ? (
            (() => {
              // Извлекаем ID файла из ссылки Google Drive
              const match = videoSrc.match(/\/d\/([a-zA-Z0-9_-]+)/)
              const fileId = match ? match[1] : null
              
              // Если была ошибка загрузки, используем iframe как fallback
              if (videoError && fileId) {
                const iframeUrl = `https://drive.google.com/file/d/${fileId}/preview`
                return (
                  <iframe
                    src={iframeUrl}
                    className="w-full h-full max-h-[calc(90vh-120px)] rounded-lg"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    style={{ border: 'none' }}
                  />
                )
              }
              
              // Используем прямую ссылку для скачивания видео файла
              // Формат uc?export=download с confirm=t обходит страницу подтверждения
              const directVideoUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t` : videoSrc
              
              return (
                <video
                  ref={videoRef}
                  src={directVideoUrl}
                  controls
                  className="w-full h-full max-h-[calc(90vh-120px)] object-contain rounded-lg"
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  onError={() => {
                    console.error('Video load error, falling back to iframe')
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

