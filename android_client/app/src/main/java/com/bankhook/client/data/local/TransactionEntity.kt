package com.bankhook.client.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val amount: Double,
    val bank: String,
    val timestampIso: String,
    val rawMessage: String,
    val status: String,          // pending | sent | error
    val lastError: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)
