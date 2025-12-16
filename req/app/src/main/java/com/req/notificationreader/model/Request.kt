package com.req.notificationreader.model

data class Request(
    val id: Int,
    val userId: String, // BigInt в БД, но строка в API
    val username: String?,
    val firstName: String?,
    val lastName: String?,
    val bookmaker: String?,
    val accountId: String?,
    val amount: String?, // Decimal в БД, но строка в API
    val requestType: String, // deposit/withdraw
    val status: String,
    val status_detail: String?,
    val withdrawalCode: String?,
    val photoFileId: String?,
    val photoFileUrl: String?,
    val bank: String?,
    val phone: String?,
    val createdAt: String,
    val updatedAt: String?,
    val processedAt: String?
)
