import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Luxon Admin Panel',
  description: 'Admin panel for Luxon bot management',
  manifest: '/manifest.json',
  themeColor: '#22c55e',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Luxon Admin',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.jpg" />
        <link rel="apple-touch-icon" href="/icon.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Luxon Admin" />
        <meta name="msapplication-TileColor" content="#22c55e" />
        <meta name="msapplication-TileImage" content="/icon.jpg" />
      </head>
      <body>{children}</body>
    </html>
  )
}

