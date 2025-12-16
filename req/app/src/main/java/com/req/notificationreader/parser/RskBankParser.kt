package com.req.notificationreader.parser

import com.req.notificationreader.model.PaymentNotification
import java.util.regex.Pattern

class RskBankParser : BaseBankParser() {
    
    override fun canParse(packageName: String, text: String): Boolean {
        val rskPackages = listOf(
            "kg.rskbank",
            "com.rskbank",
            "kg.rskbank.mobile",
            "kg.rskbank.clone",
            "com.rskbank.clone"
        )
        return rskPackages.any { packageName.contains(it, ignoreCase = true) } ||
               text.contains("рск", ignoreCase = true) ||
               text.contains("rsk", ignoreCase = true) ||
               text.contains("рсб", ignoreCase = true)
    }
    
    override fun parse(packageName: String, text: String): PaymentNotification? {
        if (!isTopUpNotification(text)) {
            return null
        }
        
        val amount = extractAmount(text) ?: return null
        val currency = extractCurrency(text)
        val cardNumber = extractCardNumber(text)
        val accountNumber = extractAccountNumber(text)
        
        return PaymentNotification(
            bankName = "РСК Банк",
            packageName = packageName,
            amount = amount,
            currency = currency,
            cardNumber = cardNumber,
            accountNumber = accountNumber,
            rawText = text
        )
    }
    
    private fun isTopUpNotification(text: String): Boolean {
        val topUpKeywords = listOf(
            "пополнен", "поступило", "зачислен", "получен",
            "пополнение", "зачисление", "поступление", "приход",
            "толтолду", "толукталды", "кабыл алынды", // На кыргызском
            "топтолду"
        )
        return topUpKeywords.any { text.contains(it, ignoreCase = true) }
    }
    
    override fun getBankName(packageName: String): String = "РСК Банк"
}

