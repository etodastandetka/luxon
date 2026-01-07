# Инструкция по обновлению на сервере

## Быстрое обновление (рекомендуется)

```bash
cd /var/www/ls/admin_nextjs
chmod +x update-server.sh
./update-server.sh
```

Этот скрипт:
1. Сохранит локальные изменения в stash
2. Обновит код из репозитория
3. Попытается применить сохраненные изменения
4. Установит зависимости (если нужно)
5. Сгенерирует Prisma Client
6. Соберет проект
7. Перезапустит PM2

## Обновление с отбрасыванием локальных изменений

Если локальные изменения не нужны:

```bash
cd /var/www/ls/admin_nextjs
chmod +x update-server-hard.sh
./update-server-hard.sh
```

## Ручное обновление

Если скрипты не работают:

```bash
cd /var/www/ls/admin_nextjs

# Сохранить изменения
git stash

# Обновить код
git pull

# Установить зависимости
npm install

# Сгенерировать Prisma Client
npm run db:generate

# Собрать проект
npm run build

# Перезапустить PM2
pm2 restart luxon-admin
```

## Проверка после обновления

```bash
# Проверить статус PM2
pm2 status

# Проверить логи
pm2 logs luxon-admin --lines 50

# Проверить ошибки
pm2 logs luxon-admin --err --lines 50
```

## Если есть ошибки сборки

1. Проверить логи PM2:
   ```bash
   pm2 logs luxon-admin --err
   ```

2. Проверить, что все зависимости установлены:
   ```bash
   cd /var/www/ls/admin_nextjs
   npm install
   ```

3. Проверить, что Prisma Client сгенерирован:
   ```bash
   npm run db:generate
   ```

4. Очистить кэш и пересобрать:
   ```bash
   npm run clean
   npm run build
   ```

5. Перезапустить:
   ```bash
   pm2 restart luxon-admin
   ```

