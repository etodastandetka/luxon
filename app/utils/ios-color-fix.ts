/**
 * Утилита для исправления цветов на iOS
 * Заменяет Tailwind opacity синтаксис на rgba для совместимости
 */

/**
 * Проверяет, является ли устройство iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent || '')
}

/**
 * Применяет исправления цветов для iOS
 */
export function applyIOSColorFixes(): void {
  if (typeof document === 'undefined' || !isIOS()) {
    return
  }

  // Добавляем стили для замены Tailwind opacity синтаксиса
  const style = document.createElement('style')
  style.id = 'ios-color-fixes'
  style.textContent = `
    /* Заменяем Tailwind opacity синтаксис на rgba для iOS */
    .text-white\\/70,
    [class*="text-white/70"] {
      color: rgba(255, 255, 255, 0.7) !important;
    }
    
    .text-white\\/60,
    [class*="text-white/60"] {
      color: rgba(255, 255, 255, 0.6) !important;
    }
    
    .text-white\\/50,
    [class*="text-white/50"] {
      color: rgba(255, 255, 255, 0.5) !important;
    }
    
    .text-white\\/40,
    [class*="text-white/40"] {
      color: rgba(255, 255, 255, 0.4) !important;
    }
    
    .text-white\\/30,
    [class*="text-white/30"] {
      color: rgba(255, 255, 255, 0.3) !important;
    }
    
    .text-white\\/80,
    [class*="text-white/80"] {
      color: rgba(255, 255, 255, 0.8) !important;
    }
    
    .bg-white\\/5,
    [class*="bg-white/5"] {
      background-color: rgba(255, 255, 255, 0.05) !important;
    }
    
    .bg-white\\/10,
    [class*="bg-white/10"] {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    .border-white\\/10,
    [class*="border-white/10"] {
      border-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    .border-white\\/20,
    [class*="border-white/20"] {
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
    
    /* Принудительно устанавливаем белый цвет текста */
    .text-white {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    
    /* Исправляем цвета для body */
    body {
      color: var(--tg-theme-text-color, #ffffff) !important;
      -webkit-text-fill-color: var(--tg-theme-text-color, #ffffff) !important;
      background-color: var(--tg-theme-bg-color, #111827) !important;
    }
    
    /* Исправляем цвета для всех элементов с классом card */
    .card {
      color: var(--tg-theme-text-color, #ffffff) !important;
      -webkit-text-fill-color: var(--tg-theme-text-color, #ffffff) !important;
    }
    
    /* Исправляем цвета для всех заголовков */
    h1, h2, h3, h4, h5, h6 {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    
    /* Исправляем цвета для параграфов */
    p {
      color: inherit;
    }
  `
  
  // Удаляем старый стиль если есть
  const oldStyle = document.getElementById('ios-color-fixes')
  if (oldStyle) {
    oldStyle.remove()
  }
  
  document.head.appendChild(style)
}

/**
 * Инициализирует исправления цветов
 */
export function initIOSColorFixes(): void {
  if (typeof window === 'undefined') return
  
  // Применяем сразу
  applyIOSColorFixes()
  
  // Применяем после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyIOSColorFixes)
  }
  
  // Применяем после полной загрузки
  window.addEventListener('load', applyIOSColorFixes)
  
  // Применяем при изменении темы Telegram
  if (typeof window !== 'undefined') {
    try {
      const telegram = (window as any).Telegram
      if (telegram && telegram.WebApp) {
        telegram.WebApp.onEvent('themeChanged', applyIOSColorFixes)
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  }
}

