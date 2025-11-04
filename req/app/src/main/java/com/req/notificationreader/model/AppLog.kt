package com.req.notificationreader.model

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Модель лога для хранения всех действий и ошибок в приложении
 */
@Entity(tableName = "app_logs")
data class AppLog(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val timestamp: Long = System.currentTimeMillis(),
    val level: LogLevel, // INFO, WARNING, ERROR, SUCCESS
    val category: String, // "payment", "database", "notification", "parsing"
    val message: String,
    val details: String? = null, // Дополнительные детали (stack trace, данные и т.д.)
    val tag: String? = null // Тег для фильтрации
) {
    enum class LogLevel {
        INFO,
        WARNING,
        ERROR,
        SUCCESS
    }
}

