package com.req.notificationreader.util

import android.content.Context
import android.content.SharedPreferences

class SharedPreferencesHelper(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("LUXON_PREFS", Context.MODE_PRIVATE)
    
    fun saveAuthToken(token: String) {
        prefs.edit().putString("auth_token", token).apply()
    }
    
    fun getAuthToken(): String? {
        return prefs.getString("auth_token", null)
    }
    
    fun clearAuthToken() {
        prefs.edit().remove("auth_token").apply()
    }
    
    fun saveBaseUrl(url: String) {
        prefs.edit().putString("base_url", url).apply()
    }
    
    fun getBaseUrl(): String {
        return prefs.getString("base_url", "http://localhost:3001") ?: "http://localhost:3001"
    }
}

