package com.req.notificationreader.parser

/**
 * Класс для определения банка по package name приложения
 */
object BankDetector {
    
    // Полная база package names для всех банков Кыргызстана
    private val bankPackages = mapOf(
        "РСК Банк" to listOf(
            "kg.rskbank", "com.rskbank", "kg.rsk", "com.rsk",
            "kg.rskbank.mobile", "kg.rskbank.app", "rskbank", "rsk"
        ),
        "Демир Банк" to listOf(
            "kg.demirbank", "com.demirbank", "kg.demir", "com.demir",
            "kg.demirbank.mobile", "demirbank", "demir"
        ),
        "Бай Тушум" to listOf(
            "kg.baitushum", "com.baitushum", "kg.bai", "com.bai",
            "kg.baitushum.mobile", "baitushum", "bai"
        ),
        "Bakai Bank" to listOf(
            "kg.bakai", "com.bakai", "kg.bakaibank", "com.bakaibank",
            "kg.bakai.mobile", "bakai", "bakaibank"
        ),
        "Кыргызстан Банк" to listOf(
            "kg.kyrgyzstan", "com.kyrgyzstan.bank", "kg.kib", "com.kib",
            "kg.kyrgyzstanbank", "kyrgyzstan", "kib"
        ),
        "Optima Bank" to listOf(
            "kg.optima", "com.optima", "kg.optima.bank", "kg.optimabank",
            "kg.optima.mobile", "optima", "optimabank"
        ),
        "MBank" to listOf(
            "kg.mbank", "com.mbank", "kg.mbank.mobile", "kg.mbank.app",
            "mbank", "эм-банк", "эм банк"
        ),
        "Компаньон Банк" to listOf(
            "kg.companion", "com.companion", "kg.companionbank", "kg.companion.bank",
            "kg.companion.mobile", "kg.companion.app", "com.companionbank", "com.companion.bank",
            "com.companion.mobile", "com.companion.app", "companionbank", "companion.bank"
        ),
        "Капитал Банк" to listOf(
            "kg.kapital", "com.kapital", "kg.kapitalbank", "kapital", "capital"
        ),
        "Керемет Банк" to listOf(
            "kg.keremet", "com.keremet", "kg.keremetbank", "keremet"
        ),
        "Финанс Кредит" to listOf(
            "kg.finans", "com.finans", "kg.finanscredit", "finans", "finance"
        ),
        "О! Банк" to listOf(
            "kg.obank", "com.obank", "kg.o.bank", "obank", "o.bank"
        ),
        "Айыл Банк" to listOf(
            "kg.ayil", "com.ayil", "kg.ayilbank", "ayil", "ayyl"
        ),
        "Экопласт" to listOf(
            "kg.ekoplast", "com.ekoplast", "ekoplast"
        )
    )
    
    /**
     * Определяет название банка по package name
     * @param packageName package name приложения
     * @return название банка или null если не найден
     */
    fun detectBankByPackage(packageName: String): String? {
        if (packageName.isBlank()) return null
        
        val lowerPackage = packageName.lowercase()
        
        // Шаг 1: Проверяем точные совпадения (самый надежный способ)
        for ((bankName, packages) in bankPackages) {
            if (packages.any { lowerPackage == it.lowercase() }) {
                return bankName
            }
        }
        
        // Шаг 2: Проверяем, начинается ли package name с известного префикса
        // Это более точная проверка, чем просто contains
        for ((bankName, packages) in bankPackages) {
            for (pkg in packages) {
                val lowerPkg = pkg.lowercase()
                // Проверяем точное совпадение после удаления точек
                if (lowerPackage == lowerPkg || 
                    lowerPackage.startsWith("$lowerPkg.") ||
                    lowerPackage.endsWith(".$lowerPkg") ||
                    lowerPackage.contains(".$lowerPkg.")) {
                    return bankName
                }
            }
        }
        
        // Шаг 3: Если клонированное приложение, определяем базовый банк
        if (lowerPackage.contains(".clone")) {
            val basePackage = lowerPackage.substringBefore(".clone")
            // Проверяем точные совпадения для базового package
            for ((bankName, packages) in bankPackages) {
                for (pkg in packages) {
                    val lowerPkg = pkg.lowercase()
                    if (basePackage == lowerPkg || 
                        basePackage.startsWith("$lowerPkg.") ||
                        basePackage.endsWith(".$lowerPkg") ||
                        basePackage.contains(".$lowerPkg.")) {
                        return "$bankName (клонированное)"
                    }
                }
            }
            return "Клонированное приложение ($basePackage)"
        }
        
        // Шаг 4: Проверяем частичные совпадения (менее надежно, но может помочь)
        // Используем только для полных слов, чтобы избежать ложных срабатываний
        for ((bankName, packages) in bankPackages) {
            for (pkg in packages) {
                val lowerPkg = pkg.lowercase()
                // Проверяем только если package name содержит полное слово
                val pkgParts = lowerPkg.split(".").filter { it.isNotEmpty() && it.length > 2 }
                if (pkgParts.isNotEmpty() && pkgParts.any { part -> 
                    lowerPackage.contains(".$part.") || 
                    lowerPackage.startsWith("$part.") ||
                    lowerPackage.endsWith(".$part") ||
                    lowerPackage == part
                }) {
                    return bankName
                }
            }
        }
        
        return null
    }
    
    /**
     * Получает все известные package names для банка
     */
    fun getBankPackages(bankName: String): List<String> {
        return bankPackages[bankName] ?: emptyList()
    }
    
    /**
     * Получает все известные банки
     */
    fun getAllBanks(): Set<String> {
        return bankPackages.keys
    }
}

