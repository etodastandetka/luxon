"use client"
import Image from 'next/image'

export default function LuxonLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  }

  return (
    <div className={`flex items-center justify-center ${sizeClasses[size]}`}>
      <Image
        src="/luxon.jpg"
        alt="LUX ON"
        width={size === 'sm' ? 64 : size === 'md' ? 96 : 128}
        height={size === 'sm' ? 64 : size === 'md' ? 96 : 128}
        className="object-contain rounded-lg"
        priority
      />
    </div>
  )
}

