# Как получить APK файл

## Способ 1: Через Android Studio (РЕКОМЕНДУЕТСЯ)

### Шаги:
1. Откройте проект в **Android Studio**
2. Дождитесь завершения синхронизации Gradle (внизу экрана)
3. В меню выберите: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
4. Дождитесь завершения сборки
5. Появится уведомление "Build finished" с кнопкой **Locate**
6. Нажмите **Locate** - откроется папка с APK файлом

### Расположение APK:
```
app/build/outputs/apk/debug/app-debug.apk
```

## Способ 2: Через командную строку

### Если у вас установлен Gradle:

```powershell
# Windows PowerShell
.\gradlew.bat assembleDebug
```

### Если Gradle wrapper еще не создан:

1. Android Studio автоматически создаст его при первом открытии проекта
2. Или выполните: `gradle wrapper` (если Gradle установлен глобально)

### После сборки APK будет здесь:
```
app\build\outputs\apk\debug\app-debug.apk
```

## Способ 3: Через Android Studio - Generate Signed Bundle/APK

Для **Release** версии (для публикации):

1. **Build** → **Generate Signed Bundle / APK**
2. Выберите **APK**
3. Создайте или выберите Keystore
4. Выберите **release** build variant
5. Нажмите **Finish**

Release APK будет здесь:
```
app\build\outputs\apk\release\app-release.apk
```

## Примечания:

- **Debug APK** - для тестирования, не требует подписи
- **Release APK** - для распространения, требует подписи (keystore)
- После первой сборки Android Studio автоматически создаст все необходимые файлы Gradle Wrapper

## Установка APK на устройство:

1. Скопируйте APK файл на Android устройство
2. Откройте файл на устройстве
3. Разрешите установку из неизвестных источников (если требуется)
4. Нажмите "Установить"

Или через USB:
1. Включите "Отладка по USB" в настройках разработчика
2. Подключите устройство
3. В Android Studio: **Run** → **Run 'app'**

