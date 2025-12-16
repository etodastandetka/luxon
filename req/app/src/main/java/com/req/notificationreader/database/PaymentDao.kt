package com.req.notificationreader.database

import androidx.room.*
import com.req.notificationreader.model.PaymentNotification
import kotlinx.coroutines.flow.Flow

@Dao
interface PaymentDao {
    @Query("SELECT * FROM payment_notifications ORDER BY transactionDate DESC")
    fun getAllPayments(): Flow<List<PaymentNotification>>
    
    @Query("SELECT * FROM payment_notifications WHERE bankName = :bankName ORDER BY transactionDate DESC")
    fun getPaymentsByBank(bankName: String): Flow<List<PaymentNotification>>
    
    @Query("SELECT SUM(amount) as total FROM payment_notifications WHERE currency = :currency")
    fun getTotalAmount(currency: String = "KGS"): Flow<Double?>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayment(payment: PaymentNotification): Long
    
    @Delete
    suspend fun deletePayment(payment: PaymentNotification)
    
    @Query("DELETE FROM payment_notifications")
    suspend fun deleteAll()
}
