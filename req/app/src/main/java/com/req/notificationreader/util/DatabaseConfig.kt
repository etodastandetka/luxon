package com.req.notificationreader.util

/**
 * Конфигурация для подключения к PostgreSQL базе данных
 * Данные из переменных окружения:
 * DATABASE_URL: postgresql://gen_user:dastan10dz@89.23.117.61:5432/default_db
 */
object DatabaseConfig {
    // Данные из DATABASE_URL
    const val DB_HOST = "89.23.117.61"
    const val DB_PORT = 5432
    const val DB_NAME = "default_db"
    const val DB_USER = "gen_user"
    const val DB_PASSWORD = "dastan10dz"

    // JWT Secret (если используется для API)
    const val JWT_SECRET = "your-secret-key-change-in-production-2025"

    // Базовый URL для API endpoint (старый - опционально)
    // Если используешь PHP скрипт: "http://89.23.117.61/api/payments.php"
    // Если используешь другой сервер - измени URL здесь
    const val API_BASE_URL = "http://89.23.117.61/api/payments.php"
    
    // Базовый URL для админки Next.js (новый основной endpoint)
    // ВАЖНО: Этот URL используется только как значение по умолчанию!
    // Реальный URL можно настроить через SharedPreferencesHelper.saveAdminApiUrl()
    // Замени на реальный домен админки, например: "https://japar.click" или "http://your-server.com"
    // НЕ используйте localhost - он не будет работать с реального устройства!
    const val ADMIN_API_BASE_URL = "https://japar.click" // Значение по умолчанию

    // Полный URL подключения
    val DATABASE_URL = "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
}

