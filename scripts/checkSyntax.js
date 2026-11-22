"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const files = [
    "server.js",
    "config/db.js",
    "routes/auth.js",
    "public/js/admin.js",
    "public/js/authority.js",
    "public/js/citizen.js",
    "public/js/institution.js",
    "public/js/login.js",
    "public/js/main.js",
    "scripts/seedAuthorityAccount.js",
    "scripts/seedInstitutionAccounts.js"
];

let failed = false;
for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", path.resolve(__dirname, "..", file)], { stdio: "inherit" });
    if (result.error) {
        console.error(`Could not check ${file}: ${result.error.message}`);
        failed = true;
    } else if (result.status !== 0) {
        failed = true;
    }
}

if (failed) process.exitCode = 1;
else console.log(`Syntax checks passed for ${files.length} JavaScript files.`);
