# Решение проблемы с git pull при локальных изменениях

## Проблема
При выполнении `git pull` появляется ошибка:
```
error: Your local changes to the following files would be overwritten by merge:
    nginx/setup_ssl.sh
Please commit your changes or stash them before you merge.
```

## Решение

На сервере выполните один из вариантов:

### Вариант 1: Сохранить изменения и обновить (рекомендуется)

```bash
cd /var/www/luxon

# Сохранить локальные изменения
git stash

# Обновить репозиторий
git pull

# Применить сохраненные изменения (если нужны)
git stash pop
```

### Вариант 2: Отбросить локальные изменения (если они не нужны)

```bash
cd /var/www/luxon

# Отбросить локальные изменения в setup_ssl.sh
git checkout -- nginx/setup_ssl.sh

# Обновить репозиторий
git pull
```

### Вариант 3: Закоммитить локальные изменения

```bash
cd /var/www/luxon

# Добавить изменения
git add nginx/setup_ssl.sh

# Закоммитить
git commit -m "Local changes to setup_ssl.sh"

# Обновить репозиторий (может потребоваться merge)
git pull
```

## После обновления

После успешного `git pull` проверьте, что файлы SSL конфигураций на месте:

```bash
ls -la /var/www/luxon/nginx/*.ssl.conf
```

Должны быть:
- `lux-on.org.ssl.conf`
- `pipiska.net.ssl.conf`

Затем запустите скрипт установки SSL:

```bash
cd /var/www/luxon

# Убедитесь, что файл существует и имеет права на выполнение
ls -la nginx/setup_ssl.sh

# Если прав нет, дайте их
chmod +x nginx/setup_ssl.sh

# Запустите скрипт (можно из любой директории)
sudo bash /var/www/luxon/nginx/setup_ssl.sh
```

Или из директории nginx:

```bash
cd /var/www/luxon/nginx

# Проверьте наличие файла
ls -la setup_ssl.sh

# Дайте права на выполнение
chmod +x setup_ssl.sh

# Запустите через bash (если ./ не работает)
sudo bash setup_ssl.sh
```

Если скрипт все еще выдает ошибку о том, что файлы не найдены, проверьте пути:

```bash
cd /var/www/luxon
find . -name "*.ssl.conf" -type f
```

Скрипт должен автоматически определить правильные пути.

