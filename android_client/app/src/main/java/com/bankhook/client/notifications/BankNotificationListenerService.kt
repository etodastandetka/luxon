package com.bankhook.client.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.app.Notification
import com.bankhook.client.util.AmountParser
import com.bankhook.client.util.BankDetector
import com.bankhook.client.util.TimeUtil
import com.bankhook.client.work.EnqueueSendPayment
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BankNotificationListenerService : NotificationListenerService() {
    private val scope = CoroutineScope(Dispatchers.Default)

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val n = sbn?.notification ?: return
        val extras = n.extras
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val appPkg = sbn.packageName ?: ""
        val full = (title + ": " + text).trim()

        val bank = BankDetector.detect(appPkg, title, text) ?: return
        val amount = AmountParser.extractKgsAmount(full) ?: return
        val timestampIso = TimeUtil.nowIso()

        val prefs = EncryptedSharedPreferences.create(
            applicationContext,
            "secure_prefs",
            MasterKey.Builder(applicationContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
        val enabled = prefs.getBoolean("sendingEnabled", true)
        if (enabled) {
            scope.launch {
                EnqueueSendPayment.enqueue(applicationContext, amount, bank, timestampIso, full)
            }
        }
    }
}
