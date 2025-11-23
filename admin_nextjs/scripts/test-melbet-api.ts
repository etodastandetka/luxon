/**
 * Тестовый скрипт для проверки API Melbet
 * Проверяет формирование подписи и confirm согласно документации
 */

import crypto from 'crypto'

// Тестовые данные из документации
const hash = 'fhd.ncbf9hf2ythr'
const userId = '76'
const amount = 100
const cashierpass = '123123'
const cashdeskid = '77'
const code = 'a2a3'

console.log('🧪 Тестирование API Melbet согласно документации\n')

// Тест 1: Формирование подписи для пополнения
console.log('1️⃣ Тест пополнения (Deposit):')
console.log('Параметры:')
console.log(`  hash = ${hash}`)
console.log(`  userId = ${userId}`)
console.log(`  amount = ${amount}`)
console.log(`  cashierpass = ${cashierpass}`)
console.log(`  cashdeskid = ${cashdeskid}`)
console.log('')

// Шаг 1: SHA256(hash={hash}&lng=ru&userid={user_id})
// Согласно примеру 3.5 используется userid (маленькая буква)
const step1String = `hash=${hash}&lng=ru&userid=${userId.toLowerCase()}`
const step1Hash = crypto.createHash('sha256').update(step1String).digest('hex')
console.log(`Шаг 1: SHA256(${step1String})`)
console.log(`Результат: ${step1Hash}`)
console.log('')

// Шаг 2: MD5(summa={amount}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
const step2String = `summa=${amount}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`
const step2Hash = crypto.createHash('md5').update(step2String).digest('hex')
console.log(`Шаг 2: MD5(${step2String})`)
console.log(`Результат: ${step2Hash}`)
console.log('')

// Шаг 3: SHA256(step1 + step2)
const combined = step1Hash + step2Hash
const finalSign = crypto.createHash('sha256').update(combined).digest('hex')
console.log(`Шаг 3: SHA256(${step1Hash}${step2Hash})`)
console.log(`Финальная подпись: ${finalSign}`)
console.log('')

// Ожидаемый результат из документации (пример 3.5):
const expectedStep1 = '2c85cd8b2667ef9d8d1afb8780f2129fc82eea84fdfc71f5cc6d6869c1eed901'
const expectedStep2 = 'cc8123f763fec8ca3624304756dd9991'
const expectedSign = '2ef2aa7bdb3f2c54351a144cd8fd0869f468d7e261225bfab9792befa7bd272e'

console.log('✅ Ожидаемые результаты из документации:')
console.log(`  Шаг 1: ${expectedStep1}`)
console.log(`  Шаг 2: ${expectedStep2}`)
console.log(`  Финальная подпись: ${expectedSign}`)
console.log('')

console.log('🔍 Проверка:')
console.log(`  Шаг 1 совпадает: ${step1Hash === expectedStep1 ? '✅' : '❌'}`)
console.log(`  Шаг 2 совпадает: ${step2Hash === expectedStep2 ? '✅' : '❌'}`)
console.log(`  Финальная подпись совпадает: ${finalSign === expectedSign ? '✅' : '❌'}`)
console.log('')

// Тест 2: Формирование confirm
console.log('2️⃣ Тест confirm:')
const confirmString = `${userId.toLowerCase()}:${hash}`
const confirm = crypto.createHash('md5').update(confirmString).digest('hex')
const expectedConfirm = 'c7fe6da2e22cd27895d46f5d851f1ae1'
console.log(`MD5(${confirmString})`)
console.log(`Результат: ${confirm}`)
console.log(`Ожидаемый: ${expectedConfirm}`)
console.log(`Совпадает: ${confirm === expectedConfirm ? '✅' : '❌'}`)
console.log('')

// Тест 3: Формирование подписи для вывода
console.log('3️⃣ Тест вывода (Payout):')
console.log(`Параметры: userId=${userId}, code=${code}`)
console.log('')

// Шаг 1: SHA256(hash={hash}&lng=ru&userid={user_id})
const withdrawStep1String = `hash=${hash}&lng=ru&userid=${userId.toLowerCase()}`
const withdrawStep1Hash = crypto.createHash('sha256').update(withdrawStep1String).digest('hex')
console.log(`Шаг 1: SHA256(${withdrawStep1String})`)
console.log(`Результат: ${withdrawStep1Hash}`)
console.log('')

// Шаг 2: MD5(code={code}&cashierpass={cashierpass}&cashdeskid={cashdeskid})
const withdrawStep2String = `code=${code}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`
const withdrawStep2Hash = crypto.createHash('md5').update(withdrawStep2String).digest('hex')
console.log(`Шаг 2: MD5(${withdrawStep2String})`)
console.log(`Результат: ${withdrawStep2Hash}`)
console.log('')

// Шаг 3: SHA256(step1 + step2)
const withdrawCombined = withdrawStep1Hash + withdrawStep2Hash
const withdrawFinalSign = crypto.createHash('sha256').update(withdrawCombined).digest('hex')
console.log(`Шаг 3: SHA256(${withdrawStep1Hash}${withdrawStep2Hash})`)
console.log(`Финальная подпись: ${withdrawFinalSign}`)
console.log('')

console.log('✅ Все тесты завершены!')







