"use client"
import { useEffect, useRef } from 'react'

interface Loader3DProps {
  size?: number
  color?: string
  className?: string
}

export default function Loader3D({ size = 100, color = '#22c55e', className = '' }: Loader3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Устанавливаем размеры canvas
    canvas.width = size
    canvas.height = size

    // Параметры анимации
    let rotation = 0
    let scale = 1
    let direction = 1

    const animate = () => {
      // Очищаем canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Центр canvas
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      
      // Увеличиваем поворот
      rotation += 0.05
      
      // Пульсация масштаба
      scale += direction * 0.02
      if (scale >= 1.2) direction = -1
      if (scale <= 0.8) direction = 1
      
      // Сохраняем контекст
      ctx.save()
      
      // Перемещаем в центр
      ctx.translate(centerX, centerY)
      
      // Поворачиваем
      ctx.rotate(rotation)
      
      // Масштабируем
      ctx.scale(scale, scale)
      
      // Рисуем 3D-подобный логотип "LUX ON"
      ctx.lineWidth = 4
      ctx.font = 'bold 24px Arial'
      
      // Показываем "LUX" или "ON" в зависимости от времени
      const time = Date.now() * 0.001
      const showLux = Math.floor(time * 2) % 2 === 0
      
      // Меняем цвет в зависимости от времени
      const colorTime = (time * 0.5) % 2 // 2 секунды цикл
      let currentColor = color
      
      if (colorTime < 1) {
        // Красный
        currentColor = '#ef4444'
      } else {
        // Зеленый
        currentColor = '#22c55e'
      }
      
      ctx.fillStyle = currentColor
      ctx.strokeStyle = currentColor
      
      if (showLux) {
        // Рисуем "LUX"
        ctx.fillText('LUX', -20, 5)
      } else {
        // Рисуем "ON"
        ctx.fillText('ON', -15, 5)
      }
      
      // Добавляем эффект свечения
      ctx.shadowColor = currentColor
      ctx.shadowBlur = 20
      ctx.globalAlpha = 0.8
      
      // Восстанавливаем контекст
      ctx.restore()
      
      // Продолжаем анимацию
      requestAnimationFrame(animate)
    }

    // Запускаем анимацию
    animate()

    // Очистка при размонтировании
    return () => {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
    }
  }, [size, color])

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        className="drop-shadow-lg"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.5))'
        }}
      />
    </div>
  )
}
