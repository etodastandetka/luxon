# Установка SSH на Windows

## Вариант 1: OpenSSH (встроенный в Windows 10/11) - РЕКОМЕНДУЕТСЯ

### Проверка наличия:
1. Откройте PowerShell от имени администратора
2. Выполните команду:
```powershell
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH*'
```

### Установка:
```powershell
# Установка OpenSSH Client
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0

# Установка OpenSSH Server (опционально, если нужен сервер)
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

### Проверка:
```powershell
ssh -V
```

## Вариант 2: Git Bash (если уже установлен Git)

Если у вас установлен Git for Windows, SSH уже включен в Git Bash.

### Использование:
1. Откройте Git Bash
2. Проверьте: `ssh -V`
3. Если работает - можно использовать Git Bash для подключений

## Вариант 3: PuTTY (альтернативный клиент)

1. Скачайте PuTTY: https://www.putty.org/
2. Установите стандартным способом
3. Используйте для подключения к серверу

## Вариант 4: WSL (Windows Subsystem for Linux)

Если у вас установлен WSL, там уже есть SSH:
```powershell
wsl ssh -V
```

## После установки

После установки SSH проверьте подключение:

```powershell
# Проверка подключения к серверу
ssh -o StrictHostKeyChecking=no root@147.45.99.111
```

При первом подключении введите пароль: `madSvQb*v*2rPU`

## Автоматизация с паролем (sshpass для Windows)

Для автоматизации можно установить sshpass через:

### Вариант A: Через Chocolatey
```powershell
# Установите Chocolatey если нет: https://chocolatey.org/install
choco install sshpass
```

### Вариант B: Через Scoop
```powershell
# Установите Scoop если нет: https://scoop.sh/
scoop install sshpass
```

### Вариант C: Использовать plink (из PuTTY)
Скачайте plink.exe и используйте:
```powershell
echo madSvQb*v*2rPU | plink.exe -ssh root@147.45.99.111 -pw madSvQb*v*2rPU "команда"
```

