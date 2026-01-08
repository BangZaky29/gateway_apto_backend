// C:\codingVibes\nuansasolution\.mainweb\payment-tools\gateway_apto-backend\config\db.js

// config/db.js
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = db;

