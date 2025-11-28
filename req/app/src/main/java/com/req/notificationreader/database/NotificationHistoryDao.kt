package com.req.notificationreader.database

import androidx.room.*
import com.req.notificationreader.model.NotificationHistory
import kotlinx.coroutines.flow.Flow

@Dao
interface NotificationHistoryDao {
    
    @Query("SELECT * FROM notification_history ORDER BY timestamp DESC")
    fun getAllNotifications(): Flow<List<NotificationHistory>>
    
    @Query("SELECT * FROM notification_history WHERE packageName = :packageName ORDER BY timestamp DESC")
    fun getNotificationsByPackage(packageName: String): Flow<List<NotificationHistory>>
    
    @Query("SELECT DISTINCT packageName FROM notification_history ORDER BY packageName")
    fun getDistinctPackages(): Flow<List<String>>
    
    @Query("SELECT * FROM notification_history ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentNotifications(limit: Int = 100): Flow<List<NotificationHistory>>
    
    @Query("SELECT * FROM notification_history WHERE packageName = :packageName ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLatestNotificationByPackage(packageName: String): NotificationHistory?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotification(notification: NotificationHistory): Long
    
    @Query("DELETE FROM notification_history WHERE timestamp < :beforeTimestamp")
    suspend fun deleteOldNotifications(beforeTimestamp: Long)
    
    @Query("DELETE FROM notification_history WHERE packageName = :packageName")
    suspend fun deleteNotificationsByPackage(packageName: String)
    
    @Query("DELETE FROM notification_history")
    suspend fun deleteAll()
    
    @Query("SELECT COUNT(*) FROM notification_history WHERE packageName = :packageName")
    suspend fun getNotificationCountByPackage(packageName: String): Int
}

