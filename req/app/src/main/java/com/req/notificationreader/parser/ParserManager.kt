package com.req.notificationreader.parser

import android.content.Context
import com.req.notificationreader.model.PaymentNotification
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ParserManager {
    
    private val universalParser = UniversalParser()
    private var context: Context? = null
    
    fun setContext(context: Context) {
        this.context = context
        universalParser.setContext(context)
    }
    
    suspend fun parseNotification(packageName: String, title: String?, text: String?): PaymentNotification? {
        return withContext(Dispatchers.Default) {
            val fullText = buildString {
                title?.let { append(it).append("\n") }
                text?.let { append(it) }
            }.trim()
            
            if (fullText.isEmpty()) {
                return@withContext null
            }
            
            // Используем только универсальный парсер
            // Он определяет банк по названию приложения из системы или по package name
            try {
                if (universalParser.canParse(packageName, fullText)) {
                    return@withContext universalParser.parse(packageName, fullText)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            
            null
        }
    }
    
    companion object {
        @Volatile
        private var INSTANCE: ParserManager? = null
        
        fun getInstance(): ParserManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ParserManager().also { INSTANCE = it }
            }
        }
    }
}
