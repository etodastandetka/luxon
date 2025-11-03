package com.req.notificationreader

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.req.notificationreader.api.PostgresApiClient
import com.req.notificationreader.database.AppDatabase
import com.req.notificationreader.parser.ParserManager
import com.req.notificationreader.util.AppLogger
import com.req.notificationreader.util.DatabaseConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NotificationReaderService : NotificationListenerService() {
    
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var database: AppDatabase
    private val parserManager = ParserManager.getInstance()
    private val postgresApiClient = PostgresApiClient(
        baseUrl = DatabaseConfig.API_BASE_URL,
        jwtSecret = DatabaseConfig.JWT_SECRET
    )
    
    override fun onCreate() {
        super.onCreate()
        try {
            database = AppDatabase.getDatabase(applicationContext)
            // Передаем контекст в парсер для получения названий приложений
            parserManager.setContext(applicationContext)
            // Инициализируем логгер
            AppLogger.initialize(applicationContext)
            AppLogger.info("notification", "NotificationReaderService создан и готов к работе", tag = TAG)
            Log.d(TAG, "NotificationReaderService создан")
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка инициализации базы данных в сервисе", e)
            AppLogger.error("notification", "Ошибка инициализации сервиса: ${e.message}", e.stackTraceToString(), TAG)
        }
    }
    
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        
        if (sbn == null) return
        
        val packageName = sbn.packageName ?: return
        val notification = sbn.notification ?: return
        
        // Извлекаем текст уведомления
        val title = notification.extras?.getCharSequence("android.title")?.toString()
        val text = notification.extras?.getCharSequence("android.text")?.toString()
        
        // Проверяем большой текст (для длинных уведомлений)
        val bigText = notification.extras?.getCharSequence("android.bigText")?.toString()
        val fullText = bigText ?: text
        
        Log.d(TAG, "Получено уведомление от: $packageName")
        Log.d(TAG, "Заголовок: $title")
        Log.d(TAG, "Текст: $fullText")
        
        AppLogger.notification("Получено уведомление от: $packageName", "Заголовок: $title\nТекст: $fullText")
        
        // Парсим уведомление в фоновом потоке
        // Используем SupervisorJob чтобы ошибка в одной корутине не убила остальные
        serviceScope.launch {
            try {
                val payment = parserManager.parseNotification(
                    packageName = packageName,
                    title = title,
                    text = fullText
                )
                
                if (payment != null) {
                    // Сохраняем в локальную базу данных (Room)
                    try {
                        if (::database.isInitialized) {
                            database.paymentDao().insertPayment(payment)
                            val currencyText = when (payment.currency) {
                                "KGS" -> "сом"
                                "USD" -> "$"
                                "EUR" -> "€"
                                "RUB" -> "₽"
                                else -> payment.currency
                            }
                            Log.d(TAG, "Пополнение сохранено локально: ${payment.bankName} - ${payment.amount} $currencyText")
                            AppLogger.payment("Пополнение от ${payment.bankName}: ${payment.amount} $currencyText", 
                                "Карта: ${payment.cardNumber ?: "N/A"}, Счет: ${payment.accountNumber ?: "N/A"}")
                        } else {
                            Log.w(TAG, "База данных не инициализирована, попытка инициализации")
                            database = AppDatabase.getDatabase(applicationContext)
                            database.paymentDao().insertPayment(payment)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Ошибка при сохранении платежа в локальную БД", e)
                        AppLogger.error("database", "Ошибка сохранения платежа в локальную БД: ${e.message}", 
                            e.stackTraceToString(), TAG)
                    }
                    
                    // Отправка в админку Next.js
                    try {
                        AppLogger.info("admin", "Попытка отправки в админку: ${payment.bankName} - ${payment.amount} ${payment.currency}")
                        val adminResult = postgresApiClient.sendPaymentToAdmin(payment, DatabaseConfig.ADMIN_API_BASE_URL)
                        if (adminResult.isSuccess) {
                            Log.d(TAG, "✅ Пополнение успешно отправлено в админку: ${payment.bankName}")
                            AppLogger.success("admin", "Пополнение успешно отправлено в админку: ${payment.bankName} - ${payment.amount} ${payment.currency}")
                        } else {
                            val error = adminResult.exceptionOrNull()
                            val errorMsg = error?.message ?: "Unknown error"
                            Log.w(TAG, "⚠️ Не удалось отправить в админку: $errorMsg")
                            val stackTrace = error?.let { 
                                it.stackTrace?.joinToString("\n") ?: "Нет stack trace"
                            } ?: "Ошибка без stack trace"
                            AppLogger.warning("admin", "Не удалось отправить в админку: $errorMsg", stackTrace)
                        }
                    } catch (e: Throwable) {
                        Log.e(TAG, "❌ КРИТИЧЕСКАЯ ошибка при отправке в админку (приложение продолжит работу)", e)
                        AppLogger.error("admin", "КРИТИЧЕСКАЯ ошибка при отправке в админку: ${e.message}", 
                            e.stackTraceToString(), TAG)
                    }
                }
            } catch (e: Throwable) {
                // Перехватываем ВСЕ исключения включая Error (OutOfMemoryError и т.д.)
                Log.e(TAG, "Ошибка при обработке уведомления (приложение продолжит работу)", e)
                AppLogger.error("parsing", "Ошибка при обработке уведомления: ${e.message}", 
                    e.stackTraceToString(), TAG)
                // НЕ пробрасываем исключение - приложение не должно крашиться
            }
        }
    }
    
    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
        // Можно обрабатывать удаление уведомлений если нужно
    }
    
    companion object {
        private const val TAG = "NotificationReader"
    }
}

