package com.bankhook.client.util

object BankDetector {
    private val knownPkgs = mapOf(
        "kg.mbank.app" to "Mbank",
        "kg.optimabank.app" to "Optima",
        "kg.bakai.bank" to "Bakai",
        "kg.demirbank" to "DemirBank",
        "kg.balance" to "Balance.kg",
        "kg.megapay" to "MegaPay",
    )

    fun detect(pkg: String, title: String, text: String): String? {
        knownPkgs[pkg]?.let { return it }
        val hay = (title + " " + text).lowercase()
        return when {
            "mbank" in hay -> "Mbank"
            "optima" in hay -> "Optima"
            "bakai" in hay -> "Bakai"
            "demir" in hay -> "DemirBank"
            "balance" in hay -> "Balance.kg"
            "megapay" in hay -> "MegaPay"
            else -> null
        }
    }
}
