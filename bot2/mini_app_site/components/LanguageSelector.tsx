"use client"
import { useState } from 'react'
import { useLanguage } from './LanguageContext'

const languages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ky', name: 'Кыргызча', flag: '🇰🇬' },
  { code: 'uz', name: 'O\'zbekcha', flag: '🇺🇿' }
]

export default function LanguageSelector() {
  const { language: currentLanguage, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  const handleLanguageChange = (languageCode: string) => {
    setLanguage(languageCode)
    setIsOpen(false)
  }

  const currentLang = languages.find(lang => lang.code === currentLanguage)

  return (
    <div className="relative" style={{ zIndex: 99999, position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost text-sm flex items-center gap-2"
        style={{ zIndex: 99999, position: 'relative' }}
      >
        <span>{currentLang?.flag}</span>
        <span>{currentLang?.name}</span>
        <span className="text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 min-w-[200px]"
          style={{ zIndex: 99999, position: 'absolute' }}
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