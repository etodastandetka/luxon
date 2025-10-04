package com.bankhook.client.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("SELECT * FROM transactions ORDER BY createdAt DESC LIMIT 100")
    fun observeAll(): Flow<List<TransactionEntity>>

    @Insert
    suspend fun insert(entity: TransactionEntity): Long

    @Query("UPDATE transactions SET status=:status, lastError=:err WHERE id=:id")
    suspend fun updateStatus(id: Long, status: String, err: String?)
}
