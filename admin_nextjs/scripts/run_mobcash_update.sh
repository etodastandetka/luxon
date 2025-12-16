#!/bin/bash
# Wrapper скрипт для обновления токенов MobCash
# Используется для запуска через cron или PM2

cd /var/www/luxon/admin_nextjs
source venv/bin/activate
python3 scripts/update_mobcash_tokens.py

