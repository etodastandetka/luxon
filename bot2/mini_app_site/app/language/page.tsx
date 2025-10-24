"use client"
import { useState, useEffect } from 'react'

export default function LanguagePage(){
  const [currentLanguage, setCurrentLanguage] = useState('ru')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedLanguage = localStorage.getItem('user_language') || 'ru'
    setCurrentLanguage(savedLanguage)
  }, [])

  const languages = [
    { code: 'ru', name: '🇷🇺 Русский', flag: '🇷🇺' },
    { code: 'en', name: '🇺🇸 English', flag: '🇺🇸' },
    { code: 'ky', name: '🇰🇬 Кыргызча', flag: '🇰🇬' },
    { code: 'uz', name: '🇺🇿 O\'zbekcha', flag: '🇺🇿' }
  ]

  const translations = {
    ru: {
      title: 'Язык',
      description: 'Выберите язык интерфейса',
      changed: 'Язык изменен на:',
      processing: 'Изменяем...'
    },
    en: {
      title: 'Language',
      description: 'Select interface language',
      changed: 'Language changed to:',
      processing: 'Changing...'
    },
    ky: {
      title: 'Тил',
      description: 'Интерфейс тилин тандаңыз',
      changed: 'Тил өзгөртүлдү:',
      processing: 'Өзгөртүүдө...'
    },
    uz: {
      title: 'Til',
      description: 'Interfeys tilini tanlang',
      changed: 'Til o\'zgartirildi:',
      processing: 'O\'zgartirish...'
    }
  }

  const t = translations[currentLanguage as keyof typeof translations] || translations.ru

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) return

    setLoading(true)
    
    try {
      // Сохраняем язык в localStorage
      localStorage.setItem('user_language', languageCode)
      
      // Здесь можно добавить API вызов для сохранения языка на сервере
      // await fetch('/api/language', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ language: languageCode })
      // })
      
      setTimeout(() => {
        setCurrentLanguage(languageCode)
        setLoading(false)
        
        const selectedLanguage = languages.find(lang => lang.code === languageCode)
        alert(`${t.changed} ${selectedLanguage?.name}`)
      }, 500)
      
    } catch (error) {
      console.error('Language change error:', error)
      setLoading(false)
      alert('Ошибка при изменении языка')
    }
  }

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-bold">{t.title}</h1>
      
      <section className="card space-y-3">
        <div className="text-white/80">{t.description}</div>
        
        <div className="grid grid-cols-2 gap-2">
          {languages.map((lang) => (
            <button 
              key={lang.code}
              className={`btn ${
                currentLanguage === lang.code 
                  ? 'btn-primary' 
                  : 'btn-ghost'
              } ${loading ? 'opacity-50' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
              disabled={loading}
            >
              {loading && currentLanguage === lang.code ? t.processing : lang.name}
            </button>
          ))}
        </div>
        
        {currentLanguage && (
          <div className="text-sm text-white/60 text-center">
            {t.changed} {languages.find(lang => lang.code === currentLanguage)?.name}
          </div>
        )}
      </section>
    </main>
  )
}
