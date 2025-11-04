package com.req.notificationreader.model

data class AdminUser(
    val id: Int,
    val username: String,
    val email: String?,
    val isActive: Boolean,
    val isSuperAdmin: Boolean
)

