<?php
/**
 * PHP API для сохранения платежей в PostgreSQL Timeweb
 * Используй код подключения из панели Timeweb!
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// ⚠️ ВАЖНО: Используй код подключения из панели Timeweb!
// Скопируй из раздела "PHP" в настройках БД

// Пример (ЗАМЕНИ НА КОД ИЗ TIMEWEB):
$host = 'pgsql123.timeweb.ru';  // <-- ХОСТ ИЗ TIMEWEB
$port = '5432';                  // <-- ПОРТ ИЗ TIMEWEB
$dbname = 'default_db';          // <-- БД ИЗ TIMEWEB
$user = 'gen_user';              // <-- ПОЛЬЗОВАТЕЛЬ ИЗ TIMEWEB
$password = 'dastan10dz';        // <-- ПАРОЛЬ ИЗ TIMEWEB

try {
    // Подключение к базе данных
    // Используй DSN строку из Timeweb если есть
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    $pdo = new PDO($dsn, $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Получаем данные из POST запроса
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        throw new Exception('Invalid JSON data');
    }
    
    // Проверяем обязательные поля
    $required = ['bank_name', 'package_name', 'amount', 'raw_text'];
    foreach ($required as $field) {
        if (!isset($data[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    // Подготавливаем SQL запрос
    $sql = "INSERT INTO payment_notifications (
        bank_name, package_name, amount, currency, 
        card_number, account_number, transaction_date, 
        raw_text, parsed_at, created_at
    ) VALUES (
        :bank_name, :package_name, :amount, :currency,
        :card_number, :account_number, :transaction_date,
        :raw_text, :parsed_at, CURRENT_TIMESTAMP
    ) RETURNING id";
    
    $stmt = $pdo->prepare($sql);
    
    // Привязываем параметры
    $stmt->bindValue(':bank_name', $data['bank_name']);
    $stmt->bindValue(':package_name', $data['package_name']);
    $stmt->bindValue(':amount', floatval($data['amount']));
    $stmt->bindValue(':currency', $data['currency'] ?? 'KGS');
    
    // Правильно обрабатываем NULL значения
    $cardNumber = isset($data['card_number']) && $data['card_number'] !== null && $data['card_number'] !== '' 
        ? $data['card_number'] : null;
    $accountNumber = isset($data['account_number']) && $data['account_number'] !== null && $data['account_number'] !== '' 
        ? $data['account_number'] : null;
    $stmt->bindValue(':card_number', $cardNumber);
    $stmt->bindValue(':account_number', $accountNumber);
    
    // Форматируем дату для PostgreSQL
    $transactionDate = isset($data['transaction_date']) && $data['transaction_date'] 
        ? date('Y-m-d H:i:s.u', strtotime($data['transaction_date'])) 
        : date('Y-m-d H:i:s.u');
    $parsedAt = isset($data['parsed_at']) && $data['parsed_at'] 
        ? date('Y-m-d H:i:s.u', strtotime($data['parsed_at'])) 
        : date('Y-m-d H:i:s.u');
    
    $stmt->bindValue(':transaction_date', $transactionDate);
    $stmt->bindValue(':raw_text', $data['raw_text']);
    $stmt->bindValue(':parsed_at', $parsedAt);
    
    // Выполняем запрос
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Успешный ответ
    echo json_encode([
        'success' => true,
        'data' => [
            'id' => $result['id'],
            'message' => 'Payment saved successfully'
        ]
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>

