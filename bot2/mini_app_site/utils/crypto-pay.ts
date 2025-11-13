/**
 * Crypto Pay utilities with KGS (Kyrgyzstani Som) conversion
 */

// Кэш курса валют (обновляется раз в минуту)
let exchangeRateCache: {
    usdtToUsd: number | null;
    usdToKgs: number | null;
    usdtToKgs: number | null;
    timestamp: number;
} = {
    usdtToUsd: null,
    usdToKgs: null,
    usdtToKgs: null,
    timestamp: 0
};

const CACHE_DURATION = 60 * 1000; // 1 минута

/**
 * Получение курса валют через API админки
 */
export async function getExchangeRate(): Promise<{
    usdtToUsd: number | null;
    usdToKgs: number | null;
    usdtToKgs: number | null;
}> {
    // Проверяем кэш
    const now = Date.now();
    if (exchangeRateCache.timestamp > 0 && (now - exchangeRateCache.timestamp) < CACHE_DURATION) {
        return {
            usdtToUsd: exchangeRateCache.usdtToUsd,
            usdToKgs: exchangeRateCache.usdToKgs,
            usdtToKgs: exchangeRateCache.usdtToKgs
        };
    }

    try {
        const apiUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3001' 
            : 'https://xendro.pro';
        
        const response = await fetch(`${apiUrl}/api/crypto-pay/exchange-rate`, {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch exchange rate');
        }

        const data = await response.json();
        
        if (data.success && data.data) {
            exchangeRateCache = {
                usdtToUsd: data.data.usdtToUsd,
                usdToKgs: data.data.usdToKgs,
                usdtToKgs: data.data.usdtToKgs,
                timestamp: now
            };
            
            return {
                usdtToUsd: data.data.usdtToUsd,
                usdToKgs: data.data.usdToKgs,
                usdtToKgs: data.data.usdtToKgs
            };
        }
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
    }

    // Fallback: более актуальные курсы (ноябрь 2024)
    const fallbackUsdToKgs = 87.41; // Более актуальный курс USD -> KGS
    const fallbackUsdtToUsd = 1; // 1 USDT = 1 USD (примерно)
    
    return {
        usdtToUsd: fallbackUsdtToUsd,
        usdToKgs: fallbackUsdToKgs,
        usdtToKgs: fallbackUsdtToUsd * fallbackUsdToKgs
    };
}

/**
 * Конвертация долларов (USD) в USDT
 * Для Crypto Bot: пользователь вводит USD, конвертируем в USDT
 */
export async function usdToUsdt(usd: number): Promise<number> {
    const rates = await getExchangeRate();
    // USDT обычно равен USD (1:1), но используем реальный курс если доступен
    const rate = rates.usdtToUsd || 1;
    return Math.round((usd / rate) * 100) / 100;
}

/**
 * Конвертация USDT в доллары (USD)
 */
export async function usdtToUsd(usdt: number): Promise<number> {
    const rates = await getExchangeRate();
    const rate = rates.usdtToUsd || 1;
    return Math.round((usdt * rate) * 100) / 100;
}

/**
 * Конвертация долларов (USD) в сомы (KGS)
 * Используется для конвертации суммы после оплаты для пополнения в казино
 */
export async function usdToKgs(usd: number): Promise<number> {
    const rates = await getExchangeRate();
    const rate = rates.usdToKgs || 95;
    return Math.round((usd * rate) * 100) / 100;
}

/**
 * Конвертация сомов в доллары (USD)
 */
export async function kgsToUsd(kgs: number): Promise<number> {
    const rates = await getExchangeRate();
    const rate = rates.usdToKgs || 95;
    return Math.round((kgs / rate) * 100) / 100;
}

/**
 * Конвертация USDT в сомы (KGS)
 */
export async function usdtToKgs(usdt: number): Promise<number> {
    const rates = await getExchangeRate();
    const rate = rates.usdtToKgs || (rates.usdtToUsd || 1) * (rates.usdToKgs || 95);
    return Math.round((usdt * rate) * 100) / 100;
}

/**
 * Конвертация сомов в USDT (для обратной совместимости)
 */
export async function kgsToUsdt(kgs: number): Promise<number> {
    const rates = await getExchangeRate();
    const rate = rates.usdtToKgs || (rates.usdtToUsd || 1) * (rates.usdToKgs || 95);
    return Math.round((kgs / rate) * 100) / 100;
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
export function formatUsdt(amount: number | string | undefined | null): string {
    if (amount === undefined || amount === null) return '0.00 USDT';
    let num: number;
    if (typeof amount === 'string') {
        num = parseFloat(amount);
    } else if (typeof amount === 'number') {
        num = amount;
    } else {
        num = 0;
    }
    if (isNaN(num)) return '0.00 USDT';
    return `${num.toFixed(2)} USDT`;
}

/**
 * Форматирование суммы в долларах
 */
export function formatUsd(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0.00 USD';
    return `$${num.toFixed(2)}`;
}

/**
 * Валидация суммы в долларах для криптоплатежей
 */
export function validateCryptoAmount(amountUsd: number): { valid: boolean; error?: string } {
    if (amountUsd < 1) {
        return {
            valid: false,
            error: 'Минимальная сумма: $1 USD'
        };
    }
    
    if (amountUsd > 1000) {
        return {
            valid: false,
            error: 'Максимальная сумма: $1000 USD'
        };
    }
    
    return { valid: true };
}

