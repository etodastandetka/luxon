// Утилита для сжатия изображений перед отправкой на сервер

/**
 * Сжимает изображение до указанного размера и качества
 * @param base64String - Base64 строка изображения
 * @param maxWidth - Максимальная ширина (по умолчанию 1920)
 * @param maxHeight - Максимальная высота (по умолчанию 1920)
 * @param quality - Качество JPEG (0-1, по умолчанию 0.8)
 * @param maxSizeKB - Максимальный размер в KB (по умолчанию 500KB)
 * @returns Сжатая base64 строка
 */
export async function compressImage(
  base64String: string,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8,
  maxSizeKB: number = 500
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      try {
        // Вычисляем новые размеры с сохранением пропорций
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }
        
        // Создаем canvas для сжатия
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Не удалось получить контекст canvas'))
          return
        }
        
        // Рисуем изображение на canvas
        ctx.drawImage(img, 0, 0, width, height)
        
        // Конвертируем в base64 с указанным качеством
        let compressedBase64 = canvas.toDataURL('image/jpeg', quality)
        let currentSizeKB = (compressedBase64.length * 3) / 4 / 1024 // Примерный размер в KB
        
        console.log(`📸 Изображение сжато: ${currentSizeKB.toFixed(2)} KB`)
        
        // Если размер все еще слишком большой, уменьшаем качество
        if (currentSizeKB > maxSizeKB) {
          let currentQuality = quality
          const minQuality = 0.3
          const qualityStep = 0.1
          
          while (currentSizeKB > maxSizeKB && currentQuality >= minQuality) {
            currentQuality -= qualityStep
            compressedBase64 = canvas.toDataURL('image/jpeg', currentQuality)
            currentSizeKB = (compressedBase64.length * 3) / 4 / 1024
            console.log(`📸 Попытка сжатия с качеством ${currentQuality.toFixed(2)}: ${currentSizeKB.toFixed(2)} KB`)
          }
        }
        
        const finalSizeKB = (compressedBase64.length * 3) / 4 / 1024
        console.log(`✅ Финальный размер изображения: ${finalSizeKB.toFixed(2)} KB`)
        
        resolve(compressedBase64)
      } catch (error) {
        console.error('❌ Ошибка при сжатии изображения:', error)
        // В случае ошибки возвращаем оригинал
        resolve(base64String)
      }
    }
    
    img.onerror = (error) => {
      console.error('❌ Ошибка загрузки изображения:', error)
      reject(error)
    }
    
    img.src = base64String
  })
}

/**
 * Проверяет размер base64 строки и сжимает если нужно
 * Всегда сжимает изображение для оптимизации, даже если размер в норме
 * @param base64String - Base64 строка изображения
 * @param maxSizeKB - Максимальный размер в KB (по умолчанию 500KB)
 * @param alwaysCompress - Всегда сжимать, даже если размер в норме (по умолчанию true)
 * @returns Сжатая base64 строка
 */
export async function compressImageIfNeeded(
  base64String: string,
  maxSizeKB: number = 500,
  alwaysCompress: boolean = true
): Promise<string> {
  const currentSizeKB = (base64String.length * 3) / 4 / 1024
  
  console.log(`📏 Размер изображения: ${currentSizeKB.toFixed(2)} KB, лимит: ${maxSizeKB} KB`)
  
  // Всегда сжимаем изображение для всех устройств (не только iPhone)
  // Это предотвращает ошибку 413 и оптимизирует размер данных
  if (currentSizeKB > maxSizeKB) {
    console.log(`⚠️ Изображение слишком большое (${currentSizeKB.toFixed(2)} KB > ${maxSizeKB} KB), начинаем сжатие...`)
  } else if (alwaysCompress) {
    // Даже если размер в норме, сжимаем для оптимизации (по умолчанию alwaysCompress = true)
    console.log(`📸 Оптимизируем изображение (${currentSizeKB.toFixed(2)} KB)...`)
  } else {
    // Только если explicitly отключено alwaysCompress и размер в норме
    console.log('✅ Размер изображения в норме, сжатие не требуется')
    return base64String
  }
  
  return compressImage(base64String, 1920, 1920, 0.8, maxSizeKB)
}

