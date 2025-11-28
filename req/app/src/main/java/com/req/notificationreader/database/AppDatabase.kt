package com.req.notificationreader.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.req.notificationreader.model.AppLog
import com.req.notificationreader.model.NotificationHistory
import com.req.notificationreader.model.PaymentNotification

@Database(entities = [PaymentNotification::class, AppLog::class, NotificationHistory::class], version = 3, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun paymentDao(): PaymentDao
    abstract fun logDao(): LogDao
    abstract fun notificationHistoryDao(): NotificationHistoryDao
    
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "payment_database"
                )
                    .fallbackToDestructiveMigration() // Разрешаем пересоздание при миграции
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}

