/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Оптимизация производительности
  swcMinify: true, // Используем SWC вместо Terser (быстрее)
  compress: true, // Включаем gzip компрессию
  poweredByHeader: false, // Скрываем X-Powered-By
  
  // Оптимизация изображений
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.telegram.org',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'], // Современные форматы
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60, // Кеш изображений на 60 секунд
  },
  
  // Оптимизация компиляции
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Оставляем только error и warn в production
    } : false,
  },
  
  // Оптимизация бандла
  // Отключаем optimizeCss т.к. требует critters модуль
  // experimental: {
  //   optimizeCss: true, // Оптимизация CSS
  // },
  
  // Production оптимизации
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone', // Standalone режим для меньшего размера
    productionBrowserSourceMaps: false, // Отключаем source maps в production
  }),
  
  // Кеширование заголовков
  generateEtags: true,
  
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    BOT_TOKEN: process.env.BOT_TOKEN,
  },
  
  // Конфигурация webpack для правильного разрешения алиасов
  webpack: (config, { isServer, dev }) => {
    const path = require('path')
    
    // Убеждаемся, что resolve существует
    if (!config.resolve) {
      config.resolve = {}
    }
    
    // Явно устанавливаем алиас @ с полным путем
    const rootPath = path.resolve(__dirname)
    
    // Полностью переопределяем alias, чтобы гарантировать правильную настройку
    config.resolve.alias = {
      '@': rootPath,
    }
    
    // Добавляем корневую директорию в modules
    if (!config.resolve.modules) {
      config.resolve.modules = []
    }
    if (!Array.isArray(config.resolve.modules)) {
      config.resolve.modules = [config.resolve.modules]
    }
    config.resolve.modules = [
      rootPath,
      path.resolve(rootPath, 'node_modules'),
      ...config.resolve.modules.filter((m) => m !== rootPath),
    ]
    
    // Убеждаемся, что расширения файлов включены
    if (!config.resolve.extensions) {
      config.resolve.extensions = []
    }
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json']
    extensions.forEach((ext) => {
      if (!config.resolve.extensions.includes(ext)) {
        config.resolve.extensions.push(ext)
      }
    })
    
    return config
  },
}

module.exports = nextConfig

