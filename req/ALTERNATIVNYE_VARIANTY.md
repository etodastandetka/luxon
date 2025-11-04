# Альтернативные варианты отправки данных в PostgreSQL

## Вариант 1: Supabase (САМЫЙ ПРОСТОЙ) ⭐ РЕКОМЕНДУЮ

Supabase - это готовый сервис с PostgreSQL + REST API из коробки.

### Преимущества:
- ✅ БЕСПЛАТНЫЙ план до 500MB БД
- ✅ Автоматический REST API
- ✅ Реальный PostgreSQL
- ✅ Готовый SDK для Android
- ✅ Не нужно настраивать сервер

### Как использовать:
1. Создай проект на https://supabase.com
2. Получи URL API и API Key
3. Используй готовый REST API

---

## Вариант 2: Node.js API на твоем сервере

Если есть Node.js на сервере - проще чем PHP.

### Создать server.js:
```javascript
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: '89.23.117.61',
  port: 5432,
  database: 'default_db',
  user: 'gen_user',
  password: 'dastan10dz'
});

app.post('/api/payments', async (req, res) => {
  try {
    const { bank_name, package_name, amount, currency, card_number, account_number, transaction_date, raw_text, parsed_at } = req.body;
    
    const result = await pool.query(
      `INSERT INTO payment_notifications 
       (bank_name, package_name, amount, currency, card_number, account_number, transaction_date, raw_text, parsed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [bank_name, package_name, amount, currency || 'KGS', card_number, account_number, transaction_date, raw_text, parsed_at]
    );
    
    res.json({ success: true, data: { id: result.rows[0].id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### Запуск:
```bash
npm install express pg
node server.js
```

---

## Вариант 3: Python Flask API

Еще один простой вариант.

### Создать app.py:
```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2

app = Flask(__name__)
CORS(app)

def get_db():
    return psycopg2.connect(
        host='89.23.117.61',
        port=5432,
        database='default_db',
        user='gen_user',
        password='dastan10dz'
    )

@app.route('/api/payments', methods=['POST'])
def add_payment():
    try:
        data = request.json
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO payment_notifications 
            (bank_name, package_name, amount, currency, card_number, account_number, transaction_date, raw_text, parsed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data['bank_name'],
            data['package_name'],
            data['amount'],
            data.get('currency', 'KGS'),
            data.get('card_number'),
            data.get('account_number'),
            data.get('transaction_date'),
            data['raw_text'],
            data.get('parsed_at')
        ))
        
        payment_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'success': True, 'data': {'id': payment_id}})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

---

## Вариант 4: Использовать готовые BaaS сервисы

### Firebase Firestore + Cloud Functions
- Бесплатный план
- Простая настройка
- Автоматическая синхронизация

### AWS Amplify
- Готовая интеграция
- REST API из коробки

---

## Вариант 5: Локальное хранение + периодическая синхронизация

Хранить локально в Room, синхронизировать позже когда сервер доступен.

---

## Вариант 6: Использовать готовый PostgreSQL API сервис

### PostgREST
Автоматически создает REST API из PostgreSQL схемы.

### Hasura
GraphQL и REST API для PostgreSQL.

---

## Какой вариант выбрать?

1. **Supabase** - если нужен самый быстрый старт ⭐
2. **Node.js** - если есть Node.js на сервере
3. **Python Flask** - если есть Python на сервере
4. **Firebase** - если не нужен именно PostgreSQL

Скажи какой вариант тебе подходит!

