const session = require("express-session");
const db = require("./db");

class MySQLSessionStore extends session.Store {
    constructor({ cleanupIntervalMs = 15 * 60 * 1000 } = {}) {
        super();

        this.ready = db.query(`
            CREATE TABLE IF NOT EXISTS civic_fix_sessions (
                session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
                expires_at BIGINT UNSIGNED NOT NULL,
                session_data MEDIUMTEXT NOT NULL,
                PRIMARY KEY (session_id),
                KEY idx_civic_fix_sessions_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `).then(() => {
            this.emit("connect");
        }).catch(error => {
            this.emit("disconnect");
            throw error;
        });

        // Prevent an unhandled rejection before the first session operation.
        this.ready.catch(() => {});

        this.cleanupTimer = setInterval(() => {
            db.query("DELETE FROM civic_fix_sessions WHERE expires_at <= ?", [Date.now()])
                .catch(error => console.error("Expired session cleanup failed:", error.message));
        }, cleanupIntervalMs);
        this.cleanupTimer.unref();
    }

    onReady() {
        return this.ready;
    }

    get(sessionId, callback) {
        this.ready.then(async () => {
            const [rows] = await db.query(
                "SELECT expires_at, session_data FROM civic_fix_sessions WHERE session_id = ? LIMIT 1",
                [sessionId]
            );
            if (!rows.length) return callback(null, null);

            const record = rows[0];
            if (Number(record.expires_at) <= Date.now()) {
                await db.query("DELETE FROM civic_fix_sessions WHERE session_id = ?", [sessionId]);
                return callback(null, null);
            }

            return callback(null, JSON.parse(record.session_data));
        }).catch(callback);
    }

    set(sessionId, sessionData, callback = () => {}) {
        this.ready.then(async () => {
            const cookie = sessionData.cookie || {};
            const cookieExpiry = cookie.expires ? new Date(cookie.expires).getTime() : NaN;
            const maxAge = Number(cookie.originalMaxAge || cookie.maxAge || 24 * 60 * 60 * 1000);
            const expiresAt = Number.isFinite(cookieExpiry)
                ? cookieExpiry
                : Date.now() + Math.max(0, maxAge);

            await db.query(
                `INSERT INTO civic_fix_sessions (session_id, expires_at, session_data)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), session_data = VALUES(session_data)`,
                [sessionId, expiresAt, JSON.stringify(sessionData)]
            );
            callback(null);
        }).catch(callback);
    }

    touch(sessionId, sessionData, callback = () => {}) {
        this.ready.then(async () => {
            const cookie = sessionData.cookie || {};
            const cookieExpiry = cookie.expires ? new Date(cookie.expires).getTime() : NaN;
            const maxAge = Number(cookie.originalMaxAge || cookie.maxAge || 24 * 60 * 60 * 1000);
            const expiresAt = Number.isFinite(cookieExpiry)
                ? cookieExpiry
                : Date.now() + Math.max(0, maxAge);

            await db.query(
                "UPDATE civic_fix_sessions SET expires_at = ? WHERE session_id = ?",
                [expiresAt, sessionId]
            );
            callback(null);
        }).catch(callback);
    }

    destroy(sessionId, callback = () => {}) {
        this.ready.then(async () => {
            await db.query("DELETE FROM civic_fix_sessions WHERE session_id = ?", [sessionId]);
            callback(null);
        }).catch(callback);
    }
}

module.exports = MySQLSessionStore;
