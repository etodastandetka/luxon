/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_DJANGO_BASE: process.env.NEXT_PUBLIC_DJANGO_BASE || 'https://admin.luxservice.online',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://admin.luxservice.online/api/:path*',
      },
    ]
  },
};

module.exports = nextConfig;
