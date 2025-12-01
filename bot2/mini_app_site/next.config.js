/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // appDir больше не нужен в новых версиях Next.js
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  },
  env: {
    // Django API больше не используется, оставляем для совместимости
    DJANGO_API_URL: process.env.DJANGO_API_URL || '',
    NEXT_PUBLIC_DJANGO_API_URL: process.env.NEXT_PUBLIC_DJANGO_API_URL || ''
  },
  // Скрываем информацию о сервере
  poweredByHeader: false,
  // Отключаем генерацию source maps в production для безопасности
  productionBrowserSourceMaps: false,
  // Скрываем информацию о Next.js версии
  compress: true,
  // Настройки для скрытия информации
  generateEtags: false,
  // Отключаем X-Powered-By заголовок
  headers: async () => {
    return [
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
        ],
      },
    ]
  },
};

module.exports = nextConfig;
