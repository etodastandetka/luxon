/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // appDir больше не нужен в новых версиях Next.js
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
};

module.exports = nextConfig;
