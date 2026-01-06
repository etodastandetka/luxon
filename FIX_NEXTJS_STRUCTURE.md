# Исправление структуры Next.js App Router

## Проблема:
Next.js 14 требует папку `app` внутри проекта для App Router. Файлы должны быть в `/var/www/luxon/app/app/`, а не в `/var/www/luxon/app/`.

## Решение на сервере:

```bash
cd /var/www/luxon/app

# Создайте папку app для роутинга
mkdir -p app

# Переместите файлы роутинга
mv page.tsx app/
mv layout.tsx app/
mv not-found.tsx app/
mv globals.css app/

# Переместите папки с роутами
mv blocked app/
mv deposit app/
mv faq app/
mv history app/
mv instruction app/
mv language app/
mv privacy app/
mv profile app/
mv rating app/
mv referral app/
mv support app/
mv withdraw app/

# Переместите API роуты
mv api app/

# Проверьте структуру
ls -la app/

# Теперь соберите
npm run build
```

## Или используйте скрипт:

```bash
cd /var/www/luxon
git pull
chmod +x FIX_NEXTJS_APP_DIR.sh
bash FIX_NEXTJS_APP_DIR.sh
npm run build
```

## Правильная структура должна быть:

```
/var/www/luxon/app/
├── app/              ← папка для Next.js роутинга
│   ├── page.tsx
│   ├── layout.tsx
│   ├── api/
│   ├── deposit/
│   └── ...
├── components/
├── config/
├── lib/
├── public/
├── package.json
└── next.config.js
```

