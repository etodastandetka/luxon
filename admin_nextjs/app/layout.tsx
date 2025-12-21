import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Luxon Admin Panel',
  description: 'Admin panel for Luxon bot management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Luxon Admin',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#22c55e',
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
        {/* Критические стили встроены инлайн для мгновенной загрузки */}
        <style dangerouslySetInnerHTML={{__html: `
          :root{--foreground-rgb:255,255,255;--background-start-rgb:16,28,20;--background-end-rgb:20,32,24}
          html,body{height:100%;overflow:hidden}
          body{color:rgb(var(--foreground-rgb));background:rgb(var(--background-start-rgb));font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell',sans-serif}
          .mobile-container{max-width:414px;margin:0 auto;height:100vh;background:transparent;position:relative;display:flex;flex-direction:column;overflow:hidden}
          ::-webkit-scrollbar{width:6px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:rgba(34,197,94,.3);border-radius:10px;transition:background .2s ease}
          ::-webkit-scrollbar-thumb:hover{background:rgba(34,197,94,.5)}
          .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
          .scrollbar-hide::-webkit-scrollbar{display:none}
          *{scrollbar-width:thin;scrollbar-color:rgba(34,197,94,.3) transparent}
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}

