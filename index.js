const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const querystring = require('querystring');

const PORT = 3000;

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'todolist',
};

async function retrieveListItems() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, text FROM items');
        await connection.end();
        return rows;
    } catch (error) {
        console.error('Error retrieving list items:', error);
        throw error;
    }
}

async function getHtmlRows() {
    const todoItems = await retrieveListItems();
    return todoItems.map(item => `
        <tr>
            <td>${item.id}</td>
            <td>${item.text}</td>
            <td></td>
        </tr>
    `).join('');
}

async function handleRequest(req, res) {
    if (req.method === 'GET' && req.url === '/') {
        try {
            const html = await fs.promises.readFile(
                path.join(__dirname, 'index.html'),
                'utf8'
            );
            const processedHtml = html.replace('{{rows}}', await getHtmlRows());
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(processedHtml);
        } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading index.html');
        }
    } else if (req.method === 'POST' && req.url === '/add') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const { text } = querystring.parse(body);
            if (text && text.trim()) {
                try {
                    const connection = await mysql.createConnection(dbConfig);
                    await connection.execute('INSERT INTO items (text) VALUES (?)', [text.trim()]);
                    await connection.end();
                    res.writeHead(302, { Location: '/' }); // Redirect to main page
                    res.end();
                } catch (err) {
                    console.error('Error inserting item:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Failed to add item.');
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Invalid input');
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Route not found');
    }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));