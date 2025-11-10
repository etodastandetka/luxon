/**
 * Crypto Pay utilities with KGS (Kyrgyzstani Som) conversion
 */

// Курс конвертации USD -> KGS (сомы)
const USD_TO_KGS_RATE = 95;

/**
 * Конвертация сомов в USDT
 */
export function kgsToUsdt(kgs: number): number {
    // Сначала конвертируем сомы в доллары
    const usd = kgs / USD_TO_KGS_RATE;
    // Возвращаем USDT (1 USD = 1 USDT)
    return Math.round(usd * 100) / 100; // Округляем до 2 знаков
}

/**
 * Конвертация USDT в сомы
 */
export function usdtToKgs(usdt: number): number {
    return Math.round(usdt * USD_TO_KGS_RATE * 100) / 100;
}

/**
 * Форматирование суммы в сомах
 */
export function formatKgs(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toFixed(2)} сом`;
}

/**
 * Форматирование суммы в USDT
 */
export function formatUsdt(amount: number | string | undefined): string {
    if (amount === undefined || amount === null) return '0.00 USDT';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0.00 USDT';
    return `${num.toFixed(2)} USDT`;
}

/**
 * Валидация суммы в сомах для криптоплатежей
 */
export function validateCryptoAmount(amountKgs: number): { valid: boolean; error?: string } {
    const amountUsdt = kgsToUsdt(amountKgs);
    
    if (amountUsdt < 1) {
        return {
            valid: false,
            error: `Минимальная сумма: ${usdtToKgs(1)} сом (1 USDT)`
        };
    }
    
    if (amountUsdt > 1000) {
        return {
            valid: false,
            error: `Максимальная сумма: ${usdtToKgs(1000)} сом (1000 USDT)`
        };
    }
    
    return { valid: true };
}

