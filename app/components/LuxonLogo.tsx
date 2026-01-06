"use client"

export default function LuxonLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl'
  }

  return (
    <div className={`font-bold ${sizeClasses[size]} flex flex-col items-center justify-center`}>
      <div className="text-white tracking-tight">LUX</div>
      <div className="text-green-400 tracking-tight">ON</div>
    </div>
  )
}

