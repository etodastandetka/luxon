package com.req.notificationreader.parser

import com.req.notificationreader.model.PaymentNotification
import java.util.regex.Pattern

class CompanionBankParser : BaseBankParser() {
    
    override fun canParse(packageName: String, text: String): Boolean {
        val companionPackages = listOf(
            "kg.companion",
            "com.companion",
            "kg.companionbank",
            "kg.companion.bank",
            "kg.companion.mobile",
            "kg.companion.app",
            "kg.companion.clone",
            "companion",
            "companionbank"
        )
        return companionPackages.any { packageName.contains(it, ignoreCase = true) } ||
               text.contains("компаньон", ignoreCase = true) ||
               text.contains("companion", ignoreCase = true) ||
               text.contains("компаньон банк", ignoreCase = true) ||
               text.contains("companion bank", ignoreCase = true)
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
            bankName = "Компаньон Банк",
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
            "толтолду", "толукталды", "кабыл алынды",
            "пополнена", "зачислена", "поступила",
            "пополнены", "зачислены", "поступили"
        )
        return topUpKeywords.any { text.contains(it, ignoreCase = true) }
    }
    
    override fun getBankName(packageName: String): String = "Компаньон Банк"
}

