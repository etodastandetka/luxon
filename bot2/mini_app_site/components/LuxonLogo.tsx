"use client"

export default function LuxonLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl'
  }

  const iconSize = size === 'sm' ? 24 : size === 'md' ? 32 : 40

  return (
    <div className={`font-bold ${sizeClasses[size]} flex flex-col items-center justify-center`}>
      <div className="text-white tracking-tight">LUX</div>
      <div className="flex items-center gap-1">
        {/* Символ питания (зеленый) - круг с вертикальной линией сверху */}
        <svg 
          width={iconSize} 
          height={iconSize} 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="text-green-400"
        >
          {/* Круг */}
          <circle 
            cx="12" 
            cy="12" 
            r="7" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            fill="none"
          />
          {/* Вертикальная линия сверху */}
          <line 
            x1="12" 
            y1="2" 
            x2="12" 
            y2="8" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round"
          />
        </svg>
        <span className="text-green-400 tracking-tight">N</span>
      </div>
    </div>
  )
}

