package com.req.notificationreader

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import com.req.notificationreader.api.PostgresApiClient
import com.req.notificationreader.database.AppDatabase
import com.req.notificationreader.model.NotificationHistory
import com.req.notificationreader.parser.ParserManager
import com.req.notificationreader.util.AppInfoHelper
import com.req.notificationreader.util.AppLogger
import com.req.notificationreader.util.DatabaseConfig
import com.req.notificationreader.util.SharedPreferencesHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NotificationReaderService : NotificationListenerService() {
    
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var database: AppDatabase
    private lateinit var prefsHelper: SharedPreferencesHelper
    private val parserManager = ParserManager.getInstance()
    private val postgresApiClient = PostgresApiClient(
        baseUrl = DatabaseConfig.API_BASE_URL,
        jwtSecret = DatabaseConfig.JWT_SECRET
    )
    private var stateChangeReceiver: BroadcastReceiver? = null
    
    companion object {
        private const val TAG = "NotificationReader"
        private const val NOTIFICATION_CHANNEL_ID = "LUXON_SERVICE_CHANNEL"
        private const val NOTIFICATION_ID = 1
        const val ACTION_SERVICE_STATE_CHANGED = "com.req.notificationreader.SERVICE_STATE_CHANGED"
    }
    
    override fun onCreate() {
        super.onCreate()
        try {
            database = AppDatabase.getDatabase(applicationContext)
            prefsHelper = SharedPreferencesHelper(applicationContext)
            // Передаем контекст в парсер для получения названий приложений
            parserManager.setContext(applicationContext)
            // Инициализируем логгер
            AppLogger.initialize(applicationContext)
            
            // Создаем канал уведомлений для foreground service
            createNotificationChannel()
            
            // Запускаем как foreground service для работы в фоне
            startForegroundService()
            
            // Регистрируем receiver для обновления состояния
            registerStateChangeReceiver()
            
            AppLogger.info("notification", "NotificationReaderService создан и готов к работе", tag = TAG)
            Log.d(TAG, "NotificationReaderService создан")
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка инициализации базы данных в сервисе", e)
            AppLogger.error("notification", "Ошибка инициализации сервиса: ${e.message}", e.stackTraceToString(), TAG)
        }
    }
    
    private fun registerStateChangeReceiver() {
        stateChangeReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == ACTION_SERVICE_STATE_CHANGED) {
                    Log.d(TAG, "Получено обновление состояния сервиса")
                    updateForegroundNotification()
                }
            }
        }
        val filter = IntentFilter(ACTION_SERVICE_STATE_CHANGED)
        registerReceiver(stateChangeReceiver, filter)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stateChangeReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (e: Exception) {
                Log.e(TAG, "Ошибка при отмене регистрации receiver", e)
            }
        }
        Log.d(TAG, "NotificationReaderService уничтожен")
    }
    
    private fun createNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "LUXON Отслеживание",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Сервис отслеживания уведомлений о пополнениях"
                    setShowBadge(false)
                }
                val notificationManager = getSystemService(NotificationManager::class.java)
                notificationManager?.createNotificationChannel(channel)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка создания канала уведомлений", e)
        }
    }
    
    private fun startForegroundService() {
        try {
            val notificationIntent = Intent(this, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            
            val isEnabled = if (::prefsHelper.isInitialized) {
                prefsHelper.isServiceEnabled()
            } else {
                true // По умолчанию включено
            }
            val statusText = if (isEnabled) "Включено" else "Отключено"
            
            val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle("LUXON")
                .setContentText("Отслеживание: $statusText")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build()
            
            startForeground(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка запуска foreground service", e)
        }
    }
    
    private fun updateForegroundNotification() {
        try {
            if (!::prefsHelper.isInitialized) {
                return // Не обновляем, если prefsHelper не инициализирован
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java) as? NotificationManager
            if (notificationManager == null) {
                Log.w(TAG, "NotificationManager недоступен")
                return
            }
            
            val isEnabled = prefsHelper.isServiceEnabled()
            val statusText = if (isEnabled) "Включено" else "Отключено"
            
            val notificationIntent = Intent(this, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            
            val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setContentTitle("LUXON")
                .setContentText("Отслеживание: $statusText")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build()
            
            notificationManager.notify(NOTIFICATION_ID, notification)
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка обновления уведомления", e)
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
        val fullText = bigText ?: text ?: ""
        
        Log.d(TAG, "Получено уведомление от: $packageName")
        Log.d(TAG, "Заголовок: $title")
        Log.d(TAG, "Текст: $fullText")
        
        // Сохраняем ВСЕ уведомления в историю (даже если приложение отключено)
        // Это позволяет видеть все уведомления и управлять приложениями
        serviceScope.launch {
            try {
                if (::database.isInitialized) {
                    val appName = AppInfoHelper.getAppName(applicationContext, packageName)
                    val notificationHistory = NotificationHistory(
                        packageName = packageName,
                        appName = appName,
                        title = title,
                        text = fullText,
                        timestamp = System.currentTimeMillis(),
                        isProcessed = false
                    )
                    database.notificationHistoryDao().insertNotification(notificationHistory)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Ошибка при сохранении истории уведомления", e)
            }
        }
        
        // Проверяем, включен ли сервис (с проверкой инициализации)
        if (!::prefsHelper.isInitialized) {
            Log.w(TAG, "prefsHelper не инициализирован, уведомление будет обработано")
        } else {
            val isServiceEnabled = prefsHelper.isServiceEnabled()
            if (!isServiceEnabled) {
                Log.d(TAG, "Сервис отключен, уведомление игнорируется")
                try {
                    AppLogger.notification("Сервис отключен, уведомление от $packageName не обрабатывается", 
                        "Заголовок: $title\nТекст: $fullText")
                } catch (e: Exception) {
                    Log.e(TAG, "Ошибка логирования", e)
                }
                return
            }
        }
        
        // Проверяем, не отключено ли это приложение
        val isAppDisabled = if (::prefsHelper.isInitialized) {
            prefsHelper.isAppDisabled(packageName)
        } else {
            false // По умолчанию не отключено, если prefsHelper не готов
        }
        if (isAppDisabled) {
            Log.d(TAG, "Приложение $packageName отключено, уведомление игнорируется")
            try {
                AppLogger.notification("Приложение отключено, уведомление от $packageName не обрабатывается", 
                    "Заголовок: $title\nТекст: $fullText")
            } catch (e: Exception) {
                Log.e(TAG, "Ошибка логирования", e)
            }
            
            // Обновляем историю, что это уведомление было проигнорировано
            serviceScope.launch {
                try {
                    if (::database.isInitialized) {
                        val latest = database.notificationHistoryDao().getLatestNotificationByPackage(packageName)
                        if (latest != null) {
                            // Можно обновить запись, но для простоты просто оставляем как есть
                            // isProcessed останется false, что означает, что оно не было обработано
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Ошибка при обновлении истории", e)
                }
            }
            return
        }
        
        try {
            AppLogger.notification("Получено уведомление от: $packageName", "Заголовок: $title\nТекст: $fullText")
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка логирования", e)
        }
        
        // Парсим уведомление в фоновом потоке
        // Используем SupervisorJob чтобы ошибка в одной корутине не убила остальные
        serviceScope.launch {
            try {
                val payment = parserManager.parseNotification(
                    packageName = packageName,
                    title = title,
                    text = fullText
                )
                
                // Обновляем историю, что это уведомление было обработано
                if (::database.isInitialized) {
                    try {
                        val latest = database.notificationHistoryDao().getLatestNotificationByPackage(packageName)
                        if (latest != null) {
                            // Обновляем флаг обработки в истории
                            val updatedHistory = latest.copy(isProcessed = payment != null)
                            database.notificationHistoryDao().insertNotification(updatedHistory)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Ошибка при обновлении флага обработки в истории", e)
                    }
                }
                
                if (payment != null) {
                    // Дополнительная проверка на случай, если состояние изменилось во время обработки
                    if (::prefsHelper.isInitialized) {
                        if (!prefsHelper.isServiceEnabled() || prefsHelper.isAppDisabled(packageName)) {
                            Log.d(TAG, "Сервис или приложение было отключено во время обработки, платеж не сохраняется")
                            return@launch
                        }
                    }
                    
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
                    
                    // Отправка в админку Next.js (только если сервис включен и приложение не отключено)
                    if (::prefsHelper.isInitialized && 
                        prefsHelper.isServiceEnabled() && 
                        !prefsHelper.isAppDisabled(packageName)) {
                        try {
                            val adminApiUrl = prefsHelper.getAdminApiUrl()
                            AppLogger.info("admin", "Попытка отправки в админку ($adminApiUrl): ${payment.bankName} - ${payment.amount} ${payment.currency}")
                            val adminResult = postgresApiClient.sendPaymentToAdmin(payment, adminApiUrl)
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
                    } else {
                        Log.d(TAG, "Сервис отключен или приложение в черном списке, отправка в админку пропущена")
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
    
    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "NotificationListenerService подключен")
        AppLogger.info("notification", "NotificationListenerService подключен", tag = TAG)
        updateForegroundNotification()
    }
    
    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.d(TAG, "NotificationListenerService отключен")
        AppLogger.info("notification", "NotificationListenerService отключен", tag = TAG)
    }
}

