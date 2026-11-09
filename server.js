
// ==========================================
// CIVIC FIX - SERVER
// Node.js + Express + MySQL
// Citizen + Admin Authentication
// Optional Image Upload Support
// ==========================================


// ==========================================
// 1. IMPORT PACKAGES
// ==========================================
const authRoutes = require("./routes/auth");
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");

require("dotenv").config();

const db = require("./config/db");



// ==========================================
// 2. CREATE EXPRESS APPLICATION
// ==========================================

const app = express();

// Shared in-process cache and request pacing for the public geocoder.
const geocodeResultCache = new Map();
let geocodeRequestQueue = Promise.resolve();
let lastGeocodeRequestAt = 0;


// ==========================================
// 3. MIDDLEWARE
// ==========================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ==========================================
// 4. SESSION CONFIGURATION
// ==========================================

app.use(
    session({
        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        cookie: {
            maxAge:
                1000 *
                60 *
                60 *
                24
        }
    })
);
// Registration and OTP routes
app.use("/api/auth", authRoutes);


// ==========================================
// 5. IMAGE UPLOAD CONFIGURATION
// ==========================================

const uploadsDirectory =
    path.join(
        __dirname,
        "uploads"
    );


const reportsUploadDirectory =
    path.join(
        uploadsDirectory,
        "reports"
    );

const profilesUploadDirectory = path.join(uploadsDirectory, "profiles");


// Create uploads/reports folder automatically

if (
    !fs.existsSync(
        reportsUploadDirectory
    )
) {

    fs.mkdirSync(
        reportsUploadDirectory,
        {
            recursive: true
        }
    );

}

if (!fs.existsSync(profilesUploadDirectory)) {
    fs.mkdirSync(profilesUploadDirectory, { recursive: true });
}


// ------------------------------------------
// Allowed image types
// ------------------------------------------

const allowedMimeTypes = [

    "image/jpeg",

    "image/png",

    "image/webp"

];


// ------------------------------------------
// File storage configuration
// ------------------------------------------

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                callback
            ) {

                callback(
                    null,
                    reportsUploadDirectory
                );

            },


        filename:
            function (
                req,
                file,
                callback
            ) {

                const extension =
                    path.extname(
                        file.originalname
                    ).toLowerCase();


                const uniqueName =
                    "report-" +
                    Date.now() +
                    "-" +
                    crypto
                        .randomBytes(8)
                        .toString("hex") +
                    extension;


                callback(
                    null,
                    uniqueName
                );

            }

    });


// ------------------------------------------
// File filter
// ------------------------------------------

function imageFileFilter(
    req,
    file,
    callback
) {

    if (
        allowedMimeTypes.includes(
            file.mimetype
        )
    ) {

        callback(
            null,
            true
        );

    }

    else {

        callback(
            new Error(
                "Only JPG, JPEG, PNG, and WebP images are allowed."
            )
        );

    }

}

const profileStorage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, profilesUploadDirectory),
    filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `profile-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
    }
});

const profileUpload = multer({
    storage: profileStorage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 2 * 1024 * 1024, files: 1 }
});


// ------------------------------------------
// Multer upload configuration
// ------------------------------------------

const upload =
    multer({

        storage: storage,

        fileFilter:
            imageFileFilter,

        limits: {

            // Maximum 5 MB per image

            fileSize:
                5 *
                1024 *
                1024

        }

    });


// ==========================================
// 6. AUTHENTICATION HELPER FUNCTIONS
// ==========================================


// Check if user is logged in

function requireLogin(
    req,
    res,
    next
) {

    if (
        !req.session.user
    ) {

        return res
            .status(401)
            .json({

                success: false,

                message:
                    "Please log in first."

            });

    }

    next();

}


// ------------------------------------------
// Check user role
// ------------------------------------------

function requireRole(
    ...allowedRoles
) {

    return function (
        req,
        res,
        next
    ) {

        if (
            !req.session.user
        ) {

            return res
                .status(401)
                .json({

                    success: false,

                    message:
                        "Please log in first."

                });

        }


        if (
            !allowedRoles.includes(
                req.session.user.role
            )
        ) {

            return res
                .status(403)
                .json({

                    success: false,

                    message:
                        "You do not have permission to access this resource."

                });

        }


        next();

    };

}


// ------------------------------------------
// Get logged-in user ID
// ------------------------------------------

function getLoggedInUserId(
    req
) {

    return req.session.user.user_id;

}


// ==========================================
// 7. HELPER FUNCTION:
// DELETE UPLOADED FILES
// ==========================================

function deleteUploadedFiles(
    files
) {

    if (
        !files ||
        files.length === 0
    ) {

        return;

    }


    for (
        const file of files
    ) {

        if (
            fs.existsSync(
                file.path
            )
        ) {

            try {

                fs.unlinkSync(
                    file.path
                );

            }

            catch (error) {

                console.error(
                    "Unable to delete uploaded file:",
                    error.message
                );

            }

        }

    }

}


// ==========================================
// 8. HELPER FUNCTION:
// ADD IMAGES TO REPORT OBJECTS
// ==========================================

async function addImagesToReports(
    reports
) {

    if (
        !reports ||
        reports.length === 0
    ) {

        return reports;

    }


    const reportIds =
        reports.map(
            report =>
                report.report_id
        );


    const placeholders =
        reportIds
            .map(
                () => "?"
            )
            .join(", ");


    const [images] =
        await db.query(
            `
            SELECT
                image_id,
                report_id,
                image_path,
                original_filename,
                stored_filename,
                mime_type,
                file_size,
                image_order,
                ai_relevance_status,
                ai_relevance_score,
                ai_detected_content,
                ai_explanation,
                ai_analyzed_at,
                created_at
            FROM report_images
            WHERE report_id IN (${placeholders})
            ORDER BY
                report_id ASC,
                image_order ASC
            `,
            reportIds
        );


    // Group images by report ID

    const imagesByReport = {};


    for (
        const image of images
    ) {

        if (
            !imagesByReport[
            image.report_id
            ]
        ) {

            imagesByReport[
                image.report_id
            ] = [];

        }


        imagesByReport[
            image.report_id
        ].push({

            ...image,

            image_url:
                image.image_path

        });

    }


    // Add images to each report

    for (
        const report of reports
    ) {

        report.images =
            imagesByReport[
            report.report_id
            ] || [];

    }


    return reports;

}


// ==========================================
// 9. STATIC FILES
// ==========================================


// Public website files

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// Uploaded images

app.use(
    "/uploads",
    express.static(
        uploadsDirectory
    )
);


// ==========================================
// 10. HOMEPAGE ROUTE
// ==========================================

app.get(
    "/",
    (
        req,
        res
    ) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// ==========================================
// 11. BACKEND HEALTH TEST
// ==========================================

app.get(
    "/api/health",
    (
        req,
        res
    ) => {

        res.json({

            success: true,

            message:
                "Civic Fix backend is running!"

        });

    }
);


// ==========================================
// 12. DATABASE CONNECTION TEST
// ==========================================

app.get(
    "/api/db-test",
    async (
        req,
        res
    ) => {

        try {

            const [result] =
                await db.query(
                    "SELECT 1 AS test"
                );


            res.json({

                success: true,

                message:
                    "MySQL database connected successfully!",

                result:
                    result

            });

        }

        catch (
        error
        ) {

            console.error(
                "Database error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Database connection failed."

                });

        }

    }
);


// ==========================================
// 13. LOGIN API
// ==========================================

app.post(
    "/api/auth/login",
    async (
        req,
        res
    ) => {

        try {

            const { email, phone, method, password } = req.body;
            const loginMethod = method === "phone" ? "phone" : "email";
            let loginValue = loginMethod === "phone" ? phone : email;

            if (typeof loginValue !== "string" || loginValue.trim().length === 0) {
                return res.status(400).json({ success: false, message: loginMethod === "phone" ? "Please enter your phone number." : "Please enter your email." });
            }

            if (loginMethod === "phone") {
                const digits = loginValue.replace(/\D/g, "");
                const national = digits.startsWith("880") ? digits.slice(3) : (digits.startsWith("0") ? digits.slice(1) : digits);
                if (!/^1[3-9]\d{8}$/.test(national)) {
                    return res.status(400).json({ success: false, message: "Please enter a valid Bangladesh mobile number." });
                }
                loginValue = "+880" + national;
            } else {
                loginValue = loginValue.trim().toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginValue)) {
                    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
                }
            }


            // Validate password

            if (
                typeof password !== "string" ||

                password.length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please enter your password."

                    });

            }


            // Find user

            const [users] =
                await db.query(
                    `
                    SELECT
                        user_id,
                        full_name,
                        email,
                        phone,
                        password_hash,
                        role,
                       
                        account_status
                    FROM users
                    WHERE ${loginMethod === "phone" ? "phone" : "email"} = ?
                    LIMIT 1
                    `,
                    [
                        loginValue
                    ]
                );


            // User not found

            if (
                users.length === 0
            ) {

                return res
                    .status(401)
                    .json({

                        success: false,

                        message:
                            "Invalid email or password."

                    });

            }


            const user =
                users[0];


            // Check account status

            if (
                user.account_status !== "active"
            ) {

                return res
                    .status(403)
                    .json({

                        success: false,

                        message:
                            "Your account is not active."

                    });

            }


            // Check password

            const passwordMatches =
                await bcrypt.compare(
                    password,
                    user.password_hash
                );


            if (
                !passwordMatches
            ) {

                return res
                    .status(401)
                    .json({

                        success: false,

                        message:
                            "Invalid email or password."

                    });

            }


            // Only Citizen and Admin portals
            // are currently available

            if (
                user.role !== "citizen" &&

                user.role !== "admin"
            ) {

                return res
                    .status(403)
                    .json({

                        success: false,

                        message:
                            "This portal is not available yet."

                    });

            }


            // Create session

            req.session.user = {

                user_id:
                    user.user_id,

                full_name:
                    user.full_name,

                email:
                    user.email,

                role:
                    user.role,

                
                    

            };


            // Save session

            req.session.save(
                function (
                    sessionError
                ) {

                    if (
                        sessionError
                    ) {

                        console.error(
                            "Session save error:",
                            sessionError.message
                        );


                        return res
                            .status(500)
                            .json({

                                success: false,

                                message:
                                    "Unable to create login session."

                            });

                    }


                    res.json({

                        success: true,

                        message:
                            "Login successful.",

                        user: {

                            user_id:
                                user.user_id,

                            full_name:
                                user.full_name,

                            email:
                                user.email,

                            role:
                                user.role

                        }

                    });

                }
            );

        }

        catch (
        error
        ) {

            console.error(
                "Login error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to log in. Please try again."

                });

        }

    }
);


// ==========================================
// 14. GET CURRENT LOGGED-IN USER
// ==========================================

app.get(
    "/api/auth/me",

    requireLogin,

    (
        req,
        res
    ) => {

        res.json({

            success: true,

            user:
                req.session.user

        });

    }
);


// ==========================================
// 15. LOGOUT API
// ==========================================

app.post(
    "/api/auth/logout",

    requireLogin,

    (
        req,
        res
    ) => {

        req.session.destroy(
            function (
                error
            ) {

                if (
                    error
                ) {

                    console.error(
                        "Logout error:",
                        error.message
                    );


                    return res
                        .status(500)
                        .json({

                            success: false,

                            message:
                                "Unable to log out."

                        });

                }


                res.clearCookie(
                    "connect.sid"
                );


                res.json({

                    success: true,

                    message:
                        "Logged out successfully."

                });

            }
        );

    }
);


// ==========================================
// 16. GET ALL REPORTS
// FOR ADMIN DASHBOARD
// ==========================================

app.get(
    "/api/admin/reports",

    requireRole(
        "admin"
    ),

    async (
        req,
        res
    ) => {

        try {

            const sql = `

                SELECT

                    r.report_id,

                    r.tracking_code,

                    r.title,

                    r.description,

                    r.location_address,

                    r.latitude,

                    r.longitude,

                    r.priority,

                    r.status,

                    r.created_at,

                    u.full_name
                        AS citizen_name,

                    c.category_name,

                    i.institution_name,

                    ai.suggested_priority,

                    ai.confidence_score,

                    ai.is_suspicious,

                    ai.is_possible_duplicate,

                    ai.explanation
                        AS ai_explanation,

                    ai.review_status
                        AS ai_review_status,

                    ai.image_analysis_summary,

                    ai.image_overall_relevance,

                    ai.image_confidence_score,

                    ai.image_analysis_status,

                    ai_category.category_name
                        AS ai_suggested_category

                FROM reports r

                LEFT JOIN users u
                    ON r.citizen_id =
                    u.user_id

                LEFT JOIN issue_categories c
                    ON r.category_id =
                    c.category_id

                LEFT JOIN institutions i
                    ON r.assigned_institution_id =
                    i.institution_id

                LEFT JOIN (

                    SELECT
                        a1.*

                    FROM ai_analyses a1

                    INNER JOIN (

                        SELECT

                            report_id,

                            MAX(analysis_id)
                                AS latest_analysis_id

                        FROM ai_analyses

                        GROUP BY report_id

                    ) a2

                        ON a1.analysis_id =
                        a2.latest_analysis_id

                ) ai

                    ON r.report_id =
                    ai.report_id

                LEFT JOIN issue_categories
                    ai_category

                    ON ai.suggested_category_id =
                    ai_category.category_id

                ORDER BY
                    created_at DESC

            `;


            const [reports] =
                await db.query(
                    sql
                );


            // Add images

            await addImagesToReports(
                reports
            );


            res.json({

                success: true,

                count:
                    reports.length,

                reports:
                    reports

            });

        }

        catch (
        error
        ) {

            console.error(
                "Admin reports error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load reports from the database."

                });

        }

    }
);


// ==========================================
// 17. GET ADMIN DASHBOARD STATISTICS
// ==========================================

app.get(
    "/api/admin/stats",

    requireRole(
        "admin"
    ),

    async (
        req,
        res
    ) => {

        try {

            const sql = `

                SELECT

                    COUNT(*)
                        AS total_reports,

                    SUM(

                        CASE

                            WHEN status IN (

                                'submitted',

                                'under_review'

                            )

                            THEN 1

                            ELSE 0

                        END

                    )
                        AS pending_reports,

                    SUM(

                        CASE

                            WHEN status IN (

                                'forwarded',

                                'in_progress'

                            )

                            THEN 1

                            ELSE 0

                        END

                    )
                        AS forwarded_reports,

                    SUM(

                        CASE

                            WHEN status NOT IN (

                                'rejected',

                                'closed'

                            )

                            AND EXISTS (

                                SELECT 1

                                FROM ai_analyses a

                                WHERE a.report_id =
                                    reports.report_id

                                AND (

                                    a.is_suspicious = 1

                                    OR

                                    a.is_possible_duplicate = 1

                                )

                            )

                            THEN 1

                            ELSE 0

                        END

                    )
                        AS flagged_reports

                FROM reports

            `;


            const [result] =
                await db.query(
                    sql
                );


            res.json({

                success: true,

                stats:
                    result[0]

            });

        }

        catch (
        error
        ) {

            console.error(
                "Dashboard statistics error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load dashboard statistics."

                });

        }

    }
);


// ==========================================
// 18. GET CITIZEN PROFILE
// ==========================================

app.get(
    "/api/citizen/profile",

    requireRole(
        "citizen"
    ),

    async (
        req,
        res
    ) => {

        try {

            const citizenId =
                getLoggedInUserId(
                    req
                );


            const [users] =
                await db.query(
                    `
                    SELECT

                        user_id,

                        full_name,

                        email,

                        phone,

                        city,

                        profile_image,

                        auth_provider

                    FROM users

                    WHERE user_id = ?

                    LIMIT 1
                    `,
                    [
                        citizenId
                    ]
                );


            if (
                users.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        success: false,

                        message:
                            "Citizen profile not found."

                    });

            }


            res.json({

                success: true,

                requestLocationPermission: true,

                profile:
                    users[0]

            });

        }

        catch (
        error
        ) {

            console.error(
                "Citizen profile error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load citizen profile."

                });

        }

    }
);

app.put(
    "/api/citizen/profile",
    requireRole("citizen"),
    profileUpload.single("profileImage"),
    async (req, res) => {
        const userId = getLoggedInUserId(req);
        const newImagePath = req.file ? `/uploads/profiles/${req.file.filename}` : null;

        try {
            const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
            const rawEmail = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
            const rawPhone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
            const city = typeof req.body.city === "string" ? req.body.city.trim() : "";
            const currentPassword = typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
            const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";

            if (fullName.length < 2 || fullName.length > 100) {
                if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
            }
            if (rawEmail && (rawEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail))) {
                if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                return res.status(400).json({ success: false, message: "Enter a valid email address." });
            }
            if (city.length > 120) {
                if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                return res.status(400).json({ success: false, message: "City or area must be 120 characters or fewer." });
            }

            let phone = null;
            if (rawPhone) {
                const digits = rawPhone.replace(/\D/g, "");
                const national = digits.startsWith("880") ? digits.slice(3) : (digits.startsWith("0") ? digits.slice(1) : digits);
                if (!/^1[3-9]\d{8}$/.test(national)) {
                    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                    return res.status(400).json({ success: false, message: "Enter a valid Bangladesh mobile number." });
                }
                phone = `+880${national}`;
            }
            if (!rawEmail && !phone) {
                if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                return res.status(400).json({ success: false, message: "Add an email address or phone number so you can sign in." });
            }

            if (newPassword && (newPassword.length < 8 || newPassword.length > 72)) {
                if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                return res.status(400).json({ success: false, message: "New password must be 8 to 72 characters." });
            }

            const [currentRows] = await db.query(
                "SELECT password_hash, auth_provider, profile_image, email, phone, email_verified, phone_verified FROM users WHERE user_id = ? LIMIT 1",
                [userId]
            );
            if (!currentRows.length) {
                if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                return res.status(404).json({ success: false, message: "Citizen account not found." });
            }
            const current = currentRows[0];

            const contactDetailsChanged =
                (rawEmail || null) !== (current.email || null) ||
                phone !== (current.phone || null);
            const emailChanged = (rawEmail || null) !== (current.email || null);
            const phoneChanged = phone !== (current.phone || null);
            if ((newPassword || contactDetailsChanged) && current.auth_provider !== "google") {
                const passwordMatches = current.password_hash && await bcrypt.compare(currentPassword, current.password_hash);
                if (!passwordMatches) {
                    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                    return res.status(400).json({ success: false, message: "Enter your current password to change your email, phone or password." });
                }
            }

            if (rawEmail) {
                const [duplicates] = await db.query(
                    "SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1",
                    [rawEmail, userId]
                );
                if (duplicates.length) {
                    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                    return res.status(409).json({ success: false, message: "That email is already linked to another account." });
                }
            }
            if (phone) {
                const [duplicates] = await db.query(
                    "SELECT user_id FROM users WHERE phone = ? AND user_id <> ? LIMIT 1",
                    [phone, userId]
                );
                if (duplicates.length) {
                    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
                    return res.status(409).json({ success: false, message: "That phone number is already linked to another account." });
                }
            }

            const passwordHash = newPassword
                ? await bcrypt.hash(newPassword, 12)
                : current.password_hash;
            const profileImage = newImagePath || current.profile_image;

            await db.query(
                `UPDATE users
                 SET email_verified = ?, phone_verified = ?, full_name = ?, email = ?, phone = ?, city = ?, profile_image = ?, password_hash = ?
                 WHERE user_id = ?`,
                [
                    emailChanged ? 0 : current.email_verified,
                    phoneChanged ? 0 : current.phone_verified,
                    fullName,
                    rawEmail || null,
                    phone,
                    city || null,
                    profileImage,
                    passwordHash,
                    userId
                ]
            );

            req.session.user.full_name = fullName;
            req.session.user.email = rawEmail || null;
            req.session.user.phone = phone;

            const oldImage = current.profile_image;
            if (newImagePath && oldImage && oldImage.startsWith("/uploads/profiles/")) {
                const oldPath = path.resolve(uploadsDirectory, oldImage.slice("/uploads/".length));
                if (oldPath.startsWith(profilesUploadDirectory + path.sep)) {
                    await fs.promises.unlink(oldPath).catch(() => {});
                }
            }

            return res.json({
                success: true,
                message: "Profile updated successfully.",
                profile: {
                    user_id: userId,
                    full_name: fullName,
                    email: rawEmail || null,
                    phone,
                    city: city || null,
                    profile_image: profileImage
                }
            });
        } catch (error) {
            if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
            console.error("Citizen profile update error:", error.message);
            return res.status(500).json({ success: false, message: "Unable to update your profile." });
        }
    }
);


// ==========================================
// 19. GET LOGGED-IN CITIZEN REPORTS
// ==========================================

app.get(
    "/api/citizen/reports",

    requireRole(
        "citizen"
    ),

    async (
        req,
        res
    ) => {

        try {

            const citizenId =
                getLoggedInUserId(
                    req
                );


            const sql = `

                SELECT
                    report_id,
                    title,
                    description,
                    category AS category_name,
                    location AS location_address,
                    image_path,
                    CASE status
                        WHEN 'pending' THEN 'submitted'
                        WHEN 'in_progress' THEN 'in_progress'
                        ELSE status
                    END AS status,
                    created_at,
                    updated_at
                FROM reports
                WHERE user_id = ?

                ORDER BY
                    created_at DESC

            `;


            const [reports] =
                await db.query(
                    sql,
                    [
                        citizenId
                    ]
                );


            // This schema stores one optional image path on each report.
            for (const report of reports) {
                report.tracking_code = `CF-${report.report_id}`;
                report.images = report.image_path
                    ? [{ image_path: report.image_path, image_url: report.image_path }]
                    : [];
            }


            res.json({

                success: true,

                count:
                    reports.length,

                reports:
                    reports

            });

        }

        catch (
        error
        ) {

            console.error(
                "Citizen reports error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load your reports."

                });

        }

    }
);


// ==========================================
// 20. SUBMIT A NEW CITIZEN REPORT
// Matches the supplied civic_fix.sql report schema.
app.post(
    "/api/citizen/reports",
    requireRole("citizen"),
    upload.array("images", 3),
    async (req, res) => {
        const uploadedFiles = req.files || [];
        let connection;
        const reject = (status, message) => {
            deleteUploadedFiles(uploadedFiles);
            return res.status(status).json({ success: false, message });
        };
        try {
            const citizenId = getLoggedInUserId(req);
            const { title, category, description, location, latitude, longitude } = req.body;
            if (typeof title !== "string" || !title.trim() || title.trim().length > 200)
                return reject(400, "Enter a title of up to 200 characters.");
            if (typeof category !== "string" || !category.trim() || category.trim().length > 100)
                return reject(400, "Select a valid issue category.");
            if (typeof description !== "string" || description.trim().length < 20 || description.trim().length > 2000)
                return reject(400, "The description must be between 20 and 2000 characters.");
            if (typeof location !== "string" || !location.trim() || location.trim().length > 255)
                return reject(400, "Enter an issue location of up to 255 characters.");

            const hasLatitude = latitude != null && String(latitude).trim() !== "";
            const hasLongitude = longitude != null && String(longitude).trim() !== "";
            if (hasLatitude !== hasLongitude) return reject(400, "Provide both latitude and longitude.");

            let validLatitude = null;
            let validLongitude = null;
            if (hasLatitude) {
                validLatitude = Number(latitude);
                validLongitude = Number(longitude);
                if (!Number.isFinite(validLatitude) || validLatitude < -90 || validLatitude > 90 ||
                    !Number.isFinite(validLongitude) || validLongitude < -180 || validLongitude > 180)
                    return reject(400, "The location coordinates are invalid.");
            }

            const imagePath = uploadedFiles.length
                ? "/uploads/reports/" + uploadedFiles[0].filename
                : null;

            connection = await db.getConnection();
            await connection.beginTransaction();
            const [result] = await connection.query(
                `INSERT INTO reports
                    (user_id, title, description, category, location, image_path, latitude, longitude, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [citizenId, title.trim(), description.trim(), category.trim(), location.trim(),
                    imagePath, validLatitude, validLongitude]
            );

            const reportId = result.insertId;
            for (let index = 0; index < uploadedFiles.length; index++) {
                const file = uploadedFiles[index];
                await connection.query(
                    `INSERT INTO report_images
                        (report_id, image_path, original_filename, stored_filename, mime_type, file_size, image_order, ai_relevance_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
                    [reportId, "/uploads/reports/" + file.filename, file.originalname,
                        file.filename, file.mimetype, file.size, index + 1]
                );
            }
            await connection.commit();

            const images = uploadedFiles.map(file => ({
                image_path: "/uploads/reports/" + file.filename,
                image_url: "/uploads/reports/" + file.filename,
                original_filename: file.originalname
            }));
            return res.status(201).json({
                success: true,
                message: "Your report has been submitted successfully.",
                report: {
                    report_id: reportId,
                    tracking_code: "CF-" + reportId,
                    title: title.trim(),
                    description: description.trim(),
                    category_name: category.trim(),
                    location_address: location.trim(),
                    latitude: validLatitude,
                    longitude: validLongitude,
                    status: "pending",
                    created_at: new Date().toISOString(),
                    images
                }
            });
        } catch (error) {
            if (connection) await connection.rollback().catch(() => {});
            deleteUploadedFiles(uploadedFiles);
            console.error("Citizen report submission error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Unable to submit this report. Please try again."
            });
        } finally {
            if (connection) connection.release();
        }
    }
);


// 21. GET CITIZEN DASHBOARD STATISTICS
// ==========================================

app.get(
    "/api/citizen/stats",

    requireRole(
        "citizen"
    ),

    async (
        req,
        res
    ) => {

        try {

            const citizenId =
                getLoggedInUserId(
                    req
                );


            const sql = `

                SELECT

                    COUNT(*)
                        AS total_reports,

                    SUM(

                        CASE

                            WHEN status IN (

                                'pending',

                                'in_progress'

                            )

                            THEN 1

                            ELSE 0

                        END

                    )
                        AS progress_reports,

                    SUM(

                        CASE

                            WHEN status =
                                'resolved'

                            THEN 1

                            ELSE 0

                        END

                    )
                        AS resolved_reports

                FROM reports

                WHERE user_id = ?

            `;


            const [result] =
                await db.query(
                    sql,
                    [
                        citizenId
                    ]
                );


            res.json({

                success: true,

                stats: {

                    total_reports:

                        Number(

                            result[0]
                                .total_reports ||

                            0

                        ),


                    progress_reports:

                        Number(

                            result[0]
                                .progress_reports ||

                            0

                        ),


                    resolved_reports:

                        Number(

                            result[0]
                                .resolved_reports ||

                            0

                        )

                }

            });

        }

        catch (
        error
        ) {

            console.error(
                "Citizen statistics error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to load your dashboard statistics."

                });

        }

    }
);


// ==========================================
// ==========================================
// 21A. CITIZEN MAP ADDRESS SEARCH
// Proxy and cache user-triggered Nominatim searches; keep requests paced per server.
// GEOCODER_URL can point to another Nominatim-compatible provider.
// ==========================================

app.get(
    "/api/citizen/geocode",
    requireRole("citizen"),
    async (req, res) => {
        const query = typeof req.query.q === "string"
            ? req.query.q.trim().replace(/\s+/g, " ")
            : "";
        if (query.length < 3 || query.length > 180) {
            return res.status(400).json({ success: false, message: "Enter a location between 3 and 180 characters." });
        }

        const cacheKey = query.toLocaleLowerCase();
        const maxCacheAge = 7 * 24 * 60 * 60 * 1000;
        const cached = geocodeResultCache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < maxCacheAge) {
            return res.json({ success: true, place: cached.place, cached: true });
        }

        let releaseQueue;
        const previousRequest = geocodeRequestQueue;
        geocodeRequestQueue = new Promise(resolve => { releaseQueue = resolve; });
        await previousRequest;

        try {
            const queuedCache = geocodeResultCache.get(cacheKey);
            if (queuedCache && Date.now() - queuedCache.cachedAt < maxCacheAge) {
                return res.json({ success: true, place: queuedCache.place, cached: true });
            }

            const waitMs = Math.max(0, 1100 - (Date.now() - lastGeocodeRequestAt));
            if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
            lastGeocodeRequestAt = Date.now();

            const geocoderUrl = new URL(process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org/search");
            geocoderUrl.searchParams.set("format", "jsonv2");
            geocoderUrl.searchParams.set("limit", "1");
            geocoderUrl.searchParams.set("q", query);
            const response = await fetch(geocoderUrl, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "CivicFix/1.0 (citizen service request map)",
                    ...(process.env.PUBLIC_BASE_URL ? { Referer: process.env.PUBLIC_BASE_URL } : {})
                },
                signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) {
                console.error("Citizen map geocoder response:", response.status);
                return res.status(502).json({ success: false, message: "Location search is temporarily unavailable." });
            }

            const results = await response.json();
            const result = Array.isArray(results) ? results[0] : null;
            const place = result && Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lon))
                ? {
                    lat: Number(result.lat),
                    lon: Number(result.lon),
                    name: typeof result.name === "string" ? result.name.slice(0, 180) : "",
                    display_name: typeof result.display_name === "string" ? result.display_name.slice(0, 300) : ""
                }
                : null;

            if (geocodeResultCache.size >= 1000) {
                geocodeResultCache.delete(geocodeResultCache.keys().next().value);
            }
            geocodeResultCache.set(cacheKey, { place, cachedAt: Date.now() });
            return res.json({ success: true, place, cached: false });
        } catch (error) {
            console.error("Citizen map geocoder error:", error.message);
            return res.status(502).json({ success: false, message: "Location search is temporarily unavailable." });
        } finally {
            releaseQueue();
        }
    }
);

// 22. LOCAL CITIZEN NEWSFEED
// Uses browser-provided coordinates only for this request; there is no background tracking.
// ==========================================

app.get(
    "/api/citizen/newsfeed",
    requireRole("citizen"),
    async (req, res) => {
        const latitude = Number(req.query.lat);
        const longitude = Number(req.query.lng);
        const radiusKm = Number(req.query.radiusKm || 10);

        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
            !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 50) {
            return res.status(400).json({ success: false, message: "Provide valid coordinates and a radius between 1 and 50 km." });
        }

        try {
            const [reports] = await db.query(`
                SELECT
                    r.report_id,
                    r.title,
                    r.description,
                    r.category,
                    r.location,
                    r.image_path,
                    r.latitude,
                    r.longitude,
                    r.status,
                    r.created_at,
                    r.updated_at,
                    ROUND(6371 * ACOS(LEAST(1, GREATEST(-1,
                        SIN(RADIANS(?)) * SIN(RADIANS(r.latitude)) +
                        COS(RADIANS(?)) * COS(RADIANS(r.latitude)) *
                        COS(RADIANS(r.longitude) - RADIANS(?))
                    ))), 2) AS distance_km,
                    (SELECT COUNT(*) FROM report_comments rc WHERE rc.report_id = r.report_id) AS comment_count
                FROM reports r
                INNER JOIN users u ON u.user_id = r.user_id
                WHERE u.role = 'citizen'
                    AND u.account_status = 'active'
                    AND r.latitude IS NOT NULL
                    AND r.longitude IS NOT NULL
                HAVING distance_km <= ?
                ORDER BY r.created_at DESC, r.report_id DESC
            `, [latitude, latitude, longitude, radiusKm]);

            await addImagesToReports(reports);
            for (const report of reports) {
                report.tracking_code = `CF-${report.report_id}`;
                report.images = report.images || [];
                if (!report.images.length && report.image_path) {
                    report.images = [{ image_path: report.image_path, image_url: report.image_path }];
                }
                report.comment_count = Number(report.comment_count || 0);
                report.distance_km = Number(report.distance_km || 0);
            }

            return res.json({ success: true, radiusKm, count: reports.length, reports });
        } catch (error) {
            console.error("Citizen newsfeed error:", error.message);
            return res.status(500).json({ success: false, message: "Unable to load nearby reports." });
        }
    }
);

app.get(
    "/api/citizen/reports/:reportId/comments",
    requireRole("citizen"),
    async (req, res) => {
        const reportId = Number(req.params.reportId);
        if (!Number.isSafeInteger(reportId) || reportId < 1) {
            return res.status(400).json({ success: false, message: "Invalid report ID." });
        }
        try {
            const [reports] = await db.query("SELECT report_id FROM reports WHERE report_id = ? LIMIT 1", [reportId]);
            if (!reports.length) return res.status(404).json({ success: false, message: "Report not found." });
            const [comments] = await db.query(`
                SELECT c.comment_id, c.comment_text, c.created_at, u.full_name AS author
                FROM report_comments c
                INNER JOIN users u ON u.user_id = c.user_id
                WHERE c.report_id = ?
                ORDER BY c.created_at ASC, c.comment_id ASC
            `, [reportId]);
            return res.json({ success: true, comments });
        } catch (error) {
            console.error("Citizen report comments error:", error.message);
            return res.status(500).json({ success: false, message: "Unable to load report comments." });
        }
    }
);

app.post(
    "/api/citizen/reports/:reportId/comments",
    requireRole("citizen"),
    async (req, res) => {
        const reportId = Number(req.params.reportId);
        const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
        if (!Number.isSafeInteger(reportId) || reportId < 1) {
            return res.status(400).json({ success: false, message: "Invalid report ID." });
        }
        if (!comment || comment.length > 1000) {
            return res.status(400).json({ success: false, message: "Write a comment of up to 1000 characters." });
        }
        try {
            const [reports] = await db.query("SELECT report_id FROM reports WHERE report_id = ? LIMIT 1", [reportId]);
            if (!reports.length) return res.status(404).json({ success: false, message: "Report not found." });
            const [result] = await db.query(
                "INSERT INTO report_comments (report_id, user_id, comment_text) VALUES (?, ?, ?)",
                [reportId, getLoggedInUserId(req), comment]
            );
            return res.status(201).json({
                success: true,
                comment: {
                    comment_id: result.insertId,
                    comment_text: comment,
                    author: req.session.user.full_name || "Citizen",
                    created_at: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error("Citizen comment submission error:", error.message);
            return res.status(500).json({ success: false, message: "Unable to post this comment." });
        }
    }
);


// ==========================================
// 23. CITIZEN LEADERBOARD
// Give 10 points for each report that has been accepted for action or resolved.
// Pending reports have not been validated yet; rejected reports never score.
// ==========================================

app.get(
    "/api/citizen/leaderboard",
    requireRole("citizen"),
    async (req, res) => {
        try {
            const citizenId = getLoggedInUserId(req);
            const [rows] = await db.query(`
                SELECT
                    u.user_id,
                    u.full_name,
                    COUNT(r.report_id) AS legitimate_reports
                FROM users u
                LEFT JOIN reports r
                    ON r.user_id = u.user_id
                    AND r.status IN ('in_progress', 'resolved')
                WHERE u.role = 'citizen'
                    AND u.account_status = 'active'
                GROUP BY u.user_id, u.full_name
                ORDER BY legitimate_reports DESC, u.full_name ASC, u.user_id ASC
            `);

            const leaderboard = rows.map((row, index) => {
                const legitimateReports = Number(row.legitimate_reports || 0);
                return {
                    rank: index + 1,
                    name: row.full_name || "Citizen",
                    legitimateReports,
                    points: legitimateReports * 10,
                    isCurrentUser: Number(row.user_id) === Number(citizenId)
                };
            });
            const current = leaderboard.find(entry => entry.isCurrentUser);

            return res.json({
                success: true,
                pointsPerLegitimateReport: 10,
                currentUser: {
                    rank: current ? current.rank : null,
                    legitimateReports: current ? current.legitimateReports : 0,
                    points: current ? current.points : 0
                },
                leaderboard
            });
        } catch (error) {
            console.error("Citizen leaderboard error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Unable to load the citizen leaderboard."
            });
        }
    }
);


// ==========================================
// 24. MULTER ERROR HANDLER
// ==========================================

app.use(
    function (
        error,
        req,
        res,
        next
    ) {

        if (
            error instanceof
            multer.MulterError
        ) {

            // Too many files

            if (
                error.code ===
                "LIMIT_UNEXPECTED_FILE"
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            req.path === "/api/citizen/profile"
                                ? "Upload one profile picture at a time."
                                : "You can upload a maximum of 3 images."

                    });

            }


            // File too large

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            req.path === "/api/citizen/profile"
                                ? "Profile picture must be 2 MB or smaller."
                                : "Each image must be 5 MB or smaller."

                    });

            }


            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        error.message

                });

        }


        // File type error

        if (
            error.message ===
            "Only JPG, JPEG, PNG, and WebP images are allowed."
        ) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        error.message

                });

        }


        next(
            error
        );

    }
);


// ==========================================
// 23. START SERVER
// ==========================================

const PORT =
    process.env.PORT ||
    3000;


app.listen(
    PORT,
    () => {

        console.log(
            `Civic Fix server running at http://localhost:${PORT}`
        );


        console.log(
            `Image upload folder: ${reportsUploadDirectory}`
        );

    }
);
