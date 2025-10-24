import './globals.css'
import type { Metadata } from 'next'
import TelegramInit from '../components/TelegramInit'
import { LanguageProvider } from '../components/LanguageContext'
import NotificationSystem from '../components/NotificationSystem'

export const metadata: Metadata = {
  title: 'LUXON Mini App',
  description: 'Мини-приложение пополнения и вывода',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <LanguageProvider>
          <TelegramInit />
          <div className="container py-4">
            {children}
          </div>
          <NotificationSystem />
        </LanguageProvider>
      </body>
    </html>
  )
}
