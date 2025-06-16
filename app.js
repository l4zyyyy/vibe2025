const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const basicAuth = require('basic-auth');

// Конфигурация
const PORT = 3000;
const TELEGRAM_BOT_TOKEN = '8173296673:AAE5IIUsNXuQIBYZ3rSVbltrT2q2WrWPNxI';
const ADMIN_CREDENTIALS = { username: 'admin', password: '12345' };

// Инициализация приложения
const app = express();
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: true});

// Инициализация_базы данных
const db = new sqlite3.Database('./todos.db', (err) => {
    if (err) {
        console.error('Ошибка при подключении к базе данных:', err.message);
    } else {
        console.log('Подключено к базе данных SQLite');
        db.run(`CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Middleware для базовой авторизации
const auth = (req, res, next) => {
    const user = basicAuth(req);
    if (!user || user.name !== ADMIN_CREDENTIALS.username || user.pass !== ADMIN_CREDENTIALS.password) {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
        return res.status(401).send('Требуется авторизация');
    }
    next();
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Обработчик команды /list в Telegram
bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    
    db.all('SELECT * FROM todos ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, 'Ошибка при получении списка задач');
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, 'Список задач пуст');
            return;
        }
        
        let message = '📋 Список задач:\n\n';
        rows.forEach((task, index) => {
            const status = task.completed ? '✅' : '🟡';
            message += `${index + 1}. ${status} ${task.task}\n`;
        });
        
        bot.sendMessage(chatId, message);
    });
});

// Защищенные маршруты API
// Получить все задачи
app.get('/api/todos', auth, (req, res) => {
    db.all('SELECT * FROM todos ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Добавить новую задачу
app.post('/api/todos', auth, (req, res) => {
    const { task } = req.body;
    if (!task) {
        return res.status(400).json({ error: 'Task is required' });
    }

    db.run('INSERT INTO todos (task) VALUES (?)', [task], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        res.json({
            id: this.lastID,
            task,
            completed: 0
        });
    });
});

// Обновить статус задачи
app.put('/api/todos/:id', auth, (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;

    db.run('UPDATE todos SET completed = ? WHERE id = ?', [completed ? 1 : 0, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Удалить задачу
app.delete('/api/todos/:id', auth, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM todos WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true });
    });
});

// Статический HTML файл (требует авторизации)
app.get('/', auth, (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log(`Для доступа используйте логин: ${ADMIN_CREDENTIALS.username} и пароль: ${ADMIN_CREDENTIALS.password}`);
});