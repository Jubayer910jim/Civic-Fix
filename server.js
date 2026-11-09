
// ==========================================
// CIVIC FIX - SERVER
// Node.js + Express + MySQL
// Citizen + Admin Authentication
// Optional Image Upload Support
// ==========================================


// ==========================================
// 1. IMPORT PACKAGES
// ==========================================

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

            const {
                email,
                password
            } = req.body;


            // Validate email

            if (
                typeof email !== "string" ||

                email.trim().length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please enter your email."

                    });

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
                        password_hash,
                        role,
                        institution_id,
                        account_status
                    FROM users
                    WHERE email = ?
                    LIMIT 1
                    `,
                    [
                        email.trim()
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

                institution_id:
                    user.institution_id

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
                    r.created_at DESC

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

                        email

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

                    r.report_id,

                    r.tracking_code,

                    r.title,

                    r.description,

                    r.location_address,

                    r.latitude,

                    r.longitude,

                    r.priority,

                    r.status,

                    r.resolution_description,

                    r.created_at,

                    r.updated_at,

                    c.category_name,

                    i.institution_name

                FROM reports r

                LEFT JOIN issue_categories c

                    ON r.category_id =
                    c.category_id

                LEFT JOIN institutions i

                    ON r.assigned_institution_id =
                    i.institution_id

                WHERE r.citizen_id = ?

                ORDER BY
                    r.created_at DESC

            `;


            const [reports] =
                await db.query(
                    sql,
                    [
                        citizenId
                    ]
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
// 20. SUBMIT A NEW CITIZEN COMPLAINT
// ==========================================

// Images are OPTIONAL.
//
// 0 images = allowed
// 1 image  = allowed
// 2 images = allowed
// 3 images = allowed
//
// More than 3 = rejected.
//
// GPS coordinates are also optional.
// Citizens can submit complaints using
// their written issue location.


app.post(
    "/api/citizen/reports",

    requireRole(
        "citizen"
    ),

    upload.array(
        "images",
        3
    ),

    async (
        req,
        res
    ) => {

        const uploadedFiles =
            req.files || [];


        try {

            const citizenId =
                getLoggedInUserId(
                    req
                );


            const {

                title,

                category,

                description,

                location,

                latitude,

                longitude

            } = req.body;


            // --------------------------------------
            // VALIDATE TITLE
            // --------------------------------------

            if (

                typeof title !== "string" ||

                title.trim().length === 0 ||

                title.trim().length > 220

            ) {

                deleteUploadedFiles(
                    uploadedFiles
                );


                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please enter a title of up to 220 characters."

                    });

            }


            // --------------------------------------
            // VALIDATE CATEGORY
            // --------------------------------------

            if (

                typeof category !== "string" ||

                category.trim().length === 0

            ) {

                deleteUploadedFiles(
                    uploadedFiles
                );


                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please select an issue category."

                    });

            }


            // --------------------------------------
            // VALIDATE DESCRIPTION
            // --------------------------------------

            if (

                typeof description !== "string" ||

                description.trim().length < 20

            ) {

                deleteUploadedFiles(
                    uploadedFiles
                );


                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Description must contain at least 20 characters."

                    });

            }


            // --------------------------------------
            // VALIDATE LOCATION ADDRESS
            // --------------------------------------

            if (

                typeof location !== "string" ||

                location.trim().length === 0 ||

                location.trim().length > 300

            ) {

                deleteUploadedFiles(
                    uploadedFiles
                );


                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please enter a valid issue location."

                    });

            }


            // --------------------------------------
            // VALIDATE OPTIONAL GPS COORDINATES
            // --------------------------------------

            let validLatitude = null;

            let validLongitude = null;


            const hasLatitude =
                latitude !== undefined &&
                latitude !== null &&
                String(latitude).trim() !== "";


            const hasLongitude =
                longitude !== undefined &&
                longitude !== null &&
                String(longitude).trim() !== "";


            // If one coordinate is provided,
            // both coordinates must be provided.

            if (
                hasLatitude !== hasLongitude
            ) {

                deleteUploadedFiles(
                    uploadedFiles
                );


                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "Please provide both latitude and longitude."

                    });

            }


            // GPS coordinates are optional.

            if (
                hasLatitude &&
                hasLongitude
            ) {

                validLatitude =
                    Number(latitude);

                validLongitude =
                    Number(longitude);


                if (

                    !Number.isFinite(
                        validLatitude
                    ) ||

                    validLatitude < -90 ||

                    validLatitude > 90

                ) {

                    deleteUploadedFiles(
                        uploadedFiles
                    );


                    return res
                        .status(400)
                        .json({

                            success: false,

                            message:
                                "Invalid latitude value."

                        });

                }


                if (

                    !Number.isFinite(
                        validLongitude
                    ) ||

                    validLongitude < -180 ||

                    validLongitude > 180

                ) {

                    deleteUploadedFiles(
                        uploadedFiles
                    );


                    return res
                        .status(400)
                        .json({

                            success: false,

                            message:
                                "Invalid longitude value."

                        });

                }

            }


            // --------------------------------------
            // FIND CATEGORY ID
            // --------------------------------------

            const [categories] =
                await db.query(
                    `
                    SELECT
                        category_id

                    FROM issue_categories

                    WHERE
                        LOWER(category_name) =
                        LOWER(?)

                    AND status = 'active'

                    LIMIT 1
                    `,
                    [
                        category.trim()
                    ]
                );


            if (
                categories.length === 0
            ) {

                deleteUploadedFiles(
                    uploadedFiles
                );


                return res
                    .status(400)
                    .json({

                        success: false,

                        message:
                            "The selected issue category was not found."

                    });

            }


            // --------------------------------------
            // GENERATE TRACKING CODE
            // --------------------------------------

            const trackingCode =

                "CF-" +

                Date.now() +

                "-" +

                crypto
                    .randomBytes(3)
                    .toString("hex")
                    .toUpperCase();


            // --------------------------------------
            // INSERT REPORT
            // --------------------------------------

            const insertSql = `

                INSERT INTO reports (

                    tracking_code,

                    citizen_id,

                    category_id,

                    title,

                    description,

                    location_address,

                    latitude,

                    longitude,

                    priority,

                    status

                )

                VALUES (

                    ?, ?, ?, ?, ?, ?, ?, ?,

                    'medium',

                    'submitted'

                )

            `;


            const [result] =
                await db.query(
                    insertSql,
                    [

                        trackingCode,

                        citizenId,

                        categories[0]
                            .category_id,

                        title.trim(),

                        description.trim(),

                        location.trim(),

                        validLatitude,

                        validLongitude

                    ]
                );


            const reportId =
                result.insertId;


            // --------------------------------------
            // SAVE OPTIONAL IMAGES
            // --------------------------------------

            if (
                uploadedFiles.length > 0
            ) {

                for (
                    let index = 0;

                    index <
                    uploadedFiles.length;

                    index++
                ) {

                    const file =
                        uploadedFiles[index];


                    const imagePath =
                        "/uploads/reports/" +
                        file.filename;


                    await db.query(
                        `
                        INSERT INTO report_images (

                            report_id,

                            image_path,

                            original_filename,

                            stored_filename,

                            mime_type,

                            file_size,

                            image_order,

                            ai_relevance_status

                        )

                        VALUES (

                            ?, ?, ?, ?, ?, ?, ?,

                            'pending'

                        )
                        `,
                        [

                            reportId,

                            imagePath,

                            file.originalname,

                            file.filename,

                            file.mimetype,

                            file.size,

                            index + 1

                        ]
                    );

                }

            }


            // --------------------------------------
            // RETRIEVE NEW REPORT
            // --------------------------------------

            const [newReports] =
                await db.query(
                    `
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

                        c.category_name

                    FROM reports r

                    LEFT JOIN issue_categories c

                        ON r.category_id =
                        c.category_id

                    WHERE

                        r.report_id = ?

                    AND

                        r.citizen_id = ?
                    `,
                    [

                        reportId,

                        citizenId

                    ]
                );


            // Add images to response

            await addImagesToReports(
                newReports
            );


            res
                .status(201)
                .json({

                    success: true,

                    message:
                        uploadedFiles.length > 0

                            ?

                            "Your complaint and supporting images have been submitted successfully."

                            :

                            "Your complaint has been submitted successfully.",

                    report:
                        newReports[0]

                });

        }

        catch (
            error
        ) {

            console.error(
                "Complaint submission error:",
                error.message
            );


            // Remove uploaded files
            // if database processing fails

            deleteUploadedFiles(
                uploadedFiles
            );


            res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Unable to submit your complaint. Please try again."

                });

        }

    }
);


// ==========================================
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

                                'submitted',

                                'under_review',

                                'forwarded',

                                'in_progress',

                                'reopened'

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

                WHERE citizen_id = ?

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
// 22. MULTER ERROR HANDLER
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
                            "You can upload a maximum of 3 images."

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
                            "Each image must be 5 MB or smaller."

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
