/**
 * Скрипт для проверки конфигурации MobCash API
 * Запуск: tsx scripts/check-mobcash-config.ts
 */

console.log('🔍 Проверка конфигурации MobCash API')
console.log('=' .repeat(60))
console.log()

// Проверяем переменные окружения
const login = process.env.MOBCASH_LOGIN
const password = process.env.MOBCASH_PASSWORD
const cashdeskId = process.env.MOBCASH_CASHDESK_ID
const defaultLat = process.env.MOBCASH_DEFAULT_LAT
const defaultLon = process.env.MOBCASH_DEFAULT_LON

// Проверяем токены (для гибридного режима)
const bearerToken = process.env.MOBCASH_BEARER_TOKEN
const userId = process.env.MOBCASH_USER_ID
const sessionId = process.env.MOBCASH_SESSION_ID

console.log('📋 Конфигурация из .env:')
console.log()

// Проверка обязательных полей для варианта 2
let hasRequiredFields = true
let configType = ''

if (login && password && cashdeskId) {
  console.log('✅ MOBCASH_LOGIN:', login)
  console.log('✅ MOBCASH_PASSWORD:', password.substring(0, 3) + '***')
  console.log('✅ MOBCASH_CASHDESK_ID:', cashdeskId)
  console.log('✅ MOBCASH_DEFAULT_LAT:', defaultLat || '42.845778 (default)')
  console.log('✅ MOBCASH_DEFAULT_LON:', defaultLon || '74.568778 (default)')
  configType = 'Вариант 2 (Автоматический OAuth2)'
} else {
  hasRequiredFields = false
  console.log('❌ MOBCASH_LOGIN:', login || 'НЕ НАСТРОЕНО')
  console.log('❌ MOBCASH_PASSWORD:', password ? password.substring(0, 3) + '***' : 'НЕ НАСТРОЕНО')
  console.log('❌ MOBCASH_CASHDESK_ID:', cashdeskId || 'НЕ НАСТРОЕНО')
  console.log('⚠️  MOBCASH_DEFAULT_LAT:', defaultLat || '42.845778 (default)')
  console.log('⚠️  MOBCASH_DEFAULT_LON:', defaultLon || '74.568778 (default)')
}

console.log()

// Проверка токенов
const hasTokens = bearerToken && userId && sessionId

if (hasTokens) {
  console.log('📌 Токены (для гибридного режима):')
  console.log('✅ MOBCASH_BEARER_TOKEN:', bearerToken.substring(0, 30) + '...')
  console.log('✅ MOBCASH_USER_ID:', userId)
  console.log('✅ MOBCASH_SESSION_ID:', sessionId)
  console.log()
  
  if (hasRequiredFields) {
    configType = 'Гибридный режим (Токены + OAuth2 fallback)'
  } else {
    configType = 'Вариант 1 (Только токены)'
  }
} else {
  console.log('📌 Токены:')
  console.log('⚠️  MOBCASH_BEARER_TOKEN:', bearerToken ? bearerToken.substring(0, 30) + '...' : 'НЕ НАСТРОЕНО')
  console.log('⚠️  MOBCASH_USER_ID:', userId || 'НЕ НАСТРОЕНО')
  console.log('⚠️  MOBCASH_SESSION_ID:', sessionId || 'НЕ НАСТРОЕНО')
  console.log()
}

console.log('=' .repeat(60))
console.log()

if (hasRequiredFields) {
  console.log('✅ Конфигурация: ' + configType)
  console.log()
  console.log('📝 Рекомендации:')
  
  if (hasTokens) {
    console.log('   • Токены настроены - система будет использовать их в первую очередь')
    console.log('   • При истечении токенов автоматически выполнится OAuth2 flow')
    console.log('   • Для "чистого" варианта 2 закомментируйте токены в .env')
  } else {
    console.log('   • Система будет использовать только OAuth2 flow')
    console.log('   • Токены будут автоматически получаться и кешироваться')
    console.log('   • Никаких ручных действий не требуется!')
  }
  
  console.log()
  console.log('🚀 Готово к работе!')
} else {
  console.log('❌ Конфигурация неполная!')
  console.log()
  console.log('📝 Необходимо настроить в .env:')
  console.log('   • MOBCASH_LOGIN="ваш_логин"')
  console.log('   • MOBCASH_PASSWORD="ваш_пароль"')
  console.log('   • MOBCASH_CASHDESK_ID="код_кассы"')
  console.log('   • MOBCASH_DEFAULT_LAT=42.845778 (опционально)')
  console.log('   • MOBCASH_DEFAULT_LON=74.568778 (опционально)')
  console.log()
  console.log('📖 См. MOBCASH_OAUTH2_SETUP.md для подробной инструкции')
  process.exit(1)
}

console.log()

