'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getApiBase } from '../utils/fetch'

interface Banner {
  id: number
  image_url?: string
  video_url?: string
  link?: string
  is_active: boolean
  order: number
}

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadBanners = async () => {
      try {
        const apiUrl = getApiBase()
        const response = await fetch(`${apiUrl}/api/public/banners?active=true`)
        const data = await response.json()
        
        if (data.success && data.data) {
          const activeBanners = data.data
            .filter((b: Banner) => b.is_active)
            .sort((a: Banner, b: Banner) => a.order - b.order)
          setBanners(activeBanners)
        }
      } catch (error) {
        console.error('Error loading banners:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBanners()
  }, [])

  // Автоматическая смена баннеров каждые 5 секунд
  useEffect(() => {
    if (banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [banners.length])

  const handleBannerClick = (banner: Banner) => {
    if (banner.link) {
      if (banner.link.startsWith('http://') || banner.link.startsWith('https://')) {
        window.open(banner.link, '_blank', 'noopener,noreferrer')
      } else {
        router.push(banner.link)
      }
    }
  }

  if (loading) {
    return null
  }

  if (banners.length === 0) {
    return null
  }

  const currentBanner = banners[currentIndex]

  return (
    <div className="relative w-full">
      <div 
        className={`relative w-full rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
          currentBanner.link ? 'hover:shadow-lg' : ''
        }`}
        style={{ height: '180px' }}
        onClick={() => handleBannerClick(currentBanner)}
      >
        {currentBanner.video_url ? (
          <video
            src={currentBanner.video_url}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : currentBanner.image_url ? (
          <Image
            src={currentBanner.image_url}
            alt="Banner"
            fill
            className="object-cover"
            priority={currentIndex === 0}
            loading={currentIndex === 0 ? "eager" : "lazy"}
            quality={90}
          />
        ) : null}

        {/* Индикаторы для карусели (если больше 1 баннера) */}
        {banners.length > 1 && (
          <>
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIndex(index)
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-white w-6'
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

