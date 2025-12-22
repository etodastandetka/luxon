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
    // output: 'standalone', // Отключено - несовместимо с next start в PM2
    productionBrowserSourceMaps: false, // Отключаем source maps в production
  }),
  
  // Кеширование заголовков
  generateEtags: true,
  
  // Отключаем автоматический prefetch для всех страниц (ускоряет загрузку)
  experimental: {
    // Отключаем автоматический prefetch для всех Link компонентов
    // Страницы будут загружаться только при клике
    optimizePackageImports: ['@/lib'],
  },
  
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    BOT_TOKEN: process.env.BOT_TOKEN,
    GEOLOCATION_ENABLED: process.env.GEOLOCATION_ENABLED, // Для middleware
  },
  
  // Webpack конфигурация для правильного разрешения путей
  webpack: (config, { isServer }) => {
    const path = require('path')
    
    // Убеждаемся, что webpack правильно разрешает относительные пути
    config.resolve.modules = [
      path.resolve(__dirname, '.'),
      'node_modules',
      ...(config.resolve.modules || []),
    ]
    
    // Убеждаемся, что webpack ищет файлы с расширениями
    config.resolve.extensions = [
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
      ...(config.resolve.extensions || []),
    ]
    
    // Включаем полное разрешение путей
    config.resolve.fullySpecified = false
    
    // Добавляем alias для lib/ - важно использовать абсолютный путь
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '.'),
      '@/lib': path.resolve(__dirname, 'lib'),
    }
    
    // Убеждаемся, что symlinks разрешены
    config.resolve.symlinks = true
    
    return config
  },
  
}

module.exports = nextConfig

