package com.req.notificationreader.parser

import com.req.notificationreader.model.PaymentNotification
import java.util.regex.Pattern

class MBankParser : BaseBankParser() {
    
    override fun canParse(packageName: String, text: String): Boolean {
        val mbankPackages = listOf(
            "kg.mbank",
            "com.mbank",
            "kg.mbank.mobile",
            "kg.mbank.app",
            "kg.mbank.clone",
            "mbank"
        )
        return mbankPackages.any { packageName.contains(it, ignoreCase = true) } ||
               text.contains("мбанк", ignoreCase = true) ||
               text.contains("mbank", ignoreCase = true) ||
               text.contains("эм-банк", ignoreCase = true) ||
               text.contains("эм банк", ignoreCase = true)
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
            bankName = "MBank",
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
            "пополнена", "зачислена", "поступила"
        )
        return topUpKeywords.any { text.contains(it, ignoreCase = true) }
    }
    
    override fun getBankName(packageName: String): String = "MBank"
}

