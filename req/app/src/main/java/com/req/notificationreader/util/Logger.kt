package com.req.notificationreader.util

import android.content.Context
import android.util.Log
import com.req.notificationreader.database.AppDatabase
import com.req.notificationreader.model.AppLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Централизованная система логирования
 * Сохраняет логи в базу данных и выводит в Android Log
 */
object AppLogger {
    
    private var database: AppDatabase? = null
    private val loggerScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private const val MAX_LOGS_IN_DB = 5000 // Максимальное количество логов в БД
    
    fun initialize(context: Context) {
        database = AppDatabase.getDatabase(context)
        // Очищаем старые логи при старте (оставляем последние 5000)
        loggerScope.launch {
            try {
                val logDao = database?.logDao() ?: return@launch
                val totalLogs = logDao.getLogCount()
                if (totalLogs > MAX_LOGS_IN_DB) {
                    val logsToKeep = logDao.getRecentLogs(MAX_LOGS_IN_DB)
                    var oldestTimestamp = Long.MAX_VALUE
                    logsToKeep.collect { logs ->
                        if (logs.isNotEmpty()) {
                            oldestTimestamp = logs.last().timestamp
                            logDao.deleteOldLogs(oldestTimestamp)
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("AppLogger", "Ошибка очистки старых логов", e)
            }
        }
    }
    
    private fun log(
        level: AppLog.LogLevel,
        category: String,
        message: String,
        details: String? = null,
        tag: String? = null
    ) {
        // Выводим в Android Log
        val logMessage = "[$category] $message"
        when (level) {
            AppLog.LogLevel.INFO -> Log.i(tag ?: "AppLogger", logMessage)
            AppLog.LogLevel.WARNING -> Log.w(tag ?: "AppLogger", logMessage)
            AppLog.LogLevel.ERROR -> Log.e(tag ?: "AppLogger", logMessage, details?.let { Exception(it) })
            AppLog.LogLevel.SUCCESS -> Log.i(tag ?: "AppLogger", "✅ $logMessage")
        }
        
        // Сохраняем в базу данных
        loggerScope.launch {
            try {
                val logDao = database?.logDao() ?: return@launch
                val appLog = AppLog(
                    level = level,
                    category = category,
                    message = message,
                    details = details,
                    tag = tag
                )
                logDao.insertLog(appLog)
            } catch (e: Exception) {
                // Если не удалось сохранить в БД, просто логируем
                Log.e("AppLogger", "Не удалось сохранить лог в БД", e)
            }
        }
    }
    
    fun info(category: String, message: String, details: String? = null, tag: String? = null) {
        log(AppLog.LogLevel.INFO, category, message, details, tag)
    }
    
    fun warning(category: String, message: String, details: String? = null, tag: String? = null) {
        log(AppLog.LogLevel.WARNING, category, message, details, tag)
    }
    
    fun error(category: String, message: String, details: String? = null, tag: String? = null) {
        log(AppLog.LogLevel.ERROR, category, message, details, tag)
    }
    
    fun success(category: String, message: String, details: String? = null, tag: String? = null) {
        log(AppLog.LogLevel.SUCCESS, category, message, details, tag)
    }
    
    fun payment(message: String, details: String? = null) {
        success("payment", message, details, "Payment")
    }
    
    fun database(message: String, details: String? = null) {
        info("database", message, details, "Database")
    }
    
    fun notification(message: String, details: String? = null) {
        info("notification", message, details, "Notification")
    }
    
    fun parsing(message: String, details: String? = null) {
        info("parsing", message, details, "Parsing")
    }
}

