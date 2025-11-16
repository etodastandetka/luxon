/**
 * Утилита для отправки сообщений в Telegram группу
 */

/**
 * Отправляет сообщение в Telegram группу
 * @param message - Текст сообщения (поддерживает HTML)
 * @param chatId - ID группы (если не указан, берется из переменной окружения GROUP_CHAT_ID)
 */
export async function sendTelegramGroupMessage(
  message: string,
  chatId?: string
): Promise<boolean> {
  try {
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      console.warn('⚠️ BOT_TOKEN not configured, skipping Telegram group notification')
      return false
    }

    const groupChatId = chatId || process.env.GROUP_CHAT_ID
    if (!groupChatId) {
      console.warn('⚠️ GROUP_CHAT_ID not configured, skipping Telegram group notification')
      return false
    }

    const sendMessageUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: groupChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Failed to send Telegram group notification:', errorData)
      return false
    }

    const data = await response.json()
    if (data.ok) {
      console.log(`✅ Telegram group notification sent to ${groupChatId}`)
      return true
    }

    return false
  } catch (error) {
    console.error('❌ Error sending Telegram group notification:', error)
    return false
  }
}

