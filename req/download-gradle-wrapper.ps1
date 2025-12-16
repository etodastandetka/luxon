# Скрипт для загрузки Gradle Wrapper
Write-Host "Загрузка Gradle Wrapper..."

$wrapperJarPath = "gradle\wrapper\gradle-wrapper.jar"
$gradleVersion = "8.2"

if (-not (Test-Path $wrapperJarPath)) {
    try {
        $url = "https://raw.githubusercontent.com/gradle/gradle/v${gradleVersion}.0/gradle/wrapper/gradle-wrapper.jar"
        Invoke-WebRequest -Uri $url -OutFile $wrapperJarPath -UseBasicParsing
        Write-Host "Gradle Wrapper успешно загружен!"
    } catch {
        Write-Host "Не удалось загрузить автоматически. Android Studio создаст его автоматически при первом запуске."
    }
} else {
    Write-Host "Gradle Wrapper уже существует."
}

