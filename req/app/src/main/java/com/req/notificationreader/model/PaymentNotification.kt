package com.req.notificationreader.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Date

@Entity(tableName = "payment_notifications")
data class PaymentNotification(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val bankName: String,
    val packageName: String, // Для клонированных приложений
    val amount: Double,
    val currency: String = "KGS", // Сом по умолчанию
    val cardNumber: String?,
    val accountNumber: String?,
    val transactionDate: Long = System.currentTimeMillis(),
    val rawText: String, // Исходный текст уведомления
    val parsedAt: Long = System.currentTimeMillis()
)
