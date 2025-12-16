// Простой Node.js API сервер для сохранения платежей в PostgreSQL
// Запуск: npm install express pg
// node api_server.js

const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

// Конфигурация базы данных из переменных окружения
const pool = new Pool({
    host: '89.23.117.61',
    port: 5432,
    database: 'default_db',
    user: 'gen_user',
    password: 'dastan10dz',
    ssl: false
});

app.use(express.json());

// CORS для Android приложения
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Endpoint для сохранения платежа
app.post('/api/payments', async (req, res) => {
    try {
        const {
            bank_name,
            package_name,
            amount,
            currency,
            card_number,
            account_number,
            transaction_date,
            raw_text,
            parsed_at
        } = req.body;

        // Валидация обязательных полей
        if (!bank_name || !package_name || amount === undefined || !raw_text) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: bank_name, package_name, amount, raw_text'
            });
        }

        // Вставляем данные в PostgreSQL
        const query = `
            INSERT INTO payment_notifications (
                bank_name, package_name, amount, currency, 
                card_number, account_number, transaction_date, 
                raw_text, parsed_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            RETURNING id
        `;

        const values = [
            bank_name,
            package_name,
            parseFloat(amount),
            currency || 'KGS',
            card_number || null,
            account_number || null,
            transaction_date ? new Date(transaction_date) : new Date(),
            raw_text,
            parsed_at ? new Date(parsed_at) : new Date()
        ];

        const result = await pool.query(query, values);

        console.log(`Платеж сохранен в БД: ID=${result.rows[0].id}, Банк=${bank_name}, Сумма=${amount} ${currency || 'KGS'}`);

        // Отправляем в админку Next.js (асинхронно, не блокируем ответ)
        const adminBaseUrl = process.env.ADMIN_API_BASE_URL || 'https://japar.click';
        fetch(`${adminBaseUrl}/api/incoming-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: parseFloat(amount),
                bank: bank_name?.toUpperCase() || 'UNKNOWN',
                paymentDate: transaction_date ? new Date(transaction_date).toISOString() : new Date().toISOString(),
                notificationText: raw_text || '',
            }),
        }).then(response => {
            if (response.ok) {
                console.log(`✅ Платеж успешно отправлен в админку: ${bank_name} - ${amount}`);
            } else {
                console.warn(`⚠️ Не удалось отправить в админку: HTTP ${response.status}`);
            }
        }).catch(error => {
            console.error(`❌ Ошибка при отправке в админку: ${error.message}`);
        });

        res.json({
            success: true,
            data: {
                id: result.rows[0].id,
                message: 'Payment saved successfully'
            }
        });

    } catch (error) {
        console.error('Ошибка при сохранении платежа:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`API Server running on http://0.0.0.0:${port}`);
    console.log(`Database: postgresql://gen_user@89.23.117.61:5432/default_db`);
});

