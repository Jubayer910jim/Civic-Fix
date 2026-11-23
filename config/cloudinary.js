const cloudinary = require("cloudinary").v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const configured = Boolean(cloudName && apiKey && apiSecret);

if (configured) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });
}

async function uploadLocalImage(localPath, folder, publicId) {
    if (!configured) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Cloud image storage is not configured.");
        }
        return null;
    }

    const asset = await cloudinary.uploader.upload(localPath, {
        folder: `civic-fix/${folder}`,
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
        unique_filename: false
    });

    return {
        url: asset.secure_url,
        publicId: asset.public_id
    };
}

async function destroyImage(publicId) {
    if (!configured || !publicId) return;

    try {
        await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
            invalidate: true
        });
    } catch (error) {
        console.error("Unable to remove cloud image:", error.message);
    }
}

function publicIdFromUrl(value) {
    if (typeof value !== "string" || !cloudName) return null;

    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" || parsed.hostname !== `${cloudName}.res.cloudinary.com`) return null;

        const segments = parsed.pathname.split("/").filter(Boolean);
        const uploadIndex = segments.indexOf("upload");
        if (uploadIndex < 0) return null;

        const afterUpload = segments.slice(uploadIndex + 1);
        const versionIndex = afterUpload.findIndex(segment => /^v\\d+$/.test(segment));
        if (versionIndex < 0) return null;

        const assetPath = afterUpload.slice(versionIndex + 1);
        if (!assetPath.length) return null;

        assetPath[assetPath.length - 1] = assetPath[assetPath.length - 1].replace(/\\.[^.]+$/, "");
        return assetPath.join("/");
    } catch {
        return null;
    }
}

module.exports = {
    configured,
    uploadLocalImage,
    destroyImage,
    publicIdFromUrl
};
