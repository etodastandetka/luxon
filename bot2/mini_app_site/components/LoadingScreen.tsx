"use client"
import { useState, useEffect } from 'react'

interface LoadingScreenProps {
  message?: string
  showProgress?: boolean
  progress?: number
}

export default function LoadingScreen({ 
  message = 'LUX ON', 
  showProgress = false, 
  progress = 0
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50" style={{
      background: 'linear-gradient(135deg, #0f1b0f 0%, #1a2e1a 50%, #0f1b0f 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* Контент */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-6">
          {/* Логотип LUX ON */}
          <h1 className="text-5xl font-bold text-white drop-shadow-lg tracking-wider">
            {message}
          </h1>
          
          {/* Прогресс бар */}
          {showProgress && (
            <div className="w-64 mx-auto">
              <div className="relative bg-black/40 backdrop-blur rounded-full h-2 overflow-hidden border border-white/20">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
