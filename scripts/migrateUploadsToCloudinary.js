require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { configured, uploadLocalImage } = require("../config/cloudinary");

const uploadsDirectory = path.resolve(__dirname, "..", "uploads");
const dryRun = process.argv.includes("--dry-run");

function getLegacyUploadInfo(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const normalized = value.trim().replace(/\\\\/g, "/").replace(/^\\/+/, "");
    if (!normalized.startsWith("uploads/")) return null;

    const relativePath = normalized.slice("uploads/".length);
    const folder = relativePath.split("/")[0];
    if (!["reports", "profiles"].includes(folder)) return null;

    const absolutePath = path.resolve(uploadsDirectory, relativePath);
    if (!absolutePath.startsWith(uploadsDirectory + path.sep)) return null;

    return {
        absolutePath,
        folder,
        publicId: path.parse(path.basename(relativePath)).name
    };
}

async function main() {
    if (!configured) throw new Error("Set the Cloudinary environment variables first.");
    if (!/aivencloud\\.com$/i.test(process.env.DB_HOST || "")) {
        throw new Error("Point this migration at the live Aiven database using DB_HOST.");
    }

    const [users] = await db.query(
        "SELECT user_id, profile_image FROM users WHERE profile_image IS NOT NULL"
    );
    const [reports] = await db.query(
        "SELECT report_id, image_path FROM reports WHERE image_path IS NOT NULL"
    );
    const [reportImages] = await db.query(
        "SELECT image_id, image_path FROM report_images WHERE image_path IS NOT NULL"
    );

    const references = [];
    for (const row of users) references.push({ table: "users", id: row.user_id, path: row.profile_image });
    for (const row of reports) references.push({ table: "reports", id: row.report_id, path: row.image_path });
    for (const row of reportImages) references.push({ table: "report_images", id: row.image_id, path: row.image_path });

    const legacyPaths = new Map();
    for (const reference of references) {
        const info = getLegacyUploadInfo(reference.path);
        if (info) legacyPaths.set(reference.path, info);
    }

    if (dryRun) {
        const missing = [...legacyPaths.values()].filter(info => !fs.existsSync(info.absolutePath)).length;
        console.log(JSON.stringify({ dryRun: true, localImagesFound: legacyPaths.size - missing, localImagesMissing: missing }));
        return;
    }

    const assets = new Map();
    let missingFiles = 0;
    for (const [storedPath, info] of legacyPaths) {
        if (!fs.existsSync(info.absolutePath)) {
            missingFiles += 1;
            continue;
        }
        const asset = await uploadLocalImage(
            info.absolutePath,
            info.folder,
            info.publicId,
            { overwrite: true }
        );
        assets.set(storedPath, asset);
    }

    const connection = await db.getConnection();
    const updated = { profiles: 0, reports: 0, reportImages: 0 };
    try {
        await connection.beginTransaction();

        for (const row of users) {
            const asset = assets.get(row.profile_image);
            if (!asset) continue;
            const [result] = await connection.execute(
                "UPDATE users SET profile_image = ? WHERE user_id = ? AND profile_image = ?",
                [asset.url, row.user_id, row.profile_image]
            );
            updated.profiles += result.affectedRows;
        }

        for (const row of reports) {
            const asset = assets.get(row.image_path);
            if (!asset) continue;
            const [result] = await connection.execute(
                "UPDATE reports SET image_path = ? WHERE report_id = ? AND image_path = ?",
                [asset.url, row.report_id, row.image_path]
            );
            updated.reports += result.affectedRows;
        }

        for (const row of reportImages) {
            const asset = assets.get(row.image_path);
            if (!asset) continue;
            const [result] = await connection.execute(
                "UPDATE report_images SET image_path = ?, stored_filename = ? WHERE image_id = ? AND image_path = ?",
                [asset.url, asset.publicId, row.image_id, row.image_path]
            );
            updated.reportImages += result.affectedRows;
        }

        await connection.commit();
        console.log(JSON.stringify({
            migrated: true,
            uploadedAssets: assets.size,
            updated,
            missingLocalFiles: missingFiles
        }));
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
    }
}

main()
    .catch(error => {
        console.error("Cloud image migration failed:", error.code || error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end().catch(() => {});
    });
