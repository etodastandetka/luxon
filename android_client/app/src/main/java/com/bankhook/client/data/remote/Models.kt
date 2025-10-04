package com.bankhook.client.data.remote

data class PaymentRequest(
    val amount: Double,
    val bank: String,
    val timestamp: String,
    val raw_message: String
)

data class PaymentResponse(
    val status: String?,
    val id: Long?
)
