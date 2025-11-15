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
  }
};

module.exports = nextConfig;
