#!/bin/bash
# Простые команды для разрешения конфликтов
cd /var/www/ls/admin_nextjs
git reset --hard HEAD
git pull
npm install
npm run db:generate
npm run build
pm2 restart luxon-admin

