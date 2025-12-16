package com.req.notificationreader.model

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Модель для хранения истории всех уведомлений (не только платежи)
 */
@Entity(tableName = "notification_history")
data class NotificationHistory(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val packageName: String, // Package name приложения-источника
    val appName: String?, // Название приложения (может быть null)
    val title: String?, // Заголовок уведомления
    val text: String, // Текст уведомления
    val timestamp: Long = System.currentTimeMillis(), // Время получения
    val isProcessed: Boolean = false // Было ли обработано как платеж
)

