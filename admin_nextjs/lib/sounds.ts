/**
 * Утилита для воспроизведения звуковых уведомлений через Web Audio API
 */

// Проверка поддержки Web Audio API
const isAudioContextSupported = () => {
  return typeof window !== 'undefined' && 
         (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined')
}

// Создание AudioContext
let audioContext: AudioContext | null = null

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  
  if (!audioContext) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioContext = new AudioContextClass()
    } catch (e) {
      console.warn('Web Audio API not supported:', e)
      return null
    }
  }
  
  // Восстанавливаем контекст если он приостановлен (браузеры требуют взаимодействия пользователя)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
  
  return audioContext
}

/**
 * Генерация простого тонального звука
 */
const playTone = (
  frequency: number,
  duration: number = 200,
  type: OscillatorType = 'sine',
  volume: number = 0.3
): void => {
  const ctx = getAudioContext()
  if (!ctx) {
    console.warn('AudioContext not available')
    return
  }

  try {
    // Убеждаемся что контекст активен
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        console.warn('Failed to resume AudioContext')
        return
      })
    }

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = type

    // Плавное нарастание и затухание для избежания щелчков
    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01)
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000)

    oscillator.start(now)
    oscillator.stop(now + duration / 1000)
  } catch (error) {
    console.warn('Failed to play tone:', error)
  }
}

/**
 * Воспроизведение последовательности тонов
 */
const playSequence = (frequencies: number[], durations: number[] = [], gap: number = 100): void => {
  const ctx = getAudioContext()
  if (!ctx) return

  frequencies.forEach((freq, index) => {
    const duration = durations[index] || 150
    setTimeout(() => {
      playTone(freq, duration)
    }, index * (duration + gap))
  })
}

/**
 * Проверка включены ли звуки (из localStorage)
 */
export const isSoundsEnabled = (): boolean => {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem('admin_sounds_enabled')
  return stored === null ? true : stored === 'true'
}

/**
 * Включить/выключить звуки
 */
export const setSoundsEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem('admin_sounds_enabled', enabled.toString())
}

/**
 * Звук для нового пополнения (более высокий, позитивный тон)
 */
export const playDepositSound = (): void => {
  if (!isSoundsEnabled()) return
  
  // Два восходящих тона - звук успеха/пополнения
  playSequence([523.25, 659.25], [150, 200], 50) // C5, E5
}

/**
 * Звук для нового вывода (более низкий, нейтральный тон)
 */
export const playWithdrawSound = (): void => {
  if (!isSoundsEnabled()) return
  
  // Два нисходящих тона - звук уведомления
  playSequence([392.00, 329.63], [150, 200], 50) // G4, E4
}

/**
 * Звук для общего уведомления
 */
export const playNotificationSound = (): void => {
  if (!isSoundsEnabled()) return
  
  // Простой короткий звук
  playTone(440, 150, 'sine', 0.3) // A4
}

/**
 * Инициализация AudioContext при первом взаимодействии пользователя
 */
export const initAudioContext = (): void => {
  if (typeof window === 'undefined') return
  
  // Пытаемся создать контекст сразу, но он может быть suspended
  // до первого взаимодействия пользователя
  getAudioContext()
  
  // Также слушаем первое взаимодействие для активации контекста
  const initOnInteraction = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    document.removeEventListener('click', initOnInteraction)
    document.removeEventListener('touchstart', initOnInteraction)
    document.removeEventListener('keydown', initOnInteraction)
  }
  
  document.addEventListener('click', initOnInteraction, { once: true })
  document.addEventListener('touchstart', initOnInteraction, { once: true })
  document.addEventListener('keydown', initOnInteraction, { once: true })
}

