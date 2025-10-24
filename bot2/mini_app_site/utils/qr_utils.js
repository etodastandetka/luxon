const crypto = require('crypto')

const BASE_QR_HASH = (
    "00020101021232990015qr.demirbank.kg0108ib_andro1016118000035393208912021213021211328454d5b3ee5d47c7b61c0a0b07bb939a"
    "5204482953034175405100535909DEMIRBANK6304283f"
)

const CHECKSUM_METHOD = 'sha256'

function calculateChecksum(payloadWithout63, method = 'sha256') {
    method = (method || 'sha256').toLowerCase()
    
    if (method === 'crc16') {
        return calculateEmvCrc16Last4(payloadWithout63)
    }
    if (method === 'sha256_plus_63') {
        return calculateSha256Last4Plus63(payloadWithout63)
    }
    if (method === 'sha256_plus_6304') {
        return calculateSha256Last4Plus6304(payloadWithout63)
    }
    // По умолчанию — sha256
    return calculateSha256Last4(payloadWithout63)
}

function calculateEmvCrc16Last4(payloadWithout63) {
    const data = Buffer.from(payloadWithout63 + '6304', 'utf-8')
    let crc = 0xFFFF
    const poly = 0x1021
    
    for (let i = 0; i < data.length; i++) {
        crc ^= (data[i] << 8)
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) & 0xFFFF) ^ poly
            } else {
                crc = (crc << 1) & 0xFFFF
            }
        }
    }
    return crc.toString(16).padStart(4, '0')
}

function calculateSha256Last4(payloadWithout63) {
    const hash = crypto.createHash('sha256').update(payloadWithout63, 'utf-8').digest('hex')
    return hash.slice(-4).toLowerCase()
}

function calculateSha256Last4Plus63(payloadWithout63) {
    const hash = crypto.createHash('sha256').update(payloadWithout63 + '63', 'utf-8').digest('hex')
    return hash.slice(-4).toLowerCase()
}

function calculateSha256Last4Plus6304(payloadWithout63) {
    const hash = crypto.createHash('sha256').update(payloadWithout63 + '6304', 'utf-8').digest('hex')
    return hash.slice(-4).toLowerCase()
}

function generateSimpleQr(amount) {
    const amountCents = Math.round(amount * 100)
    const amountStr = amountCents.toString().padStart(5, '0')
    const amountLenStr = amountStr.length.toString().padStart(2, '0')

    const merchantAccountValue = (
        "0015qr.demirbank.kg"
        "0108ib_andro"
        "10161180000353932089"
        "11092021113021"
        "120212"
        "130212"
        "28454d5b3ee5d47c7b61c0a0b07bb939a"
    )
    const maLen = merchantAccountValue.length.toString().padStart(2, '0')
    const merchantAccount = "32" + maLen + merchantAccountValue

    const payload = (
        "000201"
        "010212"
        + merchantAccount +
        "52044829"
        "5303417"
        `54${amountLenStr}${amountStr}`
        "5909DEMIRBANK"
    )
    const checksum = calculateChecksum(payload, CHECKSUM_METHOD)
    return payload + "6304" + checksum
}

function createPaymentUrls(qrHash) {
    return {
        "DemirBank": `https://retail.demirbank.kg/#${qrHash}`,
        "MegaPay": `https://megapay.kg/get#${qrHash}`,
        "O! bank": `https://api.dengi.o.kg/ru/qr/#${qrHash}`,
        "Компаньон": `https://pay.payqr.kg/#${qrHash}`,
        "Balance.kg": `https://balance.kg/#${qrHash}`,
        "Bakai": `https://bakai24.app/#${qrHash}`,
        "MBank": `https://app.mbank.kg/qr/#${qrHash}`,
    }
}

function buildQrAndUrl(bankCode, options = {}) {
    const { amount, baseHash, requisite, staticQr = true } = options
    const bank = (bankCode || '').trim().toUpperCase()
    
    if (bank === 'DEMIR' || bank === 'DEMIRBANK') {
        if (requisite && requisite.length === 16 && /^\d+$/.test(requisite)) {
            const qr = buildDemirbankQrByTemplate(requisite, amount, staticQr)
            return { hash: qr, url: `https://retail.demirbank.kg/#${qr}` }
        } else if (baseHash) {
            const qr = updateAmountInQrHashProper(baseHash, amount)
            return { hash: qr, url: `https://retail.demirbank.kg/#${qr}` }
        } else {
            throw new Error('Для DEMIRBANK укажи requisite (16 цифр) или base_hash')
        }
    }

    if (bank === 'BAKAI' || bank === 'BAKAI24') {
        if (!baseHash) {
            throw new Error('Для Bakai требуется base_hash из админки')
        }
        const qr = updateAmountInQrHashProper(baseHash, amount)
        return { hash: qr, url: `https://bakai24.app/#${qr}` }
    }

    if (bank === 'MBANK') {
        if (!baseHash) {
            throw new Error('Для MBank требуется base_hash из админки')
        }
        const qr = updateAmountInQrHashProper(baseHash, amount)
        return { hash: qr, url: `https://app.mbank.kg/qr/#${qr}` }
    }

    if (bank === 'OPTIMA' || bank === 'OPTIMA BANK') {
        if (!baseHash) {
            throw new Error('Для Optima требуется base_hash из админки')
        }
        const qr = updateAmountInQrHashProper(baseHash, amount)
        return { hash: qr, url: `https://optima.kg/qr/#${qr}` }
    }

    // Фолбэк: возвращаем ссылки для известных, если есть
    if (baseHash) {
        const qr = updateAmountInQrHashProper(baseHash, amount)
        const urls = createPaymentUrls(qr)
        const keyMap = {
            'DEmirbank': 'DemirBank',
            'DEMirbank': 'DemirBank'
        }
        const url = urls[keyMap[bank] || bank] || Object.values(urls)[0]
        return { hash: qr, url: url }
    }
    
    throw new Error(`Неизвестный банк или отсутствуют данные для генерации: ${bankCode}`)
}

function buildDemirbankQrByTemplate(requisite, amount, staticQr = true) {
    const payloadFormat = '000201'
    const pointOfInitiation = staticQr ? '010211' : '010212'

    const sub00 = '0015qr.demirbank.kg'
    const sub01 = '01047001'
    const sub10 = `10${requisite.length.toString().padStart(2, '0')}${requisite}`
    const sub12 = '120211'
    const sub13 = '130212'
    const v32 = sub00 + sub01 + sub10 + sub12 + sub13
    
    if (v32.length > 99) {
        throw new Error('Поле 32 превысило максимально допустимую длину 99')
    }
    const field32 = `32${v32.length.toString().padStart(2, '0')}${v32}`

    const field52 = '52044829'
    const field53 = '5303417'
    
    const amountCents = Math.round(amount * 100)
    const amountStr = amountCents.toString().padStart(5, '0')
    const field54 = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`
    
    const field59 = '5909DEMIRBANK'

    const payloadWo63 = payloadFormat + pointOfInitiation + field32 + field52 + field53 + field54 + field59
    const cs = calculateChecksum(payloadWo63, 'sha256')
    return payloadWo63 + '6304' + cs
}

function updateAmountInQrHashProper(qrHash, newAmount) {
    try {
        // Нормализация
        qrHash = qrHash.toString().trim().replace(/\n/g, '').replace(/\r/g, '').replace(/\t/g, '')
        
        // Снять существующую контрольную сумму
        let qrWoChecksum = qrHash.replace(/6304[0-9A-Fa-f]{4}$/, '').replace(/63[0-9A-Fa-f]{4}$/, '')

        // Найдём ПОСЛЕДНЕЕ поле 54
        const matches = [...qrWoChecksum.matchAll(/54(\d{2})(\d+)/g)]
        if (matches.length === 0) {
            return qrHash
        }
        
        const m54 = matches[matches.length - 1]
        const pos = m54.index
        const oldLen = parseInt(m54[1])
        const valStart = pos + 4
        const valEnd = valStart + oldLen
        
        if (valEnd > qrWoChecksum.length) {
            return qrHash
        }

        const amountCents = Math.round(newAmount * 100)
        const amountStr = amountCents.toString().padStart(5, '0')
        const newLenStr = amountStr.length.toString().padStart(2, '0')

        const updated = (
            qrWoChecksum.substring(0, pos) +
            "54" + newLenStr + amountStr +
            qrWoChecksum.substring(valEnd)
        )

        // Пересчитываем контрольную сумму
        const cs = calculateChecksum(updated, CHECKSUM_METHOD)
        return updated + "6304" + cs
    } catch (error) {
        return qrHash
    }
}

module.exports = {
    generateSimpleQr,
    createPaymentUrls,
    buildQrAndUrl,
    calculateChecksum
}





