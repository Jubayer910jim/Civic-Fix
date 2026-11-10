"use strict";

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("../config/db");
const resetExistingPasswords = process.argv.includes("--reset-passwords");

const accounts = [
    {
        key: "wasa",
        name: "WASA Institution User",
        email: "WasaUser@admin.com",
        matches: name => name.includes("wasa")
    },
    {
        key: "city-corporation",
        name: "City Corporation Institution User",
        email: "Citycorporation@admin.com",
        matches: name => name.includes("citycorporation")
    },
    {
        key: "pollibiddut",
        name: "Pollibiddut Institution User",
        email: "Pollibiddut@admin.com",
        matches: name => name.includes("pollibiddut") || name.includes("pallibidyut")
    }
];

function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
}

async function main() {
    const connection = await db.getConnection();
    const newCredentials = [];
    try {
        // Keep this setup command self-contained: it creates the prerequisite
        // schema so the account seeder also works when only its npm command is run.
        await connection.query("ALTER TABLE users MODIFY role VARCHAR(32) NOT NULL DEFAULT 'citizen'");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS institutions (
                institution_id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                institution_name VARCHAR(150) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (institution_id),
                UNIQUE KEY uq_institutions_name (institution_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS institution_user_accounts (
                user_id INT(10) UNSIGNED NOT NULL,
                institution_id INT(10) UNSIGNED NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                KEY idx_institution_user_accounts_institution (institution_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await connection.beginTransaction();
        const [institutionRows] = await connection.query("SELECT institution_id, institution_name FROM institutions");
        const resolved = [];
        for (const account of accounts) {
            let institution = institutionRows.find(row => account.matches(normalize(row.institution_name)));
            if (!institution) {
                const canonicalName = account.key === "wasa" ? "WASA" : account.key === "city-corporation" ? "City Corporation" : "Palli Bidyut";
                const [createdInstitution] = await connection.query("INSERT INTO institutions (institution_name) VALUES (?)", [canonicalName]);
                institution = { institution_id: createdInstitution.insertId, institution_name: canonicalName };
                institutionRows.push(institution);
            }
            resolved.push({ ...account, institution });
        }
        for (const account of resolved) {
            const normalizedEmail = account.email.toLowerCase();
            const [existingUsers] = await connection.query(
                "SELECT user_id, role FROM users WHERE LOWER(email) = ? LIMIT 1 FOR UPDATE", [normalizedEmail]
            );
            let userId;
            if (existingUsers.length) {
                const existing = existingUsers[0];
                if (existing.role !== "institution") {
                    throw new Error(`${account.email} already belongs to a non-institution account. Resolve that account before provisioning.`);
                }
                userId = existing.user_id;
                if (resetExistingPasswords) {
                    const password = crypto.randomBytes(24).toString("base64url");
                    const passwordHash = await bcrypt.hash(password, 12);
                    await connection.query("UPDATE users SET password_hash = ?, account_status = 'active' WHERE user_id = ?", [passwordHash, userId]);
                    newCredentials.push({ email: account.email, password });
                }
            } else {
                const password = crypto.randomBytes(24).toString("base64url");
                const passwordHash = await bcrypt.hash(password, 12);
                const [created] = await connection.query(
                    `INSERT INTO users
                        (full_name, email, password_hash, auth_provider, role, account_status, email_verified)
                     VALUES (?, ?, ?, 'email', 'institution', 'active', 1)`,
                    [account.name, account.email, passwordHash]
                );
                userId = created.insertId;
                await connection.query("UPDATE users SET username = CONCAT('institution_', user_id) WHERE user_id = ?", [userId]);
                newCredentials.push({ email: account.email, password });
            }

            const [links] = await connection.query(
                "SELECT institution_id FROM institution_user_accounts WHERE user_id = ? LIMIT 1 FOR UPDATE", [userId]
            );
            if (links.length && Number(links[0].institution_id) !== Number(account.institution.institution_id)) {
                throw new Error(`${account.email} is already linked to another institution.`);
            }
            if (!links.length) {
                await connection.query(
                    "INSERT INTO institution_user_accounts (user_id, institution_id) VALUES (?, ?)",
                    [userId, account.institution.institution_id]
                );
            }
        }
        await connection.commit();

        console.log("Institution account provisioning complete.");
        if (newCredentials.length) {
            console.log(resetExistingPasswords ? "Save these new passwords now; only their hashes are stored in the database:" : "Save these generated passwords now; the database stores only password hashes:");
            for (const item of newCredentials) console.log(`${item.email}  ${item.password}`);
        } else {
            console.log("All three institution accounts already exist. Existing passwords were left unchanged.");
        }
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
        await db.end();
    }
}

main().catch(error => {
    const reason = error.sqlMessage || error.message || error.code || String(error);
    console.error("Unable to provision institution accounts:", reason);
    if (error.code) console.error("Database error code:", error.code);
    process.exitCode = 1;
});
