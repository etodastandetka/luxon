'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

export default function NewYearGarlands() {
  const pathname = usePathname()
  
  // Скрываем гирлянды на странице блокировки
  if (pathname === '/blocked') {
    return null
  }

  // Создаем изогнутую 3D гирлянду - больше лампочек для красоты
  const bulbCount = 32
  
  // Мемоизируем позиции лампочек - почти горизонтальная гирлянда с легким провисанием
  const bulbPositions = useMemo(() => {
    return Array.from({ length: bulbCount }, (_, i) => {
      const progress = i / (bulbCount - 1)
      const x = progress * 100 // процент по ширине
      
      // Легкое провисание в центре - как настоящие новогодние гирлянды
      // Они почти горизонтальные, с небольшим провисанием вниз
      const sag = 4 // глубина провисания в процентах (уменьшено для более естественного вида)
      // Параболическая кривая для плавного провисания
      const y = 50 + (sag * 4 * progress * (1 - progress))
      
      // Добавляем 3D глубину
      const depth = 0.95 + (Math.abs(progress - 0.5) * 0.08)
      return { x, y, depth }
    })
  }, [bulbCount])

  // Генерируем SVG path - точно по позициям лампочек
  const pathData = useMemo(() => {
    // Создаем путь через все точки лампочек для точного совпадения
    const points = bulbPositions.map(pos => `${pos.x},${pos.y}`)
    return `M ${points[0]} L ${points.slice(1).join(' L ')}`
  }, [bulbPositions])

  return (
    <div className="new-year-garlands">
      {/* Верхняя 3D гирлянда с изгибом */}
      <div className="garland garland-top garland-3d">
        <svg className="garland-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="garlandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" stopOpacity="0" />
              <stop offset="10%" stopColor="#ffd700" stopOpacity="0.7" />
              <stop offset="20%" stopColor="#ff6b9d" stopOpacity="0.7" />
              <stop offset="30%" stopColor="#ff1493" stopOpacity="0.8" />
              <stop offset="40%" stopColor="#c71585" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#00bfff" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#1e90ff" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#ff1493" stopOpacity="0.7" />
              <stop offset="80%" stopColor="#ff6b9d" stopOpacity="0.7" />
              <stop offset="90%" stopColor="#32cd32" stopOpacity="0.8" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>
            {/* Дополнительный градиент для перелива */}
            <linearGradient id="garlandGradientGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffd700" stopOpacity="0.3" />
              <stop offset="25%" stopColor="#ff1493" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#00bfff" stopOpacity="0.5" />
              <stop offset="75%" stopColor="#32cd32" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffd700" stopOpacity="0.3" />
            </linearGradient>
            {/* 3D тень для гирлянды */}
            <filter id="garlandShadow">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="0" dy="3" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.4"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Эффект свечения */}
            <filter id="garlandGlow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {/* Основной путь с градиентом */}
          <path
            className="garland-path garland-path-3d"
            d={pathData}
            fill="none"
            stroke="url(#garlandGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            filter="url(#garlandShadow)"
          />
          {/* Дополнительный путь для свечения */}
          <path
            className="garland-path garland-path-glow"
            d={pathData}
            fill="none"
            stroke="url(#garlandGradientGlow)"
            strokeWidth="5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            filter="url(#garlandGlow)"
            opacity="0.6"
          />
        </svg>
        <div className="garland-line">
          {bulbPositions.map((pos, i) => {
            // Разнообразим цвета лампочек
            const colorIndex = i % 5
            const colors = ['#ffd700', '#ff1493', '#00bfff', '#32cd32', '#ff6b9d']
            const color = colors[colorIndex]
            
            return (
              <div 
                key={i} 
                className="garland-bulb garland-bulb-3d" 
                style={{ 
                  animationDelay: `${i * 0.08}s`,
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: `translate(-50%, -50%) scale(${pos.depth}) translateZ(${pos.depth * 10}px)`,
                  zIndex: Math.round(pos.depth * 10),
                  '--bulb-color': color
                } as React.CSSProperties}
              >
                <div className="bulb-inner bulb-inner-3d" style={{ color }}></div>
                <div className="bulb-glow" style={{ color }}></div>
                <div className="bulb-sparkle"></div>
              </div>
            )
          })}
        </div>
      </div>
      
    </div>
  )
}

