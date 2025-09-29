import './globals.css';
import type { Metadata } from 'next';
import TelegramWebAppAuth from "../components/TelegramWebAppAuth";

export const metadata: Metadata = {
  title: 'Реферальный кабинет',
  description: 'Реферальная система',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen text-slate-100 antialiased">
        <TelegramWebAppAuth />
        <div className="lux-grid"></div>
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* SVG лучше рендерится по высоте, чтобы не искажать пропорции на телефонах */}
              <img src="/logo.svg" alt="LUX ON" className="h-8 md:h-9 w-auto block" />
              <span className="hidden md:inline text-xl font-semibold lux-gradient">Реферальный кабинет</span>
            </div>
            <nav className="text-sm space-x-3">
              <a className="hover:underline text-slate-300" href="/">Главная</a>
              <a className="hover:underline text-emerald-300" href="/withdraw">Вывод</a>
            </nav>
          </header>
          <div className="running-bar mb-8" />
          {children}
        </div>
      </body>
    </html>
  );
}
