package com.req.notificationreader.model

data class Transaction(
    val id: String,
    val user_id: String,
    val account_id: String,
    val user_display_name: String,
    val type: String,
    val amount: Double,
    val status: String,
    val status_detail: String?,
    val bookmaker: String?,
    val bank: String?,
    val created_at: String
)
