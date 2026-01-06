# Исправление структуры клиентского сайта

## Проблема:
Next.js не находит папку `app` или `pages`.

## Проверка на сервере:

```bash
cd /var/www/luxon/app

# Проверьте структуру
ls -la

# Должны быть файлы:
# - page.tsx
# - layout.tsx
# - package.json
# - next.config.js

# Проверьте что файлы есть
ls -la page.tsx layout.tsx
```

## Исправление:

Если файлов нет, обновите репозиторий:

```bash
cd /var/www/luxon
git pull origin main
```

Или переклонируйте:

```bash
cd /var/www
rm -rf luxon
git clone https://github.com/etodastandetka/ls.git luxon
cd /var/www/luxon/app
npm install
npm run build
```

## Проверка структуры перед сборкой:

```bash
cd /var/www/luxon/app

# Должны быть эти файлы:
test -f page.tsx && echo "✓ page.tsx exists" || echo "✗ page.tsx MISSING"
test -f layout.tsx && echo "✓ layout.tsx exists" || echo "✗ layout.tsx MISSING"
test -f package.json && echo "✓ package.json exists" || echo "✗ package.json MISSING"
test -f next.config.js && echo "✓ next.config.js exists" || echo "✗ next.config.js MISSING"
test -d api && echo "✓ api directory exists" || echo "✗ api directory MISSING"
```

Если все файлы на месте, попробуйте:

```bash
cd /var/www/luxon/app

# Очистка и пересборка
rm -rf .next node_modules
npm install
npm run build
```

