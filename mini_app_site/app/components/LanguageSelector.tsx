"use client"
import { useState, useEffect } from 'react'
import { useLanguage } from './LanguageContext'

const languages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ky', name: 'Кыргызча', flag: '🇰🇬' },
  { code: 'uz', name: 'O\'zbekcha', flag: '🇺🇿' }
]

interface LanguageSelectorProps {
  onOpenChange?: (isOpen: boolean) => void
}

export default function LanguageSelector({ onOpenChange }: LanguageSelectorProps) {
  const { language: currentLanguage, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  // Закрываем при клике вне области
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-language-selector]')) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const handleLanguageChange = (languageCode: string) => {
    setLanguage(languageCode)
    setIsOpen(false)
  }

  const currentLang = languages.find(lang => lang.code === currentLanguage)

  return (
    <div 
      className="relative" 
      style={{ 
        zIndex: 99999,
        position: 'relative'
      }} 
      data-language-selector
    >
      <button
        onClick={handleToggle}
        className="bg-black/20 backdrop-blur border border-white/20 rounded-lg px-2 py-1.5 text-xs flex items-center gap-1 text-white hover:bg-black/30 transition-all whitespace-nowrap"
        style={{ zIndex: 99999, minWidth: 'auto' }}
      >
        <span className="text-sm leading-none">{currentLang?.flag}</span>
        <span className="font-medium text-[11px] leading-none">{currentLang?.code.toUpperCase()}</span>
        <span className="text-[9px] opacity-70 leading-none">▼</span>
      </button>

      {isOpen && (
        <div 
          className="absolute top-full right-0 mt-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 w-[180px]"
          style={{ 
            zIndex: 99999, 
            position: 'absolute',
            top: '100%',
            right: 0
          }}
        >
          <div className="p-2 space-y-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  currentLanguage === lang.code
                    ? 'bg-accent/20 text-accent'
                    : 'hover:bg-white/10'
                }`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <span className="mr-2">{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}