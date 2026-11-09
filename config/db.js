
// Import MySQL package
const mysql = require("mysql2/promise");

// Load environment variables
require("dotenv").config();

// Create MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Export database connection
module.exports = db;
