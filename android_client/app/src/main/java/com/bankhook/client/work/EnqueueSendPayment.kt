package com.bankhook.client.work

import android.content.Context
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.BackoffPolicy
import java.util.concurrent.TimeUnit

object EnqueueSendPayment {
    private const val K_AMOUNT = "amount"
    private const val K_BANK = "bank"
    private const val K_TIMESTAMP = "timestamp"
    private const val K_RAW = "raw"

    fun enqueue(ctx: Context, amount: Double, bank: String, timestampIso: String, raw: String) {
        val d = Data.Builder()
            .putDouble(K_AMOUNT, amount)
            .putString(K_BANK, bank)
            .putString(K_TIMESTAMP, timestampIso)
            .putString(K_RAW, raw)
            .build()
        val req = OneTimeWorkRequestBuilder<SendPaymentWorker>()
            .setInputData(d)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(ctx).enqueue(req)
    }
}
