/**
 * Тестовый скрипт для проверки полной авторизации mob-cash через curl запросы
 * Запуск: tsx scripts/test-mobcash-auth.ts
 */

const MOBCASH_LOGIN = process.env.MOBCASH_LOGIN || 'burgoevk'
const MOBCASH_PASSWORD = process.env.MOBCASH_PASSWORD || 'Kanat312###'
const MOBCASH_CASHDESK_ID = process.env.MOBCASH_CASHDESK_ID || '1001098'
const MOBCASH_DEFAULT_LAT = parseFloat(process.env.MOBCASH_DEFAULT_LAT || '34.6805775')
const MOBCASH_DEFAULT_LON = parseFloat(process.env.MOBCASH_DEFAULT_LON || '33.0458273')

async function testMobCashAuth() {
  console.log('🧪 Тестирование полной авторизации mob-cash API')
  console.log('=' .repeat(60))
  console.log(`📋 Конфигурация:`)
  console.log(`   Login: ${MOBCASH_LOGIN}`)
  console.log(`   Password: ${MOBCASH_PASSWORD.substring(0, 3)}***`)
  console.log(`   Cashdesk ID: ${MOBCASH_CASHDESK_ID}`)
  console.log(`   Location: ${MOBCASH_DEFAULT_LAT}, ${MOBCASH_DEFAULT_LON}`)
  console.log()

  let cookies = ''
  let loginChallenge = ''
  let consentChallenge = ''
  let accessToken = ''
  let userID = ''
  let sessionID = ''

  try {
    // Шаг 1.1: Получение LoginChallenge
    console.log('🔐 Шаг 1.1: Получение LoginChallenge...')
    const formData1 = new URLSearchParams()
    formData1.append('response_type', 'code')
    formData1.append('grant_type', 'refresh_token')
    formData1.append('scope', 'offline')
    formData1.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
    formData1.append('prompt', 'consent')
    formData1.append('state', 'Qm2WdqqCf0sUyqaiCOWWDrGOOKcYdvOV')

    const response1 = await fetch('https://admin.mob-cash.com/hydra/oauth2/auth', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
        'Connection': 'keep-alive',
        'Origin': 'https://app.mob-cash.com/',
        'Referer': 'https://app.mob-cash.com/login',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData1,
      redirect: 'manual',
    })

    // Извлекаем cookies
    const setCookie1 = response1.headers.get('set-cookie')
    if (setCookie1) {
      const cookieParts = setCookie1.split(',').map(c => c.trim())
      const cookieValues = cookieParts.map(cookie => cookie.split(';')[0].trim()).filter(c => c)
      cookies = cookieValues.join('; ')
      console.log(`✅ Cookies получены: ${cookies.substring(0, 80)}...`)
    } else {
      console.warn('⚠️ Cookies не получены из первого запроса')
    }

    // Извлекаем LoginChallenge
    if (response1.status === 302 || response1.status === 301) {
      const location = response1.headers.get('location')
      if (location) {
        const urlParams = new URLSearchParams(location.split('?')[1] || '')
        loginChallenge = urlParams.get('login_challenge') || ''
      }
    }

    if (!loginChallenge) {
      const responseText = await response1.text()
      try {
        const data = JSON.parse(responseText)
        if (data.LoginChallenge) {
          loginChallenge = data.LoginChallenge
        }
      } catch (e) {
        // Не JSON
      }
    }

    if (!loginChallenge) {
      throw new Error('Не удалось получить LoginChallenge')
    }

    console.log(`✅ LoginChallenge: ${loginChallenge}`)
    console.log()

    // Шаг 1.2: Получение ConsentChallenge
    console.log('🔐 Шаг 1.2: Получение ConsentChallenge...')
    const formData2 = new URLSearchParams()
    formData2.append('nickname', MOBCASH_LOGIN)
    formData2.append('password', MOBCASH_PASSWORD)
    formData2.append('state', '547f6922-61ec-47f8-8718-c7928dd8f6eb')
    formData2.append('remember_me', 'true')

    const headers2: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Origin': 'https://app.mob-cash.com/',
      'Referer': 'https://app.mob-cash.com//login',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    if (cookies) {
      headers2['Cookie'] = cookies
      console.log(`📤 Отправляем cookies: ${cookies.substring(0, 80)}...`)
    } else {
      console.warn('⚠️ Cookies отсутствуют - запрос может не пройти')
    }

    const response2 = await fetch(
      `https://admin.mob-cash.com/authentication/login?login_challenge=${loginChallenge}`,
      {
        method: 'POST',
        headers: headers2,
        body: formData2,
        redirect: 'manual', // Не следуем редиректам автоматически
      }
    )

    // Обновляем cookies
    const setCookie2 = response2.headers.get('set-cookie')
    if (setCookie2) {
      const cookieParts = setCookie2.split(',').map(c => c.trim())
      const cookieValues = cookieParts.map(cookie => cookie.split(';')[0].trim()).filter(c => c)
      if (cookieValues.length > 0) {
        const existingCookies = cookies ? cookies.split('; ') : []
        const allCookies = [...existingCookies, ...cookieValues]
        const uniqueCookies = new Map<string, string>()
        allCookies.forEach(cookie => {
          const [name] = cookie.split('=')
          if (name) uniqueCookies.set(name, cookie)
        })
        cookies = Array.from(uniqueCookies.values()).join('; ')
        console.log(`✅ Cookies обновлены: ${cookies.substring(0, 80)}...`)
      }
    }

    // Проверяем редирект - после логина должен быть редирект с login_verifier
    if (response2.status === 302 || response2.status === 301) {
      const location = response2.headers.get('location')
      console.log(`📍 Редирект после логина: ${location}`)
      
      if (location) {
        const urlParams = new URLSearchParams(location.split('?')[1] || '')
        const loginVerifier = urlParams.get('login_verifier')
        
        if (loginVerifier) {
          console.log(`✅ Login Verifier получен: ${loginVerifier}`)
          
          // Следуем редиректу для получения consent challenge
          const redirectResponse = await fetch(location, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Cookie': cookies,
            },
            redirect: 'manual',
          })
          
          // Извлекаем consent_challenge из редиректа или ответа
          if (redirectResponse.status === 302 || redirectResponse.status === 301) {
            const consentLocation = redirectResponse.headers.get('location')
            if (consentLocation) {
              const consentParams = new URLSearchParams(consentLocation.split('?')[1] || '')
              consentChallenge = consentParams.get('consent_challenge') || ''
            }
          } else {
            const redirectText = await redirectResponse.text()
            try {
              const redirectData = JSON.parse(redirectText)
              if (redirectData.ConsentChallenge) {
                consentChallenge = redirectData.ConsentChallenge
              }
            } catch (e) {
              // Не JSON
            }
          }
        }
      }
    }

    // Если не получили через редирект, пробуем из JSON ответа
    if (!consentChallenge && response2.ok) {
      try {
        const data2 = await response2.json()
        if (data2.ConsentChallenge) {
          consentChallenge = data2.ConsentChallenge
        }
      } catch (e) {
        // Не JSON или уже прочитали
      }
    }

    if (!consentChallenge) {
      throw new Error('ConsentChallenge not found after login')
    }
    
    console.log(`✅ ConsentChallenge: ${consentChallenge}`)
    console.log()

    // Шаг 1.3: Получение access_token через consent challenge
    console.log('🔐 Шаг 1.3: Получение access_token...')
    const formData3 = new URLSearchParams()
    formData3.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
    formData3.append('grant_scope', 'offline')
    formData3.append('state', '547f6922-61ec-47f8-8718-c7928dd8f6eb')

    const headers3: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en,ru;q=0.9,ru-RU;q=0.8,en-US;q=0.7',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Origin': 'https://app.mob-cash.com',
      'Referer': 'https://app.mob-cash.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    if (cookies) {
      headers3['Cookie'] = cookies
    }

    // Пробуем получить токен через consent endpoint
    const response3 = await fetch(
      `https://admin.mob-cash.com/authentication/consent?consent_challenge=${consentChallenge}`,
      {
        method: 'POST',
        headers: headers3,
        body: formData3,
        redirect: 'manual', // Не следуем редиректам автоматически
      }
    )

    // Проверяем редирект - должен быть код авторизации в URL
    if (response3.status === 302 || response3.status === 301) {
      let location = response3.headers.get('location')
      console.log(`📍 Редирект после consent: ${location}`)
      
      // Следуем редиректу, чтобы получить код авторизации
      if (location) {
        let currentLocation = location
        let authCode = ''
        
        // Следуем редиректу с consent_verifier для получения кода авторизации
        const redirectResponse = await fetch(currentLocation, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Cookie': cookies,
          },
          redirect: 'follow', // Следуем всем редиректам автоматически
        })
        
        // Проверяем финальный URL на наличие кода
        const finalUrl = redirectResponse.url
        console.log(`📍 Финальный URL после редиректов: ${finalUrl}`)
        
        // Проверяем, есть ли ошибка в URL
        if (finalUrl && finalUrl.includes('error=')) {
          const urlParams = new URLSearchParams(finalUrl.split('?')[1] || '')
          const error = urlParams.get('error')
          const errorDesc = urlParams.get('error_description')
          console.error(`❌ Ошибка в редиректе: ${error}`)
          console.error(`   Описание: ${errorDesc}`)
          throw new Error(`OAuth2 error: ${error} - ${errorDesc}`)
        }
        
        if (finalUrl) {
          const urlParams = new URLSearchParams(finalUrl.split('?')[1] || '')
          const code = urlParams.get('code')
          if (code) {
            authCode = code
          }
          
          // Если код не в URL, проверяем тело ответа
          if (!authCode) {
            try {
              const redirectText = await redirectResponse.text()
              const redirectData = JSON.parse(redirectText)
              if (redirectData.code) {
                authCode = redirectData.code
              }
            } catch (e) {
              // Не JSON
            }
          }
        }
        
        if (authCode && typeof authCode === 'string') {
          console.log(`✅ Authorization code получен: ${authCode.substring(0, 20)}...`)
          
          // Обмениваем код на токен через OAuth2 token endpoint
          const tokenFormData = new URLSearchParams()
          tokenFormData.append('grant_type', 'authorization_code')
          tokenFormData.append('code', authCode)
          tokenFormData.append('client_id', '4e779103-d67b-42ef-bc9d-ab5ecdec40f8')
          tokenFormData.append('redirect_uri', 'https://app.mob-cash.com')
          
          const tokenResponse = await fetch('https://admin.mob-cash.com/hydra/oauth2/token', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenFormData,
          })
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json()
            if (tokenData.access_token) {
              accessToken = tokenData.access_token
              console.log(`✅ Access Token получен через OAuth2 token endpoint`)
            } else {
              console.error('❌ access_token не найден в ответе token endpoint:', tokenData)
            }
          } else {
            const errorText = await tokenResponse.text()
            console.error(`❌ Ошибка обмена кода на токен: ${tokenResponse.status}`)
            console.error(`   Ответ: ${errorText}`)
          }
        } else {
          console.warn('⚠️ Код авторизации не найден в редиректах')
        }
      }
    }

    // Если не получили через редирект, пробуем из JSON ответа
    if (!accessToken && response3.ok) {
      try {
        const data3 = await response3.json()
        if (data3.access_token) {
          accessToken = data3.access_token
          console.log(`✅ Access Token получен из JSON ответа`)
        } else {
          console.error('❌ access_token не найден в ответе:', data3)
        }
      } catch (e) {
        // Не JSON или уже прочитали
      }
    }

    if (!accessToken) {
      const errorText = response3.ok ? '' : await response3.text()
      console.error(`❌ Не удалось получить access_token`)
      console.error(`   Статус: ${response3.status}`)
      if (errorText) {
        console.error(`   Ответ: ${errorText}`)
      }
      throw new Error(`Failed to get access token: ${response3.status}`)
    }
    console.log(`✅ Access Token: ${accessToken.substring(0, 50)}...`)
    console.log()

    // Шаг 1.4: Получение userID
    console.log('🔐 Шаг 1.4: Получение userID...')
    const requestBody4 = JSON.stringify([
      {
        jsonrpc: '2.0',
        id: 11,
        method: 'user.profile',
        params: {},
      },
    ])

    const response4 = await fetch('https://admin.mob-cash.com/api/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Authorization': `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Origin': 'https://app.mob-cash.com',
        'Referer': 'https://app.mob-cash.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
        'x-request-source': 'pwa',
      },
      body: requestBody4,
    })

    if (!response4.ok) {
      const errorText = await response4.text()
      console.error(`❌ Ошибка получения userID: ${response4.status}`)
      console.error(`   Ответ: ${errorText}`)
      throw new Error(`Failed to get user profile: ${response4.status}`)
    }

    const data4 = await response4.json()
    if (!data4[0]?.result?.id) {
      console.error('❌ userID не найден в ответе:', data4)
      throw new Error('userID not found in response')
    }

    userID = data4[0].result.id
    console.log(`✅ User ID: ${userID}`)
    console.log()

    // Шаг 1.5: Логин на кассу (получение sessionID)
    console.log('🔐 Шаг 1.5: Логин на кассу (получение sessionID)...')
    const requestBody5 = JSON.stringify([
      {
        jsonrpc: '2.0',
        id: 12,
        method: 'mobile.login',
        params: {
          location: {
            lat: MOBCASH_DEFAULT_LAT,
            lon: MOBCASH_DEFAULT_LON,
          },
          cashboxCode: parseInt(MOBCASH_CASHDESK_ID),
          userID: userID,
        },
      },
    ])

    const response5 = await fetch('https://admin.mob-cash.com/api/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Authorization': `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'Origin': 'https://app.mob-cash.com',
        'Referer': 'https://app.mob-cash.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
        'x-request-source': 'pwa',
      },
      body: requestBody5,
    })

    if (!response5.ok) {
      const errorText = await response5.text()
      console.error(`❌ Ошибка логина на кассу: ${response5.status}`)
      console.error(`   Ответ: ${errorText}`)
      throw new Error(`Failed to login to cashbox: ${response5.status}`)
    }

    const data5 = await response5.json()
    // sessionID может быть в разных местах ответа
    sessionID = data5[0]?.result?.sessionID || data5[0]?.result?.session_id || data5[0]?.result?.id || ''

    if (!sessionID) {
      console.warn('⚠️ sessionID не найден в ответе, но запрос успешен')
      console.log('   Полный ответ:', JSON.stringify(data5, null, 2))
    } else {
      console.log(`✅ Session ID: ${sessionID}`)
    }
    console.log()

    // Итоговый результат
    console.log('=' .repeat(60))
    console.log('✅ АВТОРИЗАЦИЯ УСПЕШНА!')
    console.log()
    console.log('📋 Полученные токены:')
    console.log(`   Bearer Token: ${accessToken}`)
    console.log(`   User ID: ${userID}`)
    console.log(`   Session ID: ${sessionID || 'не найден'}`)
    console.log()
    console.log('📝 Добавьте в .env файл:')
    console.log(`MOBCASH_BEARER_TOKEN="${accessToken}"`)
    console.log(`MOBCASH_USER_ID="${userID}"`)
    if (sessionID) {
      console.log(`MOBCASH_SESSION_ID="${sessionID}"`)
    }
    console.log()

  } catch (error: any) {
    console.error('❌ ОШИБКА:', error.message)
    console.error('   Stack:', error.stack)
    process.exit(1)
  }
}

// Запуск теста
testMobCashAuth().catch(console.error)

