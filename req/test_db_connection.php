<?php
/**
 * Тестовый скрипт для проверки подключения к PostgreSQL
 * Размести на сервере: /var/www/html/api/test_db.php
 * Открой в браузере: http://ТВОЙ_СЕРВЕР/api/test_db.php
 */

header('Content-Type: application/json');

// Параметры подключения к PostgreSQL (внешняя БД)
$host = '89.23.117.61';
$port = '5432';
$dbname = 'default_db';
$user = 'gen_user';
$password = 'dastan10dz';

echo "Проверка подключения к PostgreSQL...\n\n";
echo "Хост: $host\n";
echo "Порт: $port\n";
echo "База: $dbname\n";
echo "Пользователь: $user\n\n";

try {
    // Проверка наличия расширения
    if (!extension_loaded('pdo') || !extension_loaded('pdo_pgsql')) {
        throw new Exception('Расширение PDO PostgreSQL не установлено. Установите: sudo apt-get install php-pgsql');
    }
    
    echo "✓ Расширение PDO PostgreSQL установлено\n\n";
    
    // Подключение к базе данных
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    echo "Попытка подключения: $dsn\n";
    
    $pdo = new PDO($dsn, $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✓ Подключение к PostgreSQL успешно!\n\n";
    
    // Проверка таблицы
    $stmt = $pdo->query("SELECT COUNT(*) FROM payment_notifications");
    $count = $stmt->fetchColumn();
    
    echo "✓ Таблица payment_notifications существует\n";
    echo "✓ Записей в таблице: $count\n\n";
    
    // Проверка структуры таблицы
    $stmt = $pdo->query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payment_notifications' ORDER BY ordinal_position");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Структура таблицы:\n";
    foreach ($columns as $col) {
        echo "  - {$col['column_name']} ({$col['data_type']})\n";
    }
    
    echo "\n✅ ВСЁ РАБОТАЕТ! Можно использовать api.php\n";
    
    echo json_encode([
        'success' => true,
        'message' => 'Подключение к PostgreSQL успешно!',
        'host' => $host,
        'database' => $dbname,
        'table_exists' => true,
        'records_count' => $count,
        'columns' => $columns
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (PDOException $e) {
    echo "❌ Ошибка подключения к PostgreSQL:\n";
    echo "   " . $e->getMessage() . "\n\n";
    
    echo "Возможные причины:\n";
    echo "1. PostgreSQL не слушает внешние подключения (проверь postgresql.conf: listen_addresses = '*')\n";
    echo "2. pg_hba.conf не разрешает подключения с этого IP\n";
    echo "3. Firewall блокирует порт 5432\n";
    echo "4. Неправильные учетные данные\n";
    echo "5. База данных недоступна из интернета\n\n";
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'error_code' => $e->getCode()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo "❌ Ошибка: " . $e->getMessage() . "\n";
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>

