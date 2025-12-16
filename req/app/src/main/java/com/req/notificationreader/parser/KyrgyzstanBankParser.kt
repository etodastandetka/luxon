package com.req.notificationreader.parser

import com.req.notificationreader.model.PaymentNotification
import java.util.regex.Pattern

class KyrgyzstanBankParser : BaseBankParser() {
    
    override fun canParse(packageName: String, text: String): Boolean {
        val kyrgyzstanPackages = listOf(
            "kg.kyrgyzstan",
            "com.kyrgyzstan.bank",
            "kg.kib",
            "com.kib",
            "kg.kyrgyzstan.clone"
        )
        return kyrgyzstanPackages.any { packageName.contains(it, ignoreCase = true) } ||
               text.contains("кыргызстан", ignoreCase = true) ||
               text.contains("киб", ignoreCase = true) ||
               text.contains("kyrgyzstan", ignoreCase = true)
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
            bankName = "Кыргызстан Банк",
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
    
    override fun getBankName(packageName: String): String = "Кыргызстан Банк"
}

