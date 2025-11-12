import { prisma } from './prisma'
import { depositCashdeskAPI, depositMostbetAPI, depositMobCashAPI } from './casino-deposit'

// Функция для получения конфигурации API казино из настроек
export async function getCasinoConfig(bookmaker: string) {
  const normalizedBookmaker = bookmaker?.toLowerCase() || ''
  
  // Для Melbet нужны: hash, cashierpass, login, cashdeskid
  if (normalizedBookmaker.includes('melbet') || normalizedBookmaker === 'melbet') {
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: 'melbet_api_config' },
    })

    if (setting) {
      const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
      if (config.hash && config.cashierpass && config.login && config.cashdeskid) {
        return {
          hash: config.hash,
          cashierpass: config.cashierpass,
          login: config.login,
          cashdeskid: String(config.cashdeskid),
        }
      }
    }

    return {
      hash: process.env.MELBET_HASH || 'f788cc308d9de930b292873b2cf79526da363cb24a85883575426cc7f3c4553d',
      cashierpass: process.env.MELBET_CASHIERPASS || '3nKS3!b7',
      login: process.env.MELBET_LOGIN || 'burgoevk',
      cashdeskid: process.env.MELBET_CASHDESKID || '1415842',
    }
  }
  
  if (normalizedBookmaker.includes('winwin')) {
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: 'winwin_api_config' },
    })

    if (setting) {
      const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
      if (config.hash && config.cashierpass && config.login && config.cashdeskid) {
        return {
          hash: config.hash,
          cashierpass: config.cashierpass,
          login: config.login,
          cashdeskid: String(config.cashdeskid),
        }
      }
    }

    return {
      hash: process.env.WINWIN_HASH || 'ca4c49cea830e2fbebf7e3894659df1cd74abb2e0e79d58b17ecf82ea148cf2d',
      cashierpass: process.env.WINWIN_CASHIERPASS || 'yYRbyQeX',
      login: process.env.WINWIN_LOGIN || 'burgoevkan',
      cashdeskid: process.env.WINWIN_CASHDESKID || '1416579',
    }
  }

  // 888starz использует Cashdesk API
  if (normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: '888starz_api_config' },
    })

    if (setting) {
      const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
      if (config.hash && config.cashierpass && config.login && config.cashdeskid) {
        return {
          hash: config.hash,
          cashierpass: config.cashierpass,
          login: config.login,
          cashdeskid: String(config.cashdeskid),
        }
      }
    }

    // API KEY используется как hash
    return {
      hash: process.env['888STARZ_HASH'] || '6e978b90d2e3d7010390c680cf036b49e521bf91e32839021db8c3637f1cbc56',
      cashierpass: process.env['888STARZ_CASHIERPASS'] || 'ydsuHiK^',
      login: process.env['888STARZ_LOGIN'] || 'burgoevka',
      cashdeskid: process.env['888STARZ_CASHDESKID'] || '1416358',
    }
  }
  
  // Mostbet нужны: api_key, secret, cashpoint_id
  if (normalizedBookmaker.includes('mostbet') || normalizedBookmaker === 'mostbet') {
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: 'mostbet_api_config' },
    })

    if (setting) {
      const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
      if (config.api_key && config.secret && config.cashpoint_id) {
        return {
          api_key: config.api_key,
          secret: config.secret,
          cashpoint_id: String(config.cashpoint_id),
        }
      }
    }

    return {
      api_key: process.env.MOSTBET_API_KEY || 'api-key:62e9da4c-52e3-4d0f-b579-c9e7805f711d',
      secret: process.env.MOSTBET_SECRET || '94f63f7e-b7ff-4ef9-bccc-d05efa22301d',
      cashpoint_id: process.env.MOSTBET_CASHPOINT_ID || 'C131864', // Полный cashpoint_id с буквой C 
    }
  }

  return null
}

// Функция для получения конфигурации mob-cash для 1xbet
export async function getMobCashConfig(bookmaker: string): Promise<{
  login: string
  password: string
  cashdesk_id: string | number
  default_lat?: number
  default_lon?: number
  bearer_token?: string
  user_id?: string
  session_id?: string
} | null> {
  const normalizedBookmaker = bookmaker?.toLowerCase() || ''
  
  // Для 1xbet
  if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
    // Сначала пробуем получить из БД
    const setting = await prisma.botConfiguration.findFirst({
      where: { key: '1xbet_mobcash_config' },
    })

    if (setting) {
      const config = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value
      if (config.login && config.password && config.cashdesk_id) {
        return {
          login: config.login,
          password: config.password,
          cashdesk_id: String(config.cashdesk_id),
          default_lat: config.default_lat || parseFloat(process.env.MOBCASH_DEFAULT_LAT || '42.845778'),
          default_lon: config.default_lon || parseFloat(process.env.MOBCASH_DEFAULT_LON || '74.568778'),
          bearer_token: config.bearer_token,
          user_id: config.user_id,
          session_id: config.session_id,
        }
      }
    }

    // Fallback на переменные окружения или дефолтные значения
    return {
      login: process.env.MOBCASH_LOGIN || 'burgoevk',
      password: process.env.MOBCASH_PASSWORD || 'Kanat312###',
      cashdesk_id: process.env.MOBCASH_CASHDESK_ID || '1001098',
      default_lat: parseFloat(process.env.MOBCASH_DEFAULT_LAT || '42.845778'),
      default_lon: parseFloat(process.env.MOBCASH_DEFAULT_LON || '74.568778'),
      // Готовые токены (полученные через браузер) - см. MOBCASH_SETUP.md
      bearer_token: process.env.MOBCASH_BEARER_TOKEN,
      user_id: process.env.MOBCASH_USER_ID,
      session_id: process.env.MOBCASH_SESSION_ID,
    }
  }

  return null
}

// Функция для пополнения баланса через API казино
export async function depositToCasino(
  bookmaker: string,
  accountId: string,
  amount: number
): Promise<{ success: boolean; message: string; data?: any }> {
  const normalizedBookmaker = bookmaker?.toLowerCase() || ''

  try {
          // Для 1xbet используем mob-cash API
          if (normalizedBookmaker.includes('1xbet') || normalizedBookmaker === '1xbet') {
            const mobCashConfig = await getMobCashConfig(bookmaker)
            
            if (!mobCashConfig || !mobCashConfig.login || !mobCashConfig.password || !mobCashConfig.cashdesk_id) {
              return {
                success: false,
                message: `${bookmaker} mob-cash API configuration not found. Please configure ${normalizedBookmaker.includes('888') ? '888starz' : '1xbet'}_mobcash_config in database or set MOBCASH_* environment variables.`,
              }
            }

            // Логируем конфигурацию для отладки
            const hasAllTokens = 
              mobCashConfig.bearer_token && 
              mobCashConfig.bearer_token.trim() !== '' &&
              mobCashConfig.user_id && 
              mobCashConfig.user_id.trim() !== '' &&
              mobCashConfig.session_id && 
              mobCashConfig.session_id.trim() !== ''
            
            console.log('[Deposit Balance] Mob-cash config:', {
              has_all_tokens: hasAllTokens,
              has_bearer_token: !!(mobCashConfig.bearer_token && mobCashConfig.bearer_token.trim() !== ''),
              has_user_id: !!(mobCashConfig.user_id && mobCashConfig.user_id.trim() !== ''),
              has_session_id: !!(mobCashConfig.session_id && mobCashConfig.session_id.trim() !== ''),
              login: mobCashConfig.login,
              cashdesk_id: mobCashConfig.cashdesk_id,
            })
            
            if (!hasAllTokens) {
              console.warn('[Deposit Balance] ⚠️ Mob-cash tokens not fully configured. OAuth2 flow will fail without client_secret.')
              console.warn('[Deposit Balance] Please add MOBCASH_BEARER_TOKEN, MOBCASH_USER_ID, and MOBCASH_SESSION_ID to .env file.')
            }

            return await depositMobCashAPI(accountId, amount, mobCashConfig)
          }
    
    // Melbet, Winwin и 888starz используют Cashdesk API
    if (normalizedBookmaker.includes('melbet') || normalizedBookmaker.includes('winwin') ||
        normalizedBookmaker.includes('888starz') || normalizedBookmaker.includes('888') || normalizedBookmaker === '888starz') {
      const config = await getCasinoConfig(bookmaker)
      
      if (!config) {
        return {
          success: false,
          message: `${bookmaker} API configuration not found in database`,
        }
      }

      return await depositCashdeskAPI(bookmaker, accountId, amount, config)
    }
    
    // Mostbet использует свой API
    if (normalizedBookmaker.includes('mostbet')) {
      const config = await getCasinoConfig(bookmaker)
      
      if (!config) {
        return {
          success: false,
          message: 'Mostbet API configuration not found in database',
        }
      }

      return await depositMostbetAPI(accountId, amount, config)
    }
    
    // 1win (если нужно будет добавить)
    if (normalizedBookmaker.includes('1win')) {
      return {
        success: false,
        message: '1win API not yet implemented',
      }
    }

    return {
      success: false,
      message: `Unsupported bookmaker: ${bookmaker}`,
    }
  } catch (error: any) {
    console.error('Deposit balance error:', error)
    return {
      success: false,
      message: error.message || 'Failed to deposit balance',
    }
  }
}

