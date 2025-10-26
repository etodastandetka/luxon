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
    DJANGO_API_URL: process.env.DJANGO_API_URL || 'http://127.0.0.1:8081',
    NEXT_PUBLIC_DJANGO_API_URL: process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://127.0.0.1:8081'
  }
};

module.exports = nextConfig;
