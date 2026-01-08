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
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ],
    // Форматы изображений (Next.js поддерживает только avif и webp)
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // Кеш изображений на 1 год (статические изображения)
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Оптимизация для быстрой загрузки
    unoptimized: false, // Включаем оптимизацию
    loader: 'default', // Используем встроенный оптимизатор Next.js
  },
  
  // Оптимизация компиляции
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Оставляем только error и warn в production
    } : false,
  },
  
  // Совместимость со старыми браузерами
  transpilePackages: [],
  
  // Экспериментальные настройки для совместимости
  experimental: {
    // Отключаем современные фичи для совместимости
    esmExternals: false,
  },
  
  // Оптимизация бандла
  // Отключаем optimizeCss т.к. требует critters модуль
  // experimental: {
  //   optimizeCss: true, // Оптимизация CSS
  // },
  
  // Production оптимизации
  ...(process.env.NODE_ENV === 'production' && {
    productionBrowserSourceMaps: false, // Отключаем source maps в production
  }),
  
  // Кеширование заголовков
  generateEtags: true,
  
  env: {
    // Версия приложения для проверки обновлений
    NEXT_PUBLIC_APP_VERSION: Date.now().toString()
  },
  
  // Заголовки безопасности и оптимизации
  headers: async () => {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // Долгое кеширование для статических JS/CSS
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // Долгое кеширование для изображений
          },
        ],
      },
      {
        source: '/logo.glb',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // Долгое кеширование для GLB файла
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate', // Не кешируем API
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/icon-:size.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Powered-By',
            value: '',
          },
          {
            key: 'Server',
            value: '',
          },
          {
            key: 'X-Version',
            value: Date.now().toString(), // Версия для проверки обновлений
          },
          // Полностью отключаем кеширование HTML страниц
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
