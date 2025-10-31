import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Luxon Admin Panel',
  description: 'Admin panel for Luxon bot management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}

