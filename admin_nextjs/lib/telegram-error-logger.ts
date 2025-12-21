/**
 * Утилита для отправки ошибок в Telegram администратору
 */

interface ErrorInfo {
  message: string
  stack?: string
  context?: string
  url?: string
  userAgent?: string
  timestamp?: string
  severity?: 'error' | 'warning' | 'critical'
}

/**
 * Отправляет ошибку администратору в личные сообщения Telegram
 * @param error - Информация об ошибке
 * @param chatId - Telegram Chat ID администратора (если не указан, берется из ADMIN_TELEGRAM_CHAT_ID)
 */
export async function sendTelegramErrorNotification(
  error: ErrorInfo | string | Error,
  chatId?: string
): Promise<boolean> {
  try {
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      console.warn('⚠️ BOT_TOKEN not configured, skipping Telegram error notification')
      return false
    }

    const adminChatId = chatId || process.env.ADMIN_TELEGRAM_CHAT_ID
    if (!adminChatId) {
      console.warn('⚠️ ADMIN_TELEGRAM_CHAT_ID not configured, skipping Telegram error notification')
      return false
    }

    // Форматируем ошибку
    let errorInfo: ErrorInfo
    if (typeof error === 'string') {
      errorInfo = { message: error }
    } else if (error instanceof Error) {
      errorInfo = {
        message: error.message,
        stack: error.stack,
      }
    } else {
      errorInfo = error
    }

    // Формируем сообщение
    const timestamp = errorInfo.timestamp || new Date().toLocaleString('ru-RU', { 
      timeZone: 'Asia/Bishkek',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    const severity = errorInfo.severity || 'error'
    const severityEmoji = severity === 'critical' ? '🔴' : severity === 'warning' ? '⚠️' : '❌'

    let message = `${severityEmoji} <b>Ошибка в системе</b>\n\n`
    message += `<b>Сообщение:</b>\n<code>${escapeHtml(errorInfo.message)}</code>\n\n`
    message += `<b>Время:</b> ${timestamp}\n`

    if (errorInfo.context) {
      message += `<b>Контекст:</b> ${escapeHtml(errorInfo.context)}\n`
    }

    if (errorInfo.url) {
      message += `<b>URL:</b> <code>${escapeHtml(errorInfo.url)}</code>\n`
    }

    // Обрезаем stack trace до 1000 символов (лимит Telegram ~4096 символов)
    if (errorInfo.stack) {
      const stackTrace = errorInfo.stack.length > 1000 
        ? errorInfo.stack.substring(0, 1000) + '... (обрезано)'
        : errorInfo.stack
      message += `\n<b>Stack trace:</b>\n<pre>${escapeHtml(stackTrace)}</pre>`
    }

    // Отправляем сообщение
    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Failed to send Telegram error notification:', errorData)
      return false
    }

    const data = await response.json()
    if (data.ok) {
      console.log(`✅ Telegram error notification sent to admin (${adminChatId})`)
      return true
    }

    return false
  } catch (error) {
    console.error('❌ Error sending Telegram error notification:', error)
    return false
  }
}

/**
 * Экранирует HTML символы для безопасной отправки в Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Обертка для перехвата ошибок из console.error
 * Использование: переопределить console.error = createErrorLogger()
 */
export function createErrorLogger() {
  const originalError = console.error

  return function(...args: any[]) {
    // Вызываем оригинальный console.error
    originalError.apply(console, args)

    // Отправляем в Telegram (только критические ошибки)
    const errorString = args
      .map(arg => {
        if (arg instanceof Error) {
          return arg.message + '\n' + arg.stack
        }
        return String(arg)
      })
      .join(' ')

    // Фильтруем несущественные ошибки
    const isCritical = 
      errorString.includes('PrismaClientKnownRequestError') ||
      errorString.includes('Failed to fetch') ||
      errorString.includes('500') ||
      errorString.includes('502') ||
      errorString.includes('503') ||
      errorString.includes('Error processing') ||
      errorString.includes('❌') ||
      errorString.length > 100 // Длинные ошибки обычно важные

    if (isCritical) {
      // Отправляем асинхронно, не блокируя выполнение
      sendTelegramErrorNotification({
        message: errorString.substring(0, 500),
        stack: errorString,
        severity: 'error',
        timestamp: new Date().toISOString(),
      }).catch(err => {
        // Игнорируем ошибки отправки, чтобы не зациклиться
        originalError('Failed to send error to Telegram:', err)
      })
    }
  }
}

