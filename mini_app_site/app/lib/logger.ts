/**
 * Centralized logging system
 * Provides structured logging with levels (dev/prod)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDevelopment = process.env.NODE_ENV === 'development'
const isClient = typeof window !== 'undefined'

/**
 * Logger configuration
 */
const config = {
  enabled: true,
  level: isDevelopment ? 'debug' : 'error',
  showTimestamp: isDevelopment,
  showLevel: isDevelopment,
}

/**
 * Get log level priority
 */
function getLevelPriority(level: LogLevel): number {
  const priorities: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }
  return priorities[level] || 0
}

/**
 * Check if log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false
  const currentPriority = getLevelPriority(config.level as LogLevel)
  const messagePriority = getLevelPriority(level)
  return messagePriority >= currentPriority
}

/**
 * Format log message
 */
function formatMessage(level: LogLevel, message: string, ...args: any[]): string {
  const parts: string[] = []
  
  if (config.showTimestamp) {
    parts.push(`[${new Date().toISOString()}]`)
  }
  
  if (config.showLevel) {
    parts.push(`[${level.toUpperCase()}]`)
  }
  
  parts.push(message)
  
  return parts.join(' ')
}

/**
 * Logger interface
 */
export const logger = {
  /**
   * Debug level - only in development
   */
  debug(message: string, ...args: any[]): void {
    if (!shouldLog('debug')) return
    if (isClient) {
      console.debug(formatMessage('debug', message), ...args)
    } else {
      console.log(formatMessage('debug', message), ...args)
    }
  },

  /**
   * Info level - informational messages
   */
  info(message: string, ...args: any[]): void {
    if (!shouldLog('info')) return
    console.log(formatMessage('info', message), ...args)
  },

  /**
   * Warn level - warnings
   */
  warn(message: string, ...args: any[]): void {
    if (!shouldLog('warn')) return
    console.warn(formatMessage('warn', message), ...args)
  },

  /**
   * Error level - errors (always shown)
   */
  error(message: string, ...args: any[]): void {
    if (!shouldLog('error')) return
    console.error(formatMessage('error', message), ...args)
  },

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    config.level = level
  },

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    config.enabled = enabled
  },
}

export default logger

