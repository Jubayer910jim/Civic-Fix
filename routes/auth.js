
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
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
        service: "gmail",
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

// POST /api/auth/register
router.post("/register", async (req, res) => {
    let connection;
    let createdUserId = null;

    try {
        const { fullName, email, password, method } = req.body;

        if (method !== "email") {
            return res.status(400).json({
                success: false,
                message: "Email registration is currently available."
            });
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

        if (
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        connection = await db.getConnection();

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

        const [users] = await connection.execute(
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

        await connection.execute(
            `UPDATE users
             SET email_verified = 1,
                 account_status = 'active'
             WHERE user_id = ?`,
            [pending.userId]
        );

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
            message: "Your email has been verified. Your account is now active.",
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

        const [users] = await connection.execute(
            `SELECT email
             FROM users
             WHERE user_id = ? AND account_status = 'pending'
             LIMIT 1`,
            [pending.userId]
        );

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: "This registration is no longer available. Please register again."
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
            await sendRegistrationEmail(users[0].email, otp);
        } catch (emailError) {
            console.error("Resend email error:", emailError.message);

            return res.status(503).json({
                success: false,
                message: "Could not send the email. Please try again later."
            });
        }

        return res.json({
            success: true,
            message: "A new verification code has been sent."
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
