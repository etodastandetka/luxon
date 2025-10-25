#!/usr/bin/env python
import os
import stat

def fix_database_permissions():
    """Исправляем права доступа к базе данных"""
    db_path = 'admin.sqlite3'
    
    if os.path.exists(db_path):
        # Устанавливаем права на чтение и запись для всех
        os.chmod(db_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH)
        print(f"✅ Права доступа к {db_path} исправлены")
    else:
        print(f"❌ Файл {db_path} не найден")
    
    # Проверяем права
    if os.path.exists(db_path):
        file_stat = os.stat(db_path)
        permissions = oct(file_stat.st_mode)[-3:]
        print(f"Текущие права: {permissions}")

if __name__ == "__main__":
    fix_database_permissions()
