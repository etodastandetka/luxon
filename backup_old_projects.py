#!/usr/bin/env python3
"""
Скрипт для создания бэкапа старых проектов на сервере
и безопасного удаления папки lux
"""

import os
import shutil
import tarfile
import datetime
import subprocess
import sys

def create_backup():
    """Создает бэкап старых проектов"""
    
    # Получаем текущую дату для имени бэкапа
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"old_projects_backup_{timestamp}.tar.gz"
    
    print(f"🔍 Проверяем структуру сервера...")
    
    # Проверяем, есть ли папка lux
    lux_path = "/home/user/lux"  # Предполагаемый путь на сервере
    if os.path.exists(lux_path):
        print(f"✅ Найдена папка: {lux_path}")
        
        # Создаем бэкап
        print(f"📦 Создаем бэкап: {backup_name}")
        
        try:
            with tarfile.open(backup_name, "w:gz") as tar:
                tar.add(lux_path, arcname="lux")
            print(f"✅ Бэкап создан: {backup_name}")
            
            # Перемещаем бэкап в безопасное место
            backup_dest = f"/home/user/backups/{backup_name}"
            os.makedirs("/home/user/backups", exist_ok=True)
            shutil.move(backup_name, backup_dest)
            print(f"✅ Бэкап перемещен в: {backup_dest}")
            
            return backup_dest
            
        except Exception as e:
            print(f"❌ Ошибка при создании бэкапа: {e}")
            return None
    else:
        print(f"⚠️  Папка {lux_path} не найдена")
        return None

def remove_old_lux_folder():
    """Удаляет старую папку lux после создания бэкапа"""
    
    lux_path = "/home/user/lux"
    
    if os.path.exists(lux_path):
        print(f"🗑️  Удаляем папку: {lux_path}")
        try:
            shutil.rmtree(lux_path)
            print(f"✅ Папка {lux_path} успешно удалена")
            return True
        except Exception as e:
            print(f"❌ Ошибка при удалении папки: {e}")
            return False
    else:
        print(f"⚠️  Папка {lux_path} не существует")
        return True

def main():
    """Основная функция"""
    
    print("🚀 Начинаем процесс бэкапа и очистки сервера...")
    
    # Создаем бэкап
    backup_path = create_backup()
    
    if backup_path:
        print(f"✅ Бэкап успешно создан: {backup_path}")
        
        # Спрашиваем подтверждение перед удалением
        confirm = input("❓ Удалить старую папку lux? (y/N): ").lower().strip()
        
        if confirm in ['y', 'yes', 'да']:
            if remove_old_lux_folder():
                print("✅ Процесс завершен успешно!")
                print(f"📦 Бэкап сохранен в: {backup_path}")
            else:
                print("❌ Ошибка при удалении папки")
        else:
            print("⏸️  Удаление отменено. Бэкап сохранен.")
    else:
        print("❌ Не удалось создать бэкап. Операция отменена.")

if __name__ == "__main__":
    main()
