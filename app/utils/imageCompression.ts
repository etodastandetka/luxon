/**
 * Утилита для сжатия изображений на клиенте
 * Поддерживает сжатие больших изображений с iPhone и других устройств
 */

interface CompressImageOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeMB?: number
}

/**
 * Сжимает изображение до указанных параметров
 * @param file - Файл изображения
 * @param options - Опции сжатия
 * @returns Promise с сжатым файлом или оригинальным, если сжатие не требуется
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    maxSizeMB = 5,
  } = options

  // Если файл уже достаточно маленький, возвращаем оригинал
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Вычисляем новые размеры с сохранением пропорций
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        
        // Создаем canvas для сжатия
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Не удалось создать контекст canvas'))
          return
        }
        
        // Рисуем изображение на canvas с новыми размерами
        ctx.drawImage(img, 0, 0, width, height)
        
        // Конвертируем в blob с указанным качеством
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Не удалось сжать изображение'))
              return
            }
            
            // Создаем новый File объект с оригинальным именем
            const compressedFile = new File(
              [blob],
              file.name,
              {
                type: file.type || 'image/jpeg',
                lastModified: Date.now(),
              }
            )
            
            console.log(`✅ Изображение сжато: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
            resolve(compressedFile)
          },
          file.type || 'image/jpeg',
          quality
        )
      }
      
      img.onerror = () => {
        reject(new Error('Ошибка загрузки изображения'))
      }
      
      if (typeof e.target?.result === 'string') {
        img.src = e.target.result
      } else {
        reject(new Error('Неверный формат данных'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'))
    }
    
    reader.readAsDataURL(file)
  })
}

/**
 * Конвертирует File в base64 строку с опциональным сжатием
 * @param file - Файл изображения
 * @param compress - Нужно ли сжимать изображение
 * @returns Promise с base64 строкой
 */
export async function fileToBase64(
  file: File,
  compress: boolean = true
): Promise<string> {
  let fileToProcess = file
  
  // Сжимаем изображение, если нужно и файл большой
  if (compress && file.size > 2 * 1024 * 1024) {
    try {
      fileToProcess = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        maxSizeMB: 2,
      })
    } catch (error) {
      console.warn('⚠️ Не удалось сжать изображение, используем оригинал:', error)
      // Продолжаем с оригинальным файлом
    }
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        resolve(e.target.result)
      } else {
        reject(new Error('Неверный формат данных'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'))
    }
    
    reader.readAsDataURL(fileToProcess)
  })
}

