package com.req.notificationreader.api

import com.req.notificationreader.model.PaymentNotification
import com.req.notificationreader.util.AppLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.util.TimeZone

class PostgresApiClient(
    private val baseUrl: String,
    private val jwtSecret: String? = null
) {
    
    /**
     * Отправляет данные о пополнении в админку Next.js
     * Формат: { amount, bank, paymentDate, notificationText }
     */
    suspend fun sendPaymentToAdmin(payment: PaymentNotification, adminBaseUrl: String): Result<Boolean> = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            // Нормализуем URL: убираем завершающий слэш если есть
            val normalizedUrl = adminBaseUrl.trimEnd('/')
            val endpoint = "$normalizedUrl/api/incoming-payment"
            
            AppLogger.info("admin", "Отправка в админку: $endpoint", null, "PostgresApiClient")
            android.util.Log.d("PostgresApiClient", "Отправка в админку: $endpoint")
            
            val url = URL(endpoint)
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.doOutput = true
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            
            // Формируем JSON для админки (формат /api/incoming-payment)
            val json = JSONObject().apply {
                put("amount", payment.amount)
                put("bank", payment.bankName?.uppercase() ?: "UNKNOWN")
                put("paymentDate", formatDateISO(payment.transactionDate))
                put("notificationText", payment.rawText ?: "")
            }
            
            connection.outputStream.use { 
                it.write(json.toString().toByteArray(Charsets.UTF_8))
            }
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                android.util.Log.d("PostgresApiClient", "✅ Платеж успешно отправлен в админку: ${payment.bankName} - ${payment.amount} ${payment.currency}")
                AppLogger.success("admin", "Платеж успешно отправлен в админку: ${payment.bankName} - ${payment.amount} ${payment.currency}", 
                    "Response: $response", "PostgresApiClient")
                Result.success(true)
            } else {
                val errorMsg = "HTTP $responseCode: $response"
                android.util.Log.e("PostgresApiClient", "Ошибка отправки в админку. Код: $responseCode, Ответ: $response")
                AppLogger.error("admin", "Ошибка отправки в админку: HTTP $responseCode", response, "PostgresApiClient")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            android.util.Log.e("PostgresApiClient", "Ошибка при отправке в админку", e)
            AppLogger.error("admin", "Исключение при отправке в админку: ${e.javaClass.simpleName} - ${e.message}", 
                e.stackTraceToString(), "PostgresApiClient")
            Result.failure(e)
        } finally {
            try {
                connection?.disconnect()
            } catch (e: Exception) {
                // Игнорируем ошибки закрытия
            }
        }
    }
    
    /**
     * Отправляет данные о пополнении в PostgreSQL базу данных
     * База: postgresql://gen_user:dastan10dz@89.23.117.61:5432/default_db
     */
    suspend fun sendPaymentToPostgres(payment: PaymentNotification): Result<Boolean> = withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            // Формируем URL для API endpoint
            // Если baseUrl содержит путь к PHP скрипту, используем его напрямую
            // Иначе добавляем стандартный путь /api/payments
            val endpoint = if (baseUrl.contains(".php")) {
                baseUrl
            } else {
                "$baseUrl/api/payments"
            }
            
            AppLogger.info("database", "Попытка подключения к API: $endpoint", null, "PostgresApiClient")
            android.util.Log.d("PostgresApiClient", "Подключение к: $endpoint")
            
            val url = URL(endpoint)
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            
            // Добавляем JWT секрет в заголовок если есть
            if (jwtSecret != null) {
                connection.setRequestProperty("Authorization", "Bearer $jwtSecret")
            }
            
            connection.doOutput = true
            connection.connectTimeout = 15000  // Увеличили до 15 секунд
            connection.readTimeout = 15000
            
            // Формируем JSON для отправки (соответствует структуре таблицы payment_notifications)
            val json = JSONObject().apply {
                put("bank_name", payment.bankName ?: "Unknown")
                put("package_name", payment.packageName ?: "")
                put("amount", payment.amount)
                put("currency", payment.currency ?: "KGS")
                // Для NULL значений отправляем null, а не пустую строку
                if (payment.cardNumber.isNullOrBlank()) {
                    put("card_number", JSONObject.NULL)
                } else {
                    put("card_number", payment.cardNumber)
                }
                if (payment.accountNumber.isNullOrBlank()) {
                    put("account_number", JSONObject.NULL)
                } else {
                    put("account_number", payment.accountNumber)
                }
                put("transaction_date", formatDate(payment.transactionDate))
                put("raw_text", payment.rawText ?: "")
                put("parsed_at", formatDate(payment.parsedAt))
            }
            
            // Отправляем данные
            AppLogger.info("database", "Отправка данных платежа: ${payment.bankName} - ${payment.amount} ${payment.currency}", 
                "JSON: ${json.toString().take(200)}...", "PostgresApiClient")
            
            connection.outputStream.use { 
                it.write(json.toString().toByteArray(Charsets.UTF_8))
            }
            
            AppLogger.info("database", "Данные отправлены, ожидание ответа...", null, "PostgresApiClient")
            
            val responseCode = connection.responseCode
            val response = if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            } else {
                connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: "{}"
            }
            
            connection.disconnect()
            
            if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                android.util.Log.d("PostgresApiClient", "Платеж успешно отправлен в PostgreSQL: ${payment.bankName} - ${payment.amount} ${payment.currency}")
                AppLogger.success("database", "Платеж успешно отправлен в PostgreSQL через HTTP API: ${payment.bankName} - ${payment.amount} ${payment.currency}", 
                    "Response: $response", "PostgresApiClient")
                Result.success(true)
            } else {
                val errorMsg = "HTTP $responseCode: $response"
                android.util.Log.e("PostgresApiClient", "Ошибка отправки платежа. Код: $responseCode, Ответ: $response")
                AppLogger.error("database", "Ошибка отправки платежа в PostgreSQL: HTTP $responseCode", response, "PostgresApiClient")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: java.net.SocketTimeoutException) {
            val errorMsg = "Таймаут подключения к серверу (проверьте доступность $baseUrl)"
            android.util.Log.e("PostgresApiClient", errorMsg, e)
            AppLogger.error("database", errorMsg, 
                "Возможные причины:\n- PHP скрипт не загружен на сервер\n- Сервер недоступен\n- Firewall блокирует подключение\n- Неправильный URL", 
                "PostgresApiClient")
            Result.failure(Exception(errorMsg, e))
        } catch (e: java.net.ConnectException) {
            val errorMsg = "Не удалось подключиться к серверу $baseUrl"
            android.util.Log.e("PostgresApiClient", errorMsg, e)
            AppLogger.error("database", errorMsg, 
                "Возможные причины:\n- Сервер недоступен ($baseUrl)\n- PHP скрипт не размещен по указанному пути\n- Порт 80 закрыт на сервере\n- Неправильный IP адрес или домен\n\nПроверьте:\n1. Загружен ли api.php на сервер?\n2. Доступен ли путь http://89.23.117.61/api/payments.php из браузера?\n3. Работает ли веб-сервер на порту 80?", 
                "PostgresApiClient")
            Result.failure(Exception(errorMsg, e))
        } catch (e: java.net.UnknownHostException) {
            val errorMsg = "Хост не найден: $baseUrl"
            android.util.Log.e("PostgresApiClient", errorMsg, e)
            AppLogger.error("database", errorMsg, 
                "Не удается разрешить доменное имя или IP адрес. Проверьте правильность URL в DatabaseConfig.API_BASE_URL", 
                "PostgresApiClient")
            Result.failure(Exception(errorMsg, e))
        } catch (e: Exception) {
            android.util.Log.e("PostgresApiClient", "Ошибка при отправке платежа в PostgreSQL", e)
            AppLogger.error("database", "Исключение при отправке платежа в PostgreSQL: ${e.javaClass.simpleName} - ${e.message}", 
                e.stackTraceToString(), "PostgresApiClient")
            Result.failure(e)
        } finally {
            // Закрываем соединение если оно было открыто
            try {
                connection?.disconnect()
            } catch (e: Exception) {
                // Игнорируем ошибки закрытия
            }
        }
    }
    
    /**
     * Форматирует timestamp в формат ISO 8601 для PostgreSQL TIMESTAMP
     * PostgreSQL принимает формат: 'YYYY-MM-DD HH:MM:SS' или 'YYYY-MM-DD HH:MM:SS.fff'
     */
    private fun formatDate(timestamp: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
        // Используем локальное время, т.к. PostgreSQL TIMESTAMP без timezone
        return sdf.format(Date(timestamp))
    }
    
    /**
     * Форматирует timestamp в формат ISO 8601 для API админки
     * Формат: 'YYYY-MM-DDTHH:MM:SS.SSSZ'
     */
    private fun formatDateISO(timestamp: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(timestamp))
    }
}

