/**
 * Утилита для воспроизведения звуковых уведомлений через HTML5 Audio
 */

// Пути к звуковым файлам
const SOUND_DEPOSIT = '/social-media-logout-sound.mp3'
const SOUND_WITHDRAW = '/ringtone-sms-notification.mp3'

// Кэш для Audio объектов чтобы не создавать их каждый раз
const audioCache: Map<string, HTMLAudioElement> = new Map()

/**
 * Создание или получение Audio объекта из кэша
 */
const getAudio = (src: string): HTMLAudioElement | null => {
  if (typeof window === 'undefined') return null
  
  // Проверяем кэш
  if (audioCache.has(src)) {
    const audio = audioCache.get(src)!
    // Сбрасываем позицию на начало для повторного воспроизведения
    audio.currentTime = 0
    return audio
  }
  
  // Создаем новый Audio объект
  try {
    const audio = new Audio(src)
    audio.volume = 0.7 // Устанавливаем громкость 70%
    audio.preload = 'auto' // Предзагрузка для быстрого воспроизведения
    
    // Обработка ошибок загрузки
    audio.addEventListener('error', (e) => {
      console.error(`🔊 [Sounds] Failed to load audio: ${src}`, e)
      audioCache.delete(src)
    })
    
    // Сохраняем в кэш
    audioCache.set(src, audio)
    return audio
  } catch (error) {
    console.error(`🔊 [Sounds] Failed to create Audio object for ${src}:`, error)
    return null
  }
}

/**
 * Воспроизведение звукового файла
 */
const playSound = (src: string): void => {
  if (typeof window === 'undefined') return
  
  const audio = getAudio(src)
  if (!audio) {
    console.warn(`🔊 [Sounds] Audio not available for ${src}`)
    return
  }
  
  try {
    // Сбрасываем позицию на начало
    audio.currentTime = 0
    
    // Воспроизводим звук
    const playPromise = audio.play()
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`🔊 [Sounds] Playing sound: ${src}`)
        })
        .catch((error) => {
          // Браузер может блокировать автовоспроизведение
          // Это нормально, пользователь должен сначала взаимодействовать со страницей
          console.warn(`🔊 [Sounds] Playback failed for ${src}, user interaction may be required:`, error)
        })
    }
  } catch (error) {
    console.error(`🔊 [Sounds] Error playing sound ${src}:`, error)
  }
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
 * Звук для нового пополнения
 */
export const playDepositSound = (): void => {
  console.log('🔊 [Sounds] playDepositSound called, enabled:', isSoundsEnabled())
  if (!isSoundsEnabled()) {
    console.log('🔊 [Sounds] Sounds are disabled, skipping')
    return
  }
  
  playSound(SOUND_DEPOSIT)
}

/**
 * Звук для нового вывода
 */
export const playWithdrawSound = (): void => {
  console.log('🔊 [Sounds] playWithdrawSound called, enabled:', isSoundsEnabled())
  if (!isSoundsEnabled()) {
    console.log('🔊 [Sounds] Sounds are disabled, skipping')
    return
  }
  
  playSound(SOUND_WITHDRAW)
}

/**
 * Звук для общего уведомления
 */
export const playNotificationSound = (): void => {
  if (!isSoundsEnabled()) return
  playSound(SOUND_DEPOSIT)
}

/**
 * Инициализация звуков - предзагрузка аудио файлов
 */
export const initAudioContext = (): void => {
  if (typeof window === 'undefined') return
  
  console.log('🔊 [Sounds] Initializing sounds, preloading audio files...')
  
  // Предзагружаем оба звуковых файла
  const depositAudio = getAudio(SOUND_DEPOSIT)
  const withdrawAudio = getAudio(SOUND_WITHDRAW)
  
  if (depositAudio) {
    depositAudio.load()
    console.log('🔊 [Sounds] Deposit sound preloaded')
  }
  
  if (withdrawAudio) {
    withdrawAudio.load()
    console.log('🔊 [Sounds] Withdraw sound preloaded')
  }
}

/**
 * Принудительная активация AudioContext (для совместимости)
 * В случае с HTML5 Audio это просто попытка воспроизвести тестовый звук
 */
export const activateAudioContext = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  
  console.log('🔊 [Sounds] Activating audio context (HTML5 Audio)')
  
  // Пытаемся воспроизвести очень короткий тихий звук для активации
  // Это поможет разблокировать автовоспроизведение в некоторых браузерах
  try {
    const testAudio = getAudio(SOUND_DEPOSIT)
    if (testAudio) {
      testAudio.volume = 0.01 // Очень тихо
      const playPromise = testAudio.play()
      if (playPromise !== undefined) {
        await playPromise
        testAudio.pause()
        testAudio.currentTime = 0
        testAudio.volume = 0.7 // Возвращаем нормальную громкость
        console.log('🔊 [Sounds] Audio context activated successfully')
        return true
      }
    }
  } catch (error) {
    console.warn('🔊 [Sounds] Failed to activate audio context:', error)
  }
  
  return false
}
