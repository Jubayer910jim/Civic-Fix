
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const db = require("../config/db");

const router = express.Router();

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_WAIT_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

// Gmail SMTP transporter
function createEmailTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        throw new Error("Email configuration is missing in the .env file.");
    }

    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
}

// Send registration OTP
async function sendRegistrationEmail(email, otp) {
    const transporter = createEmailTransporter();

    await transporter.sendMail({
        from: `"Civic Fix" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Civic Fix verification code",
        text: `Your Civic Fix verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:25px;color:#18332b">
                <h2 style="color:#087b50">Welcome to Civic Fix!</h2>
                <p>Use this verification code to activate your account:</p>
                <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px;background:#f0f7f3;text-align:center;border-radius:10px">
                    ${otp}
                </div>
                <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
                <p>If you did not request this code, you can ignore this email.</p>
                <p>— Civic Fix Team</p>
            </div>
        `
    });
}

function isPermanentlyRejectedRecipient(error, email) {
    const rejectedRecipients = Array.isArray(error.rejected)
        ? error.rejected.map(address => String(address).trim().toLowerCase())
        : [];
    const recipientWasRejected = rejectedRecipients.includes(email.toLowerCase());

    return error.permanent === true &&
        (error.command === "RCPT TO" || (error.code === "EENVELOPE" && recipientWasRejected));
}

async function sendGoogleLoginEmail(email, otp) {
    const transporter = createEmailTransporter();

    await transporter.sendMail({
        from: `"Civic Fix" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Civic Fix sign-in code",
        text: `Your Civic Fix sign-in verification code is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:25px;color:#18332b">
                <h2 style="color:#087b50">Verify your Civic Fix sign-in</h2>
                <p>Enter this verification code to finish signing in:</p>
                <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px;background:#f0f7f3;text-align:center;border-radius:10px">${otp}</div>
                <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>
                <p>If you did not try to sign in, you can ignore this email.</p>
            </div>
        `
    });
}

// Generate a cryptographically random six-digit OTP
function generateOTP() {
    return crypto.randomInt(100000, 1000000).toString();
}

// Save OTP hash in database
async function saveOTP(connection, userId, otp) {
    const otpHash = await bcrypt.hash(otp, 10);

    await connection.execute(
        `INSERT INTO email_otps
            (user_id, otp_hash, purpose, expires_at)
         VALUES (?, ?, 'registration', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [userId, otpHash, OTP_EXPIRY_MINUTES]
    );
}

// Save the pending registration in the user's session
function savePendingSession(req, userId, email) {
    return new Promise((resolve, reject) => {
        req.session.pendingRegistration = {
            userId,
            email,
            method: "email"
        };

        req.session.save(error => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function savePendingGoogleSession(req, userId, email) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(error => {
            if (error) return reject(error);

            req.session.pendingRegistration = {
                userId,
                email,
                method: "email",
                googleRegistration: true
            };

            req.session.save(saveError => {
                if (saveError) return reject(saveError);
                resolve();
            });
        });
    });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
    let connection;
    let createdUserId = null;

    try {
        const { fullName, email, phone, password, method } = req.body;

        if (method !== "email" && method !== "phone") {
            return res.status(400).json({ success: false, message: "Choose email or phone registration." });
        }

        if (
            typeof fullName !== "string" ||
            fullName.trim().length < 2 ||
            fullName.trim().length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a name between 2 and 100 characters."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        connection = await db.getConnection();

        if (method === "phone") {
            const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
            const national = digits.startsWith("880") ? digits.slice(3) : (digits.startsWith("0") ? digits.slice(1) : digits);
            if (!/^1[3-9]\d{8}$/.test(national)) return res.status(400).json({ success: false, message: "Enter a valid Bangladesh mobile number." });
            const normalizedPhone = "+880" + national;
            const [existing] = await connection.execute("SELECT user_id FROM users WHERE phone = ? LIMIT 1", [normalizedPhone]);
            if (existing.length) return res.status(409).json({ success: false, message: "An account with this phone already exists. Please log in instead." });
            const passwordHash = await bcrypt.hash(password, 12);
            const [insert] = await connection.execute(
                `INSERT INTO users (full_name, phone, password_hash, auth_provider, role, account_status, phone_verified)
                 VALUES (?, ?, ?, 'phone', 'citizen', 'active', 0)`,
                [fullName.trim(), normalizedPhone, passwordHash]
            );
            const userId = insert.insertId;
            await connection.execute("UPDATE users SET username = CONCAT('user', user_id) WHERE user_id = ?", [userId]);
            await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
            req.session.user = { user_id: userId, full_name: fullName.trim(), email: null, phone: normalizedPhone, role: "citizen" };
            await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
            return res.status(201).json({ success: true, message: "Phone account created successfully.", redirect: "/citizen.html" });
        }

        if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        const normalizedEmail = email.trim().toLowerCase();

        const [existingUsers] = await connection.execute(
            "SELECT user_id FROM users WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists. Please log in instead."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const otp = generateOTP();

        await connection.beginTransaction();

        const [insertResult] = await connection.execute(
            `INSERT INTO users
                (full_name, email, password_hash, auth_provider,
                 role, account_status, email_verified)
             VALUES (?, ?, ?, 'email', 'citizen', 'pending', 0)`,
            [fullName.trim(), normalizedEmail, passwordHash]
        );

        createdUserId = insertResult.insertId;
        await connection.execute("UPDATE users SET username = CONCAT('user', user_id) WHERE user_id = ?", [createdUserId]);

        await saveOTP(connection, createdUserId, otp);

        await connection.commit();

        // Send email only after the database transaction succeeds.
        try {
            await sendRegistrationEmail(normalizedEmail, otp);
        } catch (emailError) {
            // Remove the pending account if the email could not be sent.
            await db.execute(
                "DELETE FROM users WHERE user_id = ? AND account_status = 'pending'",
                [createdUserId]
            );

            createdUserId = null;

            console.error("Registration email error:", emailError.message);

            if (isPermanentlyRejectedRecipient(emailError, normalizedEmail)) {
                return res.status(400).json({
                    success: false,
                    code: "INVALID_EMAIL_RECIPIENT",
                    message: "The mail server rejected this email address. Check it and enter an existing email address."
                });
            }

            return res.status(503).json({
                success: false,
                message: "We could not send the verification email. Please check the email configuration and try again."
            });
        }

        await savePendingSession(req, createdUserId, normalizedEmail);

        return res.status(201).json({
            success: true,
            message: "Verification code sent to your email.",
            destination: normalizedEmail
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to register your account. Please try again."
        });

    } finally {
        if (connection) connection.release();
    }
});

// POST /api/auth/google - verify a Google ID token and create/sign in a citizen.
router.post("/google", async (req, res) => {
    const { credential } = req.body || {};
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
        return res.status(503).json({ success: false, message: "Google sign-in is not configured on the server." });
    }
    if (typeof credential !== "string" || credential.length < 20) {
        return res.status(400).json({ success: false, message: "Google did not return a valid sign-in credential." });
    }

    let payload;
    try {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
            return res.status(401).json({ success: false, message: "Use a Google account with a verified email address." });
        }
    } catch (error) {
        console.error("Google token verification failed:", error.message);
        return res.status(401).json({ success: false, message: "Google sign-in could not be verified. Please try again." });
    }

    let connection;
    try {
        const googleId = payload.sub;
        const normalizedEmail = payload.email.trim().toLowerCase();
        const fullName = (typeof payload.name === "string" && payload.name.trim()
            ? payload.name.trim()
            : normalizedEmail.split("@")[0]).slice(0, 100);

        connection = await db.getConnection();

        let [users] = await connection.execute(
            `SELECT user_id, full_name, email, phone, role, account_status
             FROM users WHERE google_id = ? LIMIT 1`,
            [googleId]
        );

        if (users.length === 0) {
            const [emailMatches] = await connection.execute(
                "SELECT user_id FROM users WHERE email = ? LIMIT 1",
                [normalizedEmail]
            );
            if (emailMatches.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "An account already uses this email. Sign in with that account's existing method; Google account linking is not available yet."
                });
            }

            // The application requires a password_hash; this random hash is never shown or used for Google sign-in.
            const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
            const [insert] = await connection.execute(
                `INSERT INTO users
                    (full_name, email, google_id, password_hash, auth_provider,
                     role, account_status, email_verified)
                 VALUES (?, ?, ?, ?, 'google', 'citizen', 'pending', 0)`,
                [fullName, normalizedEmail, googleId, unusablePasswordHash]
            );
            await connection.execute("UPDATE users SET username = CONCAT('user', user_id) WHERE user_id = ?", [insert.insertId]);

            users = [{
                user_id: insert.insertId,
                full_name: fullName,
                email: normalizedEmail,
                phone: null,
                role: "citizen",
                account_status: "pending"
            }];
        }

        const user = users[0];
        if (user.role !== "citizen") {
            return res.status(403).json({ success: false, message: "Google sign-in is available for citizen accounts only." });
        }
        if (user.account_status === "active") {
            await new Promise((resolve, reject) => {
                req.session.regenerate(error => error ? reject(error) : resolve());
            });
            req.session.user = {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role
            };
            await new Promise((resolve, reject) => {
                req.session.save(error => error ? reject(error) : resolve());
            });

            return res.json({
                success: true,
                message: "Google sign-in successful.",
                user: { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role },
                redirect: "/citizen.html"
            });
        }
        if (user.account_status !== "pending") {
            return res.status(403).json({ success: false, message: "This account is not active. Contact an administrator for help." });
        }

        const [recentOTPs] = await connection.execute(
            `SELECT otp_id
             FROM email_otps
             WHERE user_id = ?
               AND purpose = 'registration'
               AND verified_at IS NULL
               AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
             ORDER BY created_at DESC
             LIMIT 1`,
            [user.user_id, OTP_RESEND_WAIT_SECONDS]
        );
        if (recentOTPs.length > 0) {
            await savePendingGoogleSession(req, user.user_id, user.email);
            return res.json({
                success: true,
                otpRequired: true,
                destination: user.email,
                message: "A Google registration code was just sent. Check your email or use Resend OTP."
            });
        }

        const otp = generateOTP();
        await connection.beginTransaction();
        await connection.execute(
            `DELETE FROM email_otps
             WHERE user_id = ? AND purpose = 'registration' AND verified_at IS NULL`,
            [user.user_id]
        );
        await saveOTP(connection, user.user_id, otp);
        await connection.commit();

        try {
            await sendGoogleLoginEmail(user.email, otp);
        } catch (emailError) {
            await db.execute(
                `DELETE FROM email_otps
                 WHERE user_id = ? AND purpose = 'registration' AND verified_at IS NULL`,
                [user.user_id]
            );
            console.error("Google sign-in OTP email error:", emailError.message);
            return res.status(503).json({
                success: false,
                message: "Google sign-in succeeded, but we could not send the verification code. Please try again."
            });
        }

        await savePendingGoogleSession(req, user.user_id, user.email);

        return res.json({
            success: true,
            otpRequired: true,
            destination: user.email,
            message: "A Google registration verification code was sent to your email."
        });
    } catch (error) {
        console.error("Google sign-in error:", error.message);
        return res.status(500).json({ success: false, message: "Unable to sign in with Google. Please try again." });
    } finally {
        if (connection) connection.release();
    }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
    let connection;

    try {
        const { otp, method } = req.body;
        const pending = req.session.pendingRegistration;

        if (method !== "email") {
            return res.status(400).json({
                success: false,
                message: "Email verification is currently available."
            });
        }

        if (!pending || pending.method !== "email") {
            return res.status(400).json({
                success: false,
                message: "No pending registration was found. Please register again."
            });
        }

        if (typeof otp !== "string" || !/^[0-9]{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid six-digit OTP."
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [otpRows] = await connection.execute(
            `SELECT otp_id, otp_hash, expires_at, attempts
             FROM email_otps
             WHERE user_id = ?
               AND purpose = 'registration'
               AND verified_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [pending.userId]
        );

        if (otpRows.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "No active verification code found. Please request a new one."
            });
        }

        const savedOTP = otpRows[0];

        if (new Date(savedOTP.expires_at).getTime() <= Date.now()) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Your verification code has expired. Please request a new one."
            });
        }

        if (savedOTP.attempts >= MAX_OTP_ATTEMPTS) {
            await connection.rollback();

            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Please request a new OTP."
            });
        }

        const matches = await bcrypt.compare(otp, savedOTP.otp_hash);

        if (!matches) {
            await connection.execute(
                "UPDATE email_otps SET attempts = attempts + 1 WHERE otp_id = ?",
                [savedOTP.otp_id]
            );

            await connection.commit();

            return res.status(400).json({
                success: false,
                message: "Incorrect verification code."
            });
        }

        const [users] = pending.googleLogin
            ? await connection.execute(
                `SELECT user_id, full_name, email, role
                 FROM users
                 WHERE user_id = ? AND account_status = 'active'
                 LIMIT 1
                 FOR UPDATE`,
                [pending.userId]
            )
            : await connection.execute(
                `SELECT user_id, full_name, email, role
                 FROM users
                 WHERE user_id = ? AND account_status = 'pending'
                 LIMIT 1
                 FOR UPDATE`,
                [pending.userId]
            );

        if (users.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "This registration is no longer available. Please register again."
            });
        }

        await connection.execute(
            "UPDATE email_otps SET verified_at = NOW() WHERE otp_id = ?",
            [savedOTP.otp_id]
        );

        if (!pending.googleLogin) {
            await connection.execute(
                `UPDATE users
                 SET email_verified = 1,
                     account_status = 'active'
                 WHERE user_id = ?`,
                [pending.userId]
            );
        }

        await connection.commit();

        const user = users[0];

        // Regenerate session ID after successful authentication.
        await new Promise((resolve, reject) => {
            req.session.regenerate(error => {
                if (error) return reject(error);
                resolve();
            });
        });

        req.session.user = {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            role: user.role
        };

        await new Promise((resolve, reject) => {
            req.session.save(error => {
                if (error) return reject(error);
                resolve();
            });
        });

        return res.json({
            success: true,
            message: pending.googleRegistration
                ? "Your Google account is verified and ready."
                : pending.googleLogin
                ? "Your sign-in code is verified."
                : "Your email has been verified. Your account is now active.",
            redirect: "citizen.html"
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error("OTP verification error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to verify your account. Please try again."
        });

    } finally {
        if (connection) connection.release();
    }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", async (req, res) => {
    let connection;

    try {
        const pending = req.session.pendingRegistration;

        if (!pending || pending.method !== "email") {
            return res.status(400).json({
                success: false,
                message: "No pending email registration was found."
            });
        }

        connection = await db.getConnection();

        const [users] = pending.googleLogin
            ? await connection.execute(
                `SELECT email
                 FROM users
                 WHERE user_id = ? AND account_status = 'active'
                 LIMIT 1`,
                [pending.userId]
            )
            : await connection.execute(
                `SELECT email
                 FROM users
                 WHERE user_id = ? AND account_status = 'pending'
                 LIMIT 1`,
                [pending.userId]
            );

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: pending.googleLogin
                    ? "This sign-in request is no longer available. Please sign in with Google again."
                    : "This registration is no longer available. Please register again."
            });
        }

        const [recentOTPs] = await connection.execute(
            `SELECT otp_id
             FROM email_otps
             WHERE user_id = ?
               AND purpose = 'registration'
               AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
             ORDER BY created_at DESC
             LIMIT 1`,
            [pending.userId, OTP_RESEND_WAIT_SECONDS]
        );

        if (recentOTPs.length > 0) {
            return res.status(429).json({
                success: false,
                message: "Please wait 60 seconds before requesting another OTP."
            });
        }

        const otp = generateOTP();

        await connection.beginTransaction();

        await connection.execute(
            `DELETE FROM email_otps
             WHERE user_id = ?
               AND purpose = 'registration'
               AND verified_at IS NULL`,
            [pending.userId]
        );

        await saveOTP(connection, pending.userId, otp);

        await connection.commit();

        try {
            if (pending.googleLogin || pending.googleRegistration) {
                await sendGoogleLoginEmail(users[0].email, otp);
            } else {
                await sendRegistrationEmail(users[0].email, otp);
            }
        } catch (emailError) {
            console.error("Resend email error:", emailError.message);

            return res.status(503).json({
                success: false,
                message: "Could not send the email. Please try again later."
            });
        }

        return res.json({
            success: true,
            message: pending.googleRegistration
                ? "A new Google registration verification code has been sent."
                : pending.googleLogin
                ? "A new sign-in verification code has been sent."
                : "A new verification code has been sent."
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error("Resend OTP error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to resend the verification code."
        });

    } finally {
        if (connection) connection.release();
    }
});

// GET /api/auth/pending-registration
router.get("/pending-registration", (req, res) => {
    const pending = req.session.pendingRegistration;

    if (!pending) {
        return res.status(404).json({
            success: false,
            message: "No pending registration found."
        });
    }

    return res.json({
        success: true,
        email: pending.email
    });
});

module.exports = router;
