package com.bankhook.client.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.bankhook.client.data.local.AppDatabase
import com.bankhook.client.data.local.TransactionEntity
import com.bankhook.client.data.remote.NetworkModule
import com.bankhook.client.data.remote.PaymentRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SendPaymentWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val amount = inputData.getDouble("amount", -1.0)
        val bank = inputData.getString("bank") ?: ""
        val timestamp = inputData.getString("timestamp") ?: ""
        val raw = inputData.getString("raw") ?: ""
        if (amount <= 0 || bank.isBlank() || timestamp.isBlank()) return@withContext Result.failure()

        val db = AppDatabase.get(applicationContext)
        val dao = db.txDao()
        val id = dao.insert(
            TransactionEntity(
                amount = amount,
                bank = bank,
                timestampIso = timestamp,
                rawMessage = raw,
                status = "pending"
            )
        )

        return@withContext try {
            val api = NetworkModule.api(applicationContext)
            val resp = api.send(PaymentRequest(amount, bank, timestamp, raw))
            if (resp.isSuccessful) {
                dao.updateStatus(id, "sent", null)
                Result.success()
            } else {
                val err = "HTTP ${resp.code()}"
                dao.updateStatus(id, "error", err)
                Result.retry()
            }
        } catch (e: Exception) {
            dao.updateStatus(id, "error", e.message ?: "error")
            Result.retry()
        }
    }
}
