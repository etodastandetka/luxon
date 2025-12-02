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
  webpack: (config) => {
    const path = require('path')
    const rootPath = path.resolve(__dirname)
    
    // Явно настраиваем алиас @ - это критически важно для разрешения путей
    if (!config.resolve) {
      config.resolve = {}
    }
    
    // Сохраняем существующие алиасы и добавляем наш
    const existingAliases = config.resolve.alias || {}
    config.resolve.alias = {
      ...existingAliases,
      '@': rootPath,
    }
    
    return config
  },
  
}

module.exports = nextConfig

