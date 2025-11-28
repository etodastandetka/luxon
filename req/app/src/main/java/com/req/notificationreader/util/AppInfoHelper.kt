package com.req.notificationreader.util

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable

/**
 * Утилита для получения информации о приложениях
 */
object AppInfoHelper {
    
    /**
     * Получает название приложения по package name
     */
    fun getAppName(context: Context, packageName: String): String? {
        return try {
            if (packageName.isBlank()) {
                return null
            }
            val packageManager = context.packageManager
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            val appName = packageManager.getApplicationLabel(applicationInfo).toString()
            appName.ifBlank { null }
        } catch (e: PackageManager.NameNotFoundException) {
            null
        } catch (e: Exception) {
            android.util.Log.w("AppInfoHelper", "Ошибка получения названия приложения для $packageName", e)
            null
        }
    }
    
    /**
     * Получает иконку приложения по package name
     */
    fun getAppIcon(context: Context, packageName: String): Drawable? {
        return try {
            if (packageName.isBlank()) {
                return null
            }
            val packageManager = context.packageManager
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationIcon(applicationInfo)
        } catch (e: PackageManager.NameNotFoundException) {
            null
        } catch (e: Exception) {
            android.util.Log.w("AppInfoHelper", "Ошибка получения иконки приложения для $packageName", e)
            null
        }
    }
    
    /**
     * Получает информацию о приложении
     */
    data class AppInfo(
        val packageName: String,
        val name: String?,
        val icon: Drawable?
    )
    
    fun getAppInfo(context: Context, packageName: String): AppInfo {
        return AppInfo(
            packageName = packageName,
            name = getAppName(context, packageName),
            icon = getAppIcon(context, packageName)
        )
    }
}

