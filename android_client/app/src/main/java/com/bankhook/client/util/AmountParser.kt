package com.bankhook.client.util

object AmountParser {
    // Capture the numeric chunk immediately before 'KGS' (first occurrence)
    private val reBeforeKgs = Regex("([0-9][0-9\\s.,\\u00A0]*?)\\s*KGS", RegexOption.IGNORE_CASE)

    fun extractKgsAmount(text: String): Double? {
        // Normalize NBSP to space and collapse multiple spaces
        val norm = text.replace('\u00A0', ' ')
        val m = reBeforeKgs.find(norm) ?: return null
        val raw = m.groupValues[1].trim()
        val cleaned = normalizeNumber(raw) ?: return null
        return cleaned.toDoubleOrNull()
    }

    private fun normalizeNumber(s: String): String? {
        var t = s.trim()
        if (t.isEmpty()) return null
        // Strategy: determine decimal separator when both ',' and '.' present
        val hasComma = t.contains(',')
        val hasDot = t.contains('.')
        // Remove spaces
        t = t.replace(" ", "")
        return when {
            hasComma && hasDot -> {
                // Decide by last occurrence: assume the last of [.,] is the decimal separator
                val lastComma = t.lastIndexOf(',')
                val lastDot = t.lastIndexOf('.')
                val decimalIsComma = lastComma > lastDot
                if (decimalIsComma) {
                    val noDots = t.replace(".", "") // remove thousands dots
                    noDots.replace(',', '.')           // use dot as decimal
                } else {
                    t.replace(",", "")              // remove thousands commas
                }
            }
            hasComma && !hasDot -> {
                // Only comma present -> treat as decimal separator
                t.replace(',', '.')
            }
            !hasComma && hasDot -> {
                // Only dot present -> already decimal
                t
            }
            else -> {
                // Only digits (no separators)
                t
            }
        }
    }
}
