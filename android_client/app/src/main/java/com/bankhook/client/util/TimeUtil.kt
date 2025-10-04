package com.bankhook.client.util

import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

object TimeUtil {
    private val iso = DateTimeFormatter.ISO_OFFSET_DATE_TIME
    fun nowIso(): String = OffsetDateTime.now(ZoneOffset.UTC).format(iso)
}
