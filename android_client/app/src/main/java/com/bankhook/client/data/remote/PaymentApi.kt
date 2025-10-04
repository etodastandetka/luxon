package com.bankhook.client.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface PaymentApi {
    @POST("/bot_control/api/payment-hook/")
    suspend fun send(@Body body: PaymentRequest): Response<PaymentResponse>
}
