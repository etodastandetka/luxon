package com.req.notificationreader.parser

import com.req.notificationreader.model.PaymentNotification
import java.util.regex.Pattern

class OptimaBankParser : BaseBankParser() {
    
    override fun canParse(packageName: String, text: String): Boolean {
        val optimaPackages = listOf(
            "kg.optima",
            "com.optima",
            "kg.optima.bank",
            "kg.optima.clone"
        )
        return optimaPackages.any { packageName.contains(it, ignoreCase = true) } ||
               text.contains("оптима", ignoreCase = true) ||
               text.contains("optima", ignoreCase = true)
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
            bankName = "Optima Bank",
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
            "толтолду", "толукталды", "кабыл алынды"
        )
        return topUpKeywords.any { text.contains(it, ignoreCase = true) }
    }
    
    override fun getBankName(packageName: String): String = "Optima Bank"
}

