'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useLanguage } from './LanguageContext'
import { HomeIcon, DepositIcon, WithdrawIcon, ProfileIcon } from './Icons'

export default function BottomNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { language } = useLanguage()

  // Скрываем меню на странице блокировки
  if (pathname === '/blocked') {
    return null
  }

  const translations = {
    ru: {
      home: 'Главная',
      deposit: 'Пополнить',
      withdraw: 'Вывести',
      referral: 'Рефералка',
      profile: 'Профиль'
    },
    en: {
      home: 'Home',
      deposit: 'Deposit',
      withdraw: 'Withdraw',
      referral: 'Referral',
      profile: 'Profile'
    }
  }

  const t = translations[language as keyof typeof translations] || translations.ru

  const menuItems = [
    { path: '/', label: t.home, Icon: HomeIcon },
    { path: '/deposit', label: t.deposit, Icon: DepositIcon },
    { path: '/withdraw', label: t.withdraw, Icon: WithdrawIcon },
    { path: '/profile', label: t.profile, Icon: ProfileIcon }
  ]

  const handleNavigation = (path: string) => {
    // Предотвращаем навигацию на ту же страницу
    if (pathname === path) {
      return
    }
    
    try {
      router.push(path)
    } catch (error) {
      console.error('Navigation error:', error)
      // Fallback на window.location если router не работает
      window.location.href = path
    }
  }

  const isActivePath = (itemPath: string, currentPath: string) => {
    if (itemPath === '/') {
      return currentPath === '/'
    }
    return currentPath.startsWith(itemPath)
  }

  return (
    <nav className="bottom-navigation">
      {menuItems.map((item) => {
        const isActive = isActivePath(item.path, pathname)
        
        const IconComponent = item.Icon
        return (
          <button
            key={item.path}
            onClick={() => handleNavigation(item.path)}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <IconComponent className="w-6 h-6" />
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

