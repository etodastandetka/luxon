/**
 * Polyfills для поддержки старых браузеров и устройств
 * Загружается перед основным кодом приложения
 */

// Проверка поддержки необходимых функций
const needsPolyfills = (): boolean => {
  if (typeof window === 'undefined') return false
  
  // Проверяем критические функции
  const checks = {
    fetch: typeof fetch === 'undefined',
    Promise: typeof Promise === 'undefined',
    ObjectAssign: typeof Object.assign === 'undefined',
    ArrayFrom: typeof Array.from === 'undefined',
    StringIncludes: typeof String.prototype.includes === 'undefined',
    ArrayIncludes: typeof Array.prototype.includes === 'undefined',
    URLSearchParams: typeof URLSearchParams === 'undefined',
  }
  
  return Object.values(checks).some(check => check === true)
}

// Полифилл для fetch
if (typeof window !== 'undefined' && typeof fetch === 'undefined') {
  // Используем XMLHttpRequest как fallback
  (window as any).fetch = function(url: string, options: any = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(options.method || 'GET', url, true)
      
      // Устанавливаем заголовки
      if (options.headers) {
        Object.keys(options.headers).forEach(key => {
          xhr.setRequestHeader(key, options.headers[key])
        })
      }
      
      xhr.onload = function() {
        const response: any = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {},
          text: () => Promise.resolve(xhr.responseText),
          json: () => Promise.resolve(JSON.parse(xhr.responseText)),
        }
        
        // Парсим заголовки
        const headers = xhr.getAllResponseHeaders()
        if (headers) {
          headers.split('\r\n').forEach(line => {
            const parts = line.split(': ')
            if (parts.length === 2) {
              response.headers[parts[0].toLowerCase()] = parts[1]
            }
          })
        }
        
        resolve(response)
      }
      
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.ontimeout = () => reject(new Error('Timeout'))
      
      if (options.timeout) {
        xhr.timeout = options.timeout
      }
      
      xhr.send(options.body || null)
    })
  }
}

// Полифилл для Promise (если нужен)
if (typeof window !== 'undefined' && typeof Promise === 'undefined') {
  // Минимальный полифилл Promise (упрощенный)
  (window as any).Promise = function(executor: any) {
    const self: any = this
    self.state = 'pending'
    self.value = undefined
    self.handlers = []
    
    function resolve(result: any) {
      if (self.state === 'pending') {
        self.state = 'fulfilled'
        self.value = result
        self.handlers.forEach(handle)
        self.handlers = null
      }
    }
    
    function reject(error: any) {
      if (self.state === 'pending') {
        self.state = 'rejected'
        self.value = error
        self.handlers.forEach(handle)
        self.handlers = null
      }
    }
    
    function handle(handler: any) {
      if (self.state === 'pending') {
        self.handlers.push(handler)
      } else {
        if (self.state === 'fulfilled' && typeof handler.onFulfilled === 'function') {
          handler.onFulfilled(self.value)
        }
        if (self.state === 'rejected' && typeof handler.onRejected === 'function') {
          handler.onRejected(self.value)
        }
      }
    }
    
    self.then = function(onFulfilled: any, onRejected: any) {
      return new (window as any).Promise(function(resolve: any, reject: any) {
        handle({
          onFulfilled: function(result: any) {
            try {
              resolve(onFulfilled ? onFulfilled(result) : result)
            } catch (ex) {
              reject(ex)
            }
          },
          onRejected: function(error: any) {
            try {
              resolve(onRejected ? onRejected(error) : error)
            } catch (ex) {
              reject(ex)
            }
          }
        })
      })
    }
    
    executor(resolve, reject)
  }
}

// Полифилл для Object.assign
if (typeof window !== 'undefined' && typeof Object.assign !== 'function') {
  Object.assign = function(target: any, ...sources: any[]) {
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object')
    }
    
    const to = Object(target)
    
    for (let index = 0; index < sources.length; index++) {
      const nextSource = sources[index]
      
      if (nextSource != null) {
        for (const nextKey in nextSource) {
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey]
          }
        }
      }
    }
    return to
  }
}

// Полифилл для Array.from
if (typeof window !== 'undefined' && typeof Array.from !== 'function') {
  Array.from = function(arrayLike: any, mapFn?: any, thisArg?: any) {
    const C = this
    const items = Object(arrayLike)
    
    if (arrayLike == null) {
      throw new TypeError('Array.from requires an array-like object - not null or undefined')
    }
    
    const mapFunction = mapFn !== undefined ? mapFn : undefined
    let T: any
    if (typeof mapFunction !== 'undefined') {
      if (typeof mapFunction !== 'function') {
        throw new TypeError('Array.from: when provided, the second argument must be a function')
      }
      if (arguments.length > 2) {
        T = thisArg
      }
    }
    
    const len = parseInt(items.length, 10) || 0
    const A = typeof C === 'function' ? Object(new C(len)) : new Array(len)
    let k = 0
    let kValue: any
    
    while (k < len) {
      kValue = items[k]
      if (mapFunction) {
        A[k] = typeof T === 'undefined' ? mapFunction(kValue, k) : mapFunction.call(T, kValue, k)
      } else {
        A[k] = kValue
      }
      k += 1
    }
    A.length = len
    return A
  }
}

// Полифилл для String.prototype.includes
if (typeof window !== 'undefined' && typeof String.prototype.includes !== 'function') {
  String.prototype.includes = function(search: string, start?: number): boolean {
    if (typeof start !== 'number') {
      start = 0
    }
    
    if (start + search.length > this.length) {
      return false
    } else {
      return this.indexOf(search, start) !== -1
    }
  }
}

// Полифилл для Array.prototype.includes
if (typeof window !== 'undefined' && typeof Array.prototype.includes !== 'function') {
  Array.prototype.includes = function(searchElement: any, fromIndex?: number): boolean {
    const O = Object(this)
    const len = parseInt(O.length, 10) || 0
    if (len === 0) {
      return false
    }
    const n = parseInt(fromIndex as any, 10) || 0
    let k: number
    if (n >= 0) {
      k = n
    } else {
      k = len + n
      if (k < 0) {
        k = 0
      }
    }
    function sameValueZero(x: any, y: any): boolean {
      return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y))
    }
    for (; k < len; k++) {
      if (sameValueZero(O[k], searchElement)) {
        return true
      }
    }
    return false
  }
}

// Полифилл для URLSearchParams
if (typeof window !== 'undefined' && typeof URLSearchParams === 'undefined') {
  (window as any).URLSearchParams = class URLSearchParams {
    private params: { [key: string]: string[] } = {}
    
    constructor(init?: string | { [key: string]: string }) {
      if (typeof init === 'string') {
        if (init.startsWith('?')) {
          init = init.substring(1)
        }
        init.split('&').forEach(pair => {
          const [key, value] = pair.split('=')
          if (key) {
            const decodedKey = decodeURIComponent(key)
            const decodedValue = value ? decodeURIComponent(value) : ''
            if (!this.params[decodedKey]) {
              this.params[decodedKey] = []
            }
            this.params[decodedKey].push(decodedValue)
          }
        })
      } else if (init) {
        Object.keys(init).forEach(key => {
          this.params[key] = [init[key]]
        })
      }
    }
    
    get(name: string): string | null {
      const values = this.params[name]
      return values && values.length > 0 ? values[0] : null
    }
    
    getAll(name: string): string[] {
      return this.params[name] || []
    }
    
    set(name: string, value: string): void {
      this.params[name] = [value]
    }
    
    append(name: string, value: string): void {
      if (!this.params[name]) {
        this.params[name] = []
      }
      this.params[name].push(value)
    }
    
    delete(name: string): void {
      delete this.params[name]
    }
    
    has(name: string): boolean {
      return name in this.params
    }
    
    toString(): string {
      const pairs: string[] = []
      Object.keys(this.params).forEach(key => {
        this.params[key].forEach(value => {
          pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value))
        })
      })
      return pairs.join('&')
    }
  }
}

// Safe optional chaining helper для старых браузеров
if (typeof window !== 'undefined') {
  (window as any).safeGet = function(obj: any, path: string, defaultValue: any = null) {
    const keys = path.split('.')
    let current = obj
    for (let i = 0; i < keys.length; i++) {
      if (current == null || typeof current !== 'object') {
        return defaultValue
      }
      current = current[keys[i]]
    }
    return current !== undefined ? current : defaultValue
  }
}

export { needsPolyfills }

