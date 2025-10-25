"use client"
import { useEffect, useRef } from 'react'

interface Loader3DAdvancedProps {
  size?: number
  color?: string
  className?: string
}

export default function Loader3DAdvanced({ size = 200, color = '#22c55e', className = '' }: Loader3DAdvancedProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Создаем 3D логотип с помощью CSS 3D трансформаций
    const create3DLogo = () => {
      const logo = document.createElement('div')
      logo.className = 'luxon-3d-logo'
      logo.style.cssText = `
        position: relative;
        width: ${size}px;
        height: ${size}px;
        transform-style: preserve-3d;
        animation: rotate3d 3s linear infinite;
      `

      // Создаем грани куба для эффекта 3D
      const faces = ['front', 'back', 'right', 'left', 'top', 'bottom']
      faces.forEach((face, index) => {
        const faceElement = document.createElement('div')
        faceElement.className = `face ${face}`
        faceElement.style.cssText = `
          position: absolute;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: 2px solid #ef4444;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${size * 0.15}px;
          font-weight: bold;
          color: white;
          text-shadow: 0 0 10px #ef4444;
          box-shadow: 0 0 30px #ef444440;
          animation: colorTransition 3s ease-in-out infinite;
        `

        // Позиционируем грани
        switch (face) {
          case 'front':
            faceElement.style.transform = 'translateZ(50px)'
            faceElement.textContent = 'LUX'
            break
          case 'back':
            faceElement.style.transform = 'translateZ(-50px) rotateY(180deg)'
            faceElement.textContent = 'ON'
            break
          case 'right':
            faceElement.style.transform = 'rotateY(90deg) translateZ(50px)'
            faceElement.textContent = 'LUX'
            break
          case 'left':
            faceElement.style.transform = 'rotateY(-90deg) translateZ(50px)'
            faceElement.textContent = 'LUX'
            break
          case 'top':
            faceElement.style.transform = 'rotateX(90deg) translateZ(50px)'
            faceElement.textContent = 'ON'
            break
          case 'bottom':
            faceElement.style.transform = 'rotateX(-90deg) translateZ(50px)'
            faceElement.textContent = 'ON'
            break
        }

        logo.appendChild(faceElement)
      })

      return logo
    }

    // Добавляем CSS анимации
    const style = document.createElement('style')
    style.textContent = `
      @keyframes rotate3d {
        0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1); }
        25% { transform: rotateX(0deg) rotateY(90deg) rotateZ(0deg) scale(1.1); }
        50% { transform: rotateX(0deg) rotateY(180deg) rotateZ(0deg) scale(1.2); }
        75% { transform: rotateX(90deg) rotateY(180deg) rotateZ(0deg) scale(1.1); }
        100% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1); }
      }
      
      @keyframes pulse3d {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      
      @keyframes colorTransition {
        0% { 
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border-color: #ef4444;
          box-shadow: 0 0 30px #ef444440;
          text-shadow: 0 0 10px #ef4444;
        }
        25% { 
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border-color: #f59e0b;
          box-shadow: 0 0 30px #f59e0b40;
          text-shadow: 0 0 10px #f59e0b;
        }
        50% { 
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-color: #3b82f6;
          box-shadow: 0 0 30px #3b82f640;
          text-shadow: 0 0 10px #3b82f6;
        }
        75% { 
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          border-color: #8b5cf6;
          box-shadow: 0 0 30px #8b5cf640;
          text-shadow: 0 0 10px #8b5cf6;
        }
        100% { 
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-color: #22c55e;
          box-shadow: 0 0 30px #22c55e40;
          text-shadow: 0 0 10px #22c55e;
        }
      }
      
      @keyframes glow {
        0%, 100% { 
          filter: drop-shadow(0 0 20px rgba(34, 197, 94, 0.5));
        }
        50% { 
          filter: drop-shadow(0 0 40px rgba(34, 197, 94, 0.8));
        }
      }
      
      .luxon-3d-logo {
        animation: rotate3d 3s linear infinite, pulse3d 2s ease-in-out infinite, glow 2s ease-in-out infinite;
      }
      
      .luxon-3d-logo:hover {
        animation-play-state: paused;
        transform: scale(1.2);
        transition: transform 0.3s ease;
      }
    `
    document.head.appendChild(style)

    // Создаем и добавляем логотип
    const logo = create3DLogo()
    container.appendChild(logo)

    // Очистка при размонтировании
    return () => {
      if (container) {
        container.innerHTML = ''
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style)
      }
    }
  }, [size, color])

  return (
    <div 
      ref={containerRef}
      className={`flex items-center justify-center ${className}`}
      style={{
        perspective: '1000px',
        perspectiveOrigin: 'center center'
      }}
    />
  )
}
