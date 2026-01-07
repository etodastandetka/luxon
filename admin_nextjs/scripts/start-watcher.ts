#!/usr/bin/env tsx
/**
 * Скрипт для запуска Email Watcher
 * Использование: npm run watcher или tsx scripts/start-watcher.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// Загружаем переменные из .env файла
function loadEnvFile() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      // Пропускаем комментарии и пустые строки
      if (!trimmedLine || trimmedLine.startsWith('#')) continue
      
      const match = trimmedLine.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        
        // Убираем кавычки если есть
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        
        // Устанавливаем переменную окружения только если она еще не установлена
        // Это позволяет переопределить через PM2 env или системные переменные
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
    console.log('✅ Environment variables loaded from .env file')
  } catch (error: any) {
    // Если .env файл не найден, это нормально - используем системные переменные
    console.warn('⚠️  .env файл не найден, используем системные переменные окружения')
  }
}

// Загружаем .env перед импортом модулей, которые используют Prisma
loadEnvFile()

import { startWatcher } from '../lib/email-watcher'

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
  console.log('\n👋 Stopping watcher...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Stopping watcher...')
  process.exit(0)
})

// Запускаем watcher
startWatcher().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})


