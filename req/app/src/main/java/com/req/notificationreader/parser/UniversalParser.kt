package com.req.notificationreader.parser

import android.content.Context
import android.content.pm.PackageManager
import com.req.notificationreader.model.PaymentNotification
import java.util.regex.Pattern

/**
 * Универсальный парсер для всех остальных кыргызских банков и клонированных приложений
 */
class UniversalParser : BaseBankParser() {
    
    private var context: Context? = null
    
    fun setContext(context: Context) {
        this.context = context
    }
    
    override fun canParse(packageName: String, text: String): Boolean {
        // Парсер пытается парсить любые уведомления, которые содержат сумму
        // Проверяем наличие цифр (возможных сумм) в тексте
        return text.contains(Regex("\\d+[,\\.]?\\d*")) || isTopUpNotification(text)
    }
    
    override fun parse(packageName: String, text: String): PaymentNotification? {
        // Сначала пытаемся получить название приложения из системы (самый надежный способ)
        val bankName = getAppName(packageName)
            ?: BankDetector.detectBankByPackage(packageName)
            ?: detectBankFromText(text, packageName)
            ?: packageName.substringAfterLast(".")
            ?: "Неизвестное приложение"
        
        // Пытаемся извлечь сумму из текста
        val amount = extractAmount(text) ?: 0.0
        
        // Если это уведомление о пополнении или есть сумма, сохраняем
        if (amount > 0.0 || isTopUpNotification(text)) {
            val currency = extractCurrency(text)
            val cardNumber = extractCardNumber(text)
            val accountNumber = extractAccountNumber(text)
            
            return PaymentNotification(
                bankName = bankName,
                packageName = packageName,
                amount = amount,
                currency = currency,
                cardNumber = cardNumber,
                accountNumber = accountNumber,
                rawText = text
            )
        }
        
        return null
    }
    
    private fun detectBankFromText(text: String, packageName: String): String? {
        val lowerText = text.lowercase()
        val lowerPackage = packageName.lowercase()
        
        // Компаньон Банк - проверяем первым и по нескольким признакам
        if (lowerPackage.contains("companion") || 
            lowerText.contains("компаньон") || 
            lowerText.contains("companion")) {
            return "Компаньон Банк"
        }
        
        // Оптима банк
        if (lowerText.contains("optimabank") || lowerText.contains("optima24") || 
            lowerPackage.contains("optima")) {
            return "Optima Bank"
        }
        
        // Bakai Bank
        if (lowerText.contains("bakai") || lowerPackage.contains("bakai")) {
            return "Bakai Bank"
        }
        
        // РСК Банк - проверяем более строго
        if ((lowerPackage.contains("rskbank") || lowerPackage.contains("rsk.bank")) &&
            !lowerPackage.contains("companion")) {
            return "РСК Банк"
        }
        
        return null
    }
    
    private fun isTopUpNotification(text: String): Boolean {
        val topUpKeywords = listOf(
            "пополнен", "поступило", "зачислен", "получен",
            "пополнение", "зачисление", "поступление", "приход",
            "пополнение по qr", "пополнение счета", "успешное пополнение",
            "поступили средства", "зачислены средства", "начислен",
            "толтолду", "толукталды", "кабыл алынды", // Кыргызский
            "топтолду",
            "транзакция", "оплата", "платеж",
            "на сумму", "сумма"
        )
        // Также проверяем наличие суммы с валютой
        val hasAmount = text.contains(Regex("\\d+[,\\.]\\d{2}\\s*(?:KGS|сом|сомов)", RegexOption.IGNORE_CASE))
        return topUpKeywords.any { text.contains(it, ignoreCase = true) } || hasAmount
    }
    
    private fun detectBankName(text: String, packageName: String): String {
        val bankPatterns = mapOf(
            // Компаньон и MBank теперь имеют отдельные парсеры
            "Капитал Банк" to listOf("капитал", "kapital", "capital"),
            "Керемет Банк" to listOf("керемет", "keremet"),
            "Финанс Кредит" to listOf("финанс кредит", "finance credit", "finans"),
            "О! Банк" to listOf("о! банк", "о банк", "o! bank"),
            "Экопласт" to listOf("экспласт", "ekoplast"),
            "Айыл Банк" to listOf("айыл", "ayil"),
            "Банк" to listOf("банк", "bank")
        )
        
        val searchText = "${text.lowercase()} ${packageName.lowercase()}"
        
        for ((bankName, patterns) in bankPatterns) {
            if (patterns.any { searchText.contains(it, ignoreCase = true) }) {
                return bankName
            }
        }
        
        // Если клонированное приложение, определяем по package name
        if (packageName.contains(".clone")) {
            val basePackage = packageName.substringBefore(".clone")
            return "Клонированное ($basePackage)"
        }
        
        return "Неизвестный банк"
    }
    
    override fun getBankName(packageName: String): String {
        // Сначала пытаемся получить название приложения из системы
        return getAppName(packageName)
            ?: BankDetector.detectBankByPackage(packageName)
            ?: "Неизвестный банк"
    }
    
    /**
     * Получает название приложения по package name через PackageManager
     */
    private fun getAppName(packageName: String): String? {
        return try {
            val ctx = context
            if (ctx != null) {
                val packageManager = ctx.packageManager
                val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
                val appName = packageManager.getApplicationLabel(applicationInfo).toString()
                appName.ifBlank { null }
            } else {
                null
            }
        } catch (e: PackageManager.NameNotFoundException) {
            null
        } catch (e: Exception) {
            null
        }
    }
}
