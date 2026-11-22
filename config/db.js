
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

let ssl;

if (process.env.DB_SSL === "true") {
    // Render supplies the certificate as environment-variable text.
    // Local development uses the certificate file.
    const ca = process.env.DB_SSL_CA
        ? process.env.DB_SSL_CA.replace(/\\n/g, "\n")
        : fs.readFileSync(
            path.join(__dirname, "..", "certs", "ca.pem"),
            "utf8"
        );

    ssl = {
        ca,
        rejectUnauthorized: true
    };
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT),

    ...(ssl ? { ssl } : {}),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;
