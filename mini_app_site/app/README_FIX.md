# Исправление ошибки 404 для chunks

## Проблема
Ошибка `GET http://localhost:3001/_next/static/chunks/main-app.js net::ERR_ABORTED 404` означает, что Next.js dev сервер не запущен или работает неправильно.

## Решение

1. **Очистите кеш Next.js:**
   ```powershell
   cd mini_app_site\app
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   ```

2. **Установите зависимости (если нужно):**
   ```powershell
   npm install
   ```

3. **Запустите dev сервер на порту 3001:**
   ```powershell
   npm run dev:3001
   ```

4. **Или на порту 3002 (по умолчанию):**
   ```powershell
   npm run dev
   ```

5. **Откройте браузер:**
   - Для порта 3001: http://localhost:3001
   - Для порта 3002: http://localhost:3002

## Если проблема сохраняется

1. Проверьте, не занят ли порт другим процессом
2. Перезапустите терминал
3. Убедитесь, что Node.js установлен: `node --version`
4. Проверьте, что все зависимости установлены: `npm install`

