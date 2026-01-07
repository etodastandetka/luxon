export const formatAmount = (amount?: number, currency = '₽') => {
  if (amount == null || Number.isNaN(amount)) return `0 ${currency}`
  return `${Number(amount).toLocaleString('ru-RU')} ${currency}`
}








































