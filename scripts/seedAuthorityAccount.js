"use strict";

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("../config/db");

const email = "Authority@admin.com";
const accountName = "Civic Fix Authority";

async function main() {
    const connection = await db.getConnection();
    const password = crypto.randomBytes(24).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);
    try {
        await connection.query("ALTER TABLE users MODIFY role VARCHAR(32) NOT NULL DEFAULT 'citizen'");
        await connection.beginTransaction();
        const [existing] = await connection.query(
            "SELECT user_id, role FROM users WHERE LOWER(email) = ? LIMIT 1 FOR UPDATE",
            [email.toLowerCase()]
        );
        let userId;
        if (existing.length) {
            if (existing[0].role !== "authority") {
                throw new Error(`${email} already belongs to a non-authority account; choose another email before provisioning.`);
            }
            userId = existing[0].user_id;
            await connection.query(
                "UPDATE users SET password_hash = ?, account_status = 'active', email_verified = 1 WHERE user_id = ?",
                [passwordHash, userId]
            );
        } else {
            const [created] = await connection.query(
                `INSERT INTO users
                    (full_name, email, password_hash, auth_provider, role, account_status, email_verified)
                 VALUES (?, ?, ?, 'email', 'authority', 'active', 1)`,
                [accountName, email, passwordHash]
            );
            userId = created.insertId;
            await connection.query(
                "UPDATE users SET username = CONCAT('authority_', user_id) WHERE user_id = ?",
                [userId]
            );
        }
        await connection.commit();
        console.log("Authority account is ready. Save these credentials now; only a password hash is stored:");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
        await db.end();
    }
}

main().catch(error => {
    console.error("Unable to provision the Authority account:", error.sqlMessage || error.message || error.code || String(error));
    if (error.code) console.error("Database error code:", error.code);
    process.exitCode = 1;
});
