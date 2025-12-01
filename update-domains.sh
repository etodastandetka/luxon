#!/bin/bash

# Скрипт для обновления всех упоминаний старых доменов на новые
# Старый домен: xendro.pro
# Новый домен админки: japar.click
# Новый домен клиентского сайта: luxon.dad

echo "🔄 Обновление доменов в проекте..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для замены в файле
replace_in_file() {
    local file=$1
    local old=$2
    local new=$3
    
    if [ -f "$file" ]; then
        # Создаем резервную копию
        cp "$file" "$file.bak"
        
        # Заменяем
        sed -i "s|$old|$new|g" "$file"
        
        echo -e "${GREEN}✓${NC} Обновлен: $file"
    fi
}

# Обновление админки
echo -e "\n${YELLOW}📁 Обновление админки (admin_nextjs)...${NC}"

# Обновление payment route
replace_in_file "admin_nextjs/app/api/payment/route.ts" \
    "https://xendro.pro" \
    "https://japar.click"

# Обновление README
replace_in_file "admin_nextjs/README.md" \
    "xendro.pro" \
    "japar.click"

# Обновление VIDEO_INSTRUCTIONS_SETUP.md
replace_in_file "admin_nextjs/VIDEO_INSTRUCTIONS_SETUP.md" \
    "xendro.pro" \
    "japar.click"

# Обновление клиентского сайта
echo -e "\n${YELLOW}📁 Обновление клиентского сайта (bot2/mini_app_site)...${NC}"

# Обновление config/api.js
replace_in_file "bot2/mini_app_site/config/api.js" \
    "https://xendro.pro" \
    "https://japar.click"

# Обновление utils/fetch.ts
replace_in_file "bot2/mini_app_site/utils/fetch.ts" \
    "https://xendro.pro" \
    "https://japar.click"

replace_in_file "bot2/mini_app_site/utils/fetch.ts" \
    "xendro.pro в продакшене" \
    "japar.click в продакшене"

# Обновление ботов
echo -e "\n${YELLOW}📁 Обновление ботов...${NC}"

replace_in_file "bot_simple/bot.py" \
    "https://xendro.pro" \
    "https://japar.click"

replace_in_file "bot_1xbet/bot.py" \
    "https://xendro.pro" \
    "https://japar.click"

# Обновление req (Android приложение)
echo -e "\n${YELLOW}📁 Обновление Android приложения (req)...${NC}"

replace_in_file "req/app/src/main/java/com/req/notificationreader/util/DatabaseConfig.kt" \
    "https://xendro.pro" \
    "https://japar.click"

replace_in_file "req/api_server.js" \
    "https://xendro.pro" \
    "https://japar.click"

echo -e "\n${GREEN}✅ Обновление завершено!${NC}"
echo -e "${YELLOW}⚠️  Резервные копии сохранены с расширением .bak${NC}"
echo -e "${YELLOW}📝 Проверьте изменения перед коммитом: git diff${NC}"

