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
    
    fun saveAdminApiUrl(url: String) {
        prefs.edit().putString("admin_api_url", url).apply()
    }
    
    fun getAdminApiUrl(): String {
        // Используем значение из SharedPreferences, если есть, иначе из DatabaseConfig
        return prefs.getString("admin_api_url", null) 
            ?: com.req.notificationreader.util.DatabaseConfig.ADMIN_API_BASE_URL
    }
    
    fun setServiceEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("service_enabled", enabled).apply()
    }
    
    fun isServiceEnabled(): Boolean {
        return prefs.getBoolean("service_enabled", true) // По умолчанию включено
    }
    
    /**
     * Сохраняет список отключенных приложений (package names)
     */
    fun setDisabledApps(packageNames: Set<String>) {
        prefs.edit().putStringSet("disabled_apps", packageNames).apply()
    }
    
    /**
     * Получает список отключенных приложений
     */
    fun getDisabledApps(): Set<String> {
        return prefs.getStringSet("disabled_apps", emptySet()) ?: emptySet()
    }
    
    /**
     * Добавляет приложение в список отключенных
     */
    fun disableApp(packageName: String) {
        try {
            if (packageName.isBlank()) {
                android.util.Log.w("SharedPreferencesHelper", "Попытка отключить приложение с пустым package name")
                return
            }
            val disabled = getDisabledApps().toMutableSet()
            disabled.add(packageName)
            setDisabledApps(disabled)
        } catch (e: Exception) {
            android.util.Log.e("SharedPreferencesHelper", "Ошибка при отключении приложения $packageName", e)
        }
    }
    
    /**
     * Удаляет приложение из списка отключенных
     */
    fun enableApp(packageName: String) {
        try {
            if (packageName.isBlank()) {
                android.util.Log.w("SharedPreferencesHelper", "Попытка включить приложение с пустым package name")
                return
            }
            val disabled = getDisabledApps().toMutableSet()
            disabled.remove(packageName)
            setDisabledApps(disabled)
        } catch (e: Exception) {
            android.util.Log.e("SharedPreferencesHelper", "Ошибка при включении приложения $packageName", e)
        }
    }
    
    /**
     * Проверяет, отключено ли приложение
     */
    fun isAppDisabled(packageName: String): Boolean {
        return try {
            if (packageName.isBlank()) {
                false
            } else {
                getDisabledApps().contains(packageName)
            }
        } catch (e: Exception) {
            android.util.Log.e("SharedPreferencesHelper", "Ошибка при проверке статуса приложения $packageName", e)
            false
        }
    }
}

