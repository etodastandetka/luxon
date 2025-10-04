package com.bankhook.client.data.remote

import android.content.SharedPreferences
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val prefs: SharedPreferences): Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = prefs.getString("apiToken", "") ?: ""
        val reqB = chain.request().newBuilder()
        if (token.isNotBlank()) {
            reqB.addHeader("Authorization", "Bearer $token")
        }
        reqB.addHeader("Content-Type", "application/json")
        return chain.proceed(reqB.build())
    }
}
