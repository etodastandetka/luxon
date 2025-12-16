package com.req.notificationreader.model

data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: String? = null,
    val message: String? = null
)

data class RequestsResponse(
    val requests: List<Request>,
    val pagination: Pagination?
)

data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)

data class LoginResponse(
    val user: AdminUser,
    val message: String
)

