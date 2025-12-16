package com.req.notificationreader.database

import androidx.room.*
import com.req.notificationreader.model.AppLog
import kotlinx.coroutines.flow.Flow

@Dao
interface LogDao {
    
    @Query("SELECT * FROM app_logs ORDER BY timestamp DESC")
    fun getAllLogs(): Flow<List<AppLog>>
    
    @Query("SELECT * FROM app_logs ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentLogs(limit: Int = 1000): Flow<List<AppLog>>
    
    @Query("SELECT * FROM app_logs WHERE level = :level ORDER BY timestamp DESC")
    fun getLogsByLevel(level: AppLog.LogLevel): Flow<List<AppLog>>
    
    @Query("SELECT * FROM app_logs WHERE category = :category ORDER BY timestamp DESC")
    fun getLogsByCategory(category: String): Flow<List<AppLog>>
    
    @Query("SELECT * FROM app_logs WHERE message LIKE '%' || :search || '%' OR details LIKE '%' || :search || '%' ORDER BY timestamp DESC")
    fun searchLogs(search: String): Flow<List<AppLog>>
    
    @Query("SELECT * FROM app_logs WHERE timestamp >= :fromTimestamp AND timestamp <= :toTimestamp ORDER BY timestamp DESC")
    fun getLogsByTimeRange(fromTimestamp: Long, toTimestamp: Long): Flow<List<AppLog>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLog(log: AppLog): Long
    
    @Query("DELETE FROM app_logs WHERE timestamp < :beforeTimestamp")
    suspend fun deleteOldLogs(beforeTimestamp: Long)
    
    @Query("DELETE FROM app_logs")
    suspend fun deleteAllLogs()
    
    @Query("SELECT COUNT(*) FROM app_logs")
    suspend fun getLogCount(): Int
    
    @Query("SELECT * FROM app_logs WHERE level = 'ERROR' ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecentErrors(limit: Int = 100): List<AppLog>
}

