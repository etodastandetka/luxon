"use client"
import { useEffect } from 'react'
import { useLanguage } from './LanguageContext'

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
  videoSrc: string
  title?: string
}

export default function VideoModal({ isOpen, onClose, videoSrc, title }: VideoModalProps) {
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
          {(() => {
            let iframeUrl = videoSrc

            // Helper: извлекаем YouTube id из любых форматов, включая shorts с query
            const extractYouTubeId = (url: string) => {
              // embed
              if (url.includes('youtube.com/embed/')) {
                const match = url.match(/embed\/([a-zA-Z0-9_-]+)/)
                return match ? match[1] : null
              }
              // watch?v=
              const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/)
              if (watchMatch) return watchMatch[1]
              // shorts
              const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/)
              if (shortsMatch) return shortsMatch[1]
              // youtu.be
              const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
              if (shortMatch) return shortMatch[1]
              return null
            }

            // Обработка Streamable
            if (videoSrc.includes('streamable.com')) {
              const match = videoSrc.match(/\/e\/([a-zA-Z0-9_-]+)/)
              const videoId = match ? match[1] : null
              if (videoId) {
                const isWithdraw = title?.toLowerCase().includes('вывести') || title?.toLowerCase().includes('withdraw')
                iframeUrl = isWithdraw 
                  ? `https://streamable.com/e/${videoId}?autoplay=1&muted=1`
                  : `https://streamable.com/e/${videoId}?autoplay=1`
              }
            }
            // Обработка YouTube (включая shorts и youtu.be) с использованием nocookie для обхода cookie prompt
            else if (videoSrc.includes('youtube.com') || videoSrc.includes('youtu.be')) {
              const videoId = extractYouTubeId(videoSrc)
              if (videoId) {
                iframeUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`
              }
            }
            // Обработка Google Drive
            else if (videoSrc.includes('drive.google.com') || videoSrc.includes('docs.google.com')) {
              let match = videoSrc.match(/\/d\/([a-zA-Z0-9_-]+)/)
              if (!match) {
                match = videoSrc.match(/\/videos\/d\/([a-zA-Z0-9_-]+)/)
              }
              const fileId = match ? match[1] : null
              if (fileId) {
                iframeUrl = `https://drive.google.com/file/d/${fileId}/preview`
              }
            }
            
            return (
              <div className="relative w-full h-full max-h-[calc(90vh-120px)]" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={iframeUrl}
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  allow="fullscreen;autoplay;encrypted-media"
                  allowFullScreen
                  style={{ border: 'none' }}
                  title={title || t.howToDeposit}
                />
              </div>
            )
          })()}
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

