package com.req.notificationreader.model

data class Wallet(
    val id: Int,
    val name: String?,
    val value: String,
    val email: String?,
    val password: String?,
    val isActive: Boolean
)
