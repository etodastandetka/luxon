package com.req.notificationreader.parser

import com.req.notificationreader.model.PaymentNotification
import java.util.regex.Pattern

interface BankParser {
    fun canParse(packageName: String, text: String): Boolean
    fun parse(packageName: String, text: String): PaymentNotification?
    fun getBankName(packageName: String): String
}

abstract class BaseBankParser : BankParser {
    
    protected fun extractAmount(text: String): Double? {
        // Паттерны для поиска сумм в сомах (сом) и других валютах
        val patterns = listOf(
            // Оптима: "На сумму: 89.00 KGS"
            Pattern.compile("(?:на сумму|сумма|суммасы|amount)[:：]\\s*(\\d+[,\\.]\\d{2})\\s*(?:сом|сомов|KGS|kg|С|сомо)", Pattern.CASE_INSENSITIVE),
            // Стандартные форматы
            Pattern.compile("(\\d+[,\\.]\\d{2})\\s*(?:сом|сомов|KGS|kg|С|сомо)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:пополнен|поступило|зачислен|получен|пополнение|толтолду|толукталды|успешное пополнение)[^\\d]*(\\d+[,\\.]\\d{2})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(\\d+[,\\.]\\d{2})\\s*(?:сом|KGS)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(\\d+)\\s*(?:сом|сомов|KGS)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:сумма|суммасы)[^\\d]*(\\d+[,\\.]\\d{2})", Pattern.CASE_INSENSITIVE),
            // Bakai Bank формат: "Успешное пополнение счета 100.00 KGS"
            Pattern.compile("(?:пополнение счета|пополнение|пополнено)[^\\d]*(\\d+[,\\.]\\d{2})\\s*(?:KGS|сом)", Pattern.CASE_INSENSITIVE),
            // Любая сумма с KGS или сом в конце строки или перед запятой
            Pattern.compile("(\\d+[,\\.]\\d{2})\\s*(?:KGS|сом|сомов)", Pattern.CASE_INSENSITIVE)
        )
        
        for (pattern in patterns) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                val amountStr = matcher.group(1).replace(",", ".")
                try {
                    return amountStr.toDouble()
                } catch (e: Exception) {
                    continue
                }
            }
        }
        return null
    }
    
    protected fun extractCurrency(text: String): String {
        // Определяем валюту
        val lowerText = text.lowercase()
        return when {
            lowerText.contains("сом") || lowerText.contains("kgs") -> "KGS"
            lowerText.contains("доллар") || lowerText.contains("usd") || lowerText.contains("$") -> "USD"
            lowerText.contains("евро") || lowerText.contains("eur") || lowerText.contains("€") -> "EUR"
            lowerText.contains("рубл") || lowerText.contains("rub") || lowerText.contains("₽") -> "RUB"
            else -> "KGS" // По умолчанию сом
        }
    }
    
    protected fun extractCardNumber(text: String): String? {
        // Поиск номеров карт (4 последние цифры, или полный номер)
        val patterns = listOf(
            Pattern.compile("(?:\\*{8,12}|\\d{4})\\s*(\\d{4})"), // Последние 4 цифры
            Pattern.compile("\\d{4}\\s*\\d{4}\\s*\\d{4}\\s*(\\d{4})"), // Полный номер
            Pattern.compile("(?:карта|карты|карточка|счет|счету|эсеп)[^\\d]*(?:\\*{8,12}|\\d{4})\\s*(\\d{4})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\*{4,}\\s*(\\d{4,})")
        )
        
        for (pattern in patterns) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                return matcher.group(1)
            }
        }
        return null
    }
    
    protected fun extractAccountNumber(text: String): String? {
        // Поиск номеров счетов
        val patterns = listOf(
            Pattern.compile("(?:счет|счету|эсеп|аккаунт)[^\\d]*([\\d\\*]{10,})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("\\*{4,}\\s*(\\d{4,})"),
            Pattern.compile("(?:номер|номеру|номери)[^\\d]*([\\d]{4,})", Pattern.CASE_INSENSITIVE)
        )
        
        for (pattern in patterns) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                val number = matcher.group(1).replace("*", "").takeLast(4)
                if (number.length >= 2) {
                    return number
                }
            }
        }
        return null
    }
}
