# Исправление проблемы с потерей символа @ в импортах

## Проблема
Webpack на сервере пытается разрешить `'a/lib/...'` вместо `'@/lib/...'` - символ `@` теряется при сборке.

## Причины
1. Кеш сборки (.next, node_modules/.cache)
2. Неправильная конфигурация webpack alias
3. Отсутствие или неправильная настройка tsconfig.json/jsconfig.json

## Решение

### Автоматическое (рекомендуется)
```bash
cd /var/www/luxon/admin_nextjs
chmod +x rebuild-server.sh
./rebuild-server.sh
```

### Ручное выполнение

#### 1. Очистка всех кешей
```bash
cd /var/www/luxon/admin_nextjs
rm -rf .next
rm -rf node_modules/.cache
rm -rf tsconfig.tsbuildinfo
rm -rf .swc
rm -rf .turbo
```

#### 2. Получение последних изменений
```bash
git pull origin main
```

#### 3. Проверка конфигурации

**tsconfig.json** должен содержать:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**jsconfig.json** должен содержать:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**next.config.js** должен содержать webpack alias:
```javascript
webpack: (config) => {
  const path = require('path')
  const rootPath = path.resolve(__dirname)
  
  if (!config.resolve) {
    config.resolve = {}
  }
  
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    '@': rootPath,
  }
  
  return config
}
```

#### 4. Переустановка зависимостей (если проблема сохраняется)
```bash
rm -rf node_modules
npm install
```

#### 5. Пересборка
```bash
npm run build
```

#### 6. Перезапуск PM2
```bash
pm2 restart luxon-admin
```

## Проверка

После выполнения всех шагов проверьте:
1. Сборка прошла успешно: `npm run build` без ошибок
2. PM2 процесс запущен: `pm2 list` показывает `luxon-admin` в статусе `online`
3. Логи не содержат ошибок: `pm2 logs luxon-admin --lines 50`

## Дополнительная диагностика

Если проблема сохраняется:

1. Проверьте версию Node.js: `node -v` (должна быть 18.x или выше)
2. Проверьте версию npm: `npm -v`
3. Проверьте переменные окружения: `env | grep NODE_ENV`
4. Проверьте, что файлы обновились: `git log --oneline -5`
5. Проверьте содержимое next.config.js: `cat next.config.js | grep -A 10 "webpack"`

## Примечания

- Все конфигурационные файлы должны быть в git
- После изменений в конфигурации всегда очищайте кеши
- Скрипт `rebuild-server.sh` автоматизирует все эти шаги

