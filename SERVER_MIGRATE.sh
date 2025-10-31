#!/bin/bash
# Скрипт для применения миграций на сервере

cd /var/www/luxon
git pull origin main

cd django_admin
source venv/bin/activate

echo "Создаем новые миграции..."
python manage.py makemigrations bot_control

echo "Применяем миграции..."
python manage.py migrate

echo "Проверяем статус миграций..."
python manage.py showmigrations bot_control

deactivate
cd ..

echo "Перезапускаем Django..."
pm2 restart luxon-django-admin

echo "Готово! Проверьте статус:"
pm2 status

