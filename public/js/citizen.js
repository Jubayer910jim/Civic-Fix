/* =========================================================
   CIVIC FIX - CITIZEN PORTAL JAVASCRIPT
   Connected to Node.js + Express + MySQL
   Optional report images: maximum 3 images, 5 MB each
========================================================= */


/* =========================================================
   1. GLOBAL VARIABLES AND CONFIGURATION
========================================================= */

let currentLanguage = "en";
let citizenReports = [];

let citizenProfile = {
    full_name: "Citizen",
    email: ""
};

let citizenStats = {
    total_reports: 0,
    progress_reports: 0,
    resolved_reports: 0
};

const API_URL = "/api/citizen";
const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const $ = (id) => document.getElementById(id);

let selectedImageFiles = [];
let previewObjectURLs = [];
let isSubmittingReport = false;


/* =========================================================
   2. GENERAL HELPER FUNCTIONS
========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[character]));
}

function getInitials(fullName) {
    const name = String(fullName || "Citizen").trim();

    if (!name) return "CF";

    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");
}

function getCurrentText(english, bangla) {
    return currentLanguage === "bn" ? bangla : english;
}

function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return date.toLocaleDateString(
        currentLanguage === "bn" ? "bn-BD" : "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function getFriendlyStatus(status) {
    const value = String(status || "submitted").toLowerCase().replace(/[ -]/g, "_");

    const statusMap = {
        submitted: "Submitted",
        under_review: "Under review",
        forwarded: "Forwarded",
        in_progress: "In progress",
        resolved: "Resolved",
        reopened: "Reopened",
        rejected: "Rejected",
        closed: "Closed",
        on_hold: "On hold"
    };

    return statusMap[value] || String(status || "Submitted");
}

function getTranslatedStatus(status) {
    const friendlyStatus = getFriendlyStatus(status);

    const translations = {
        "Submitted": "জমা হয়েছে",
        "Under review": "যাচাই হচ্ছে",
        "Forwarded": "পাঠানো হয়েছে",
        "In progress": "কাজ চলছে",
        "Resolved": "সমাধান হয়েছে",
        "Reopened": "পুনরায় খোলা হয়েছে",
        "Rejected": "বাতিল করা হয়েছে",
        "Closed": "বন্ধ হয়েছে",
        "On hold": "স্থগিত রয়েছে"
    };

    return currentLanguage === "bn"
        ? (translations[friendlyStatus] || friendlyStatus)
        : friendlyStatus;
}

function getStatusClass(status) {
    const value = getFriendlyStatus(status).toLowerCase();

    if (value === "resolved" || value === "closed") return "resolved";
    if (value === "submitted" || value === "under review") return "submitted";
    if (value === "rejected") return "rejected";
    if (value === "reopened") return "reopened";

    return "forwarded";
}

function normalizeReport(report) {
    const images = Array.isArray(report.images) ? report.images : [];

    return {
        ...report,
        id: report.tracking_code || report.id || report.report_id || "—",
        report_id: report.report_id || null,
        title: report.title || "Untitled report",
        category: report.category_name || report.category || "Other",
        description: report.description || "",
        location: report.location_address || report.location || "Not provided",
        latitude: report.latitude ?? null,
        longitude: report.longitude ?? null,
        priority: report.priority || "medium",
        status: getFriendlyStatus(report.status),
        date: formatDate(report.created_at || report.date),
        images
    };
}


/* =========================================================
   3. API REQUEST HELPER
   Important: FormData must NOT receive a manual Content-Type.
   The browser adds the multipart boundary automatically.
========================================================= */

async function apiRequest(url, options = {}) {
    const requestOptions = { ...options };
    const headers = { ...(requestOptions.headers || {}) };
    const bodyIsFormData =
        typeof FormData !== "undefined" &&
        requestOptions.body instanceof FormData;

    if (!bodyIsFormData && requestOptions.body !== undefined && requestOptions.body !== null) {
        const hasContentType = Object.keys(headers).some(
            key => key.toLowerCase() === "content-type"
        );

        if (!hasContentType) {
            headers["Content-Type"] = "application/json";
        }
    }

    requestOptions.headers = headers;
    requestOptions.credentials = requestOptions.credentials || "same-origin";

    const response = await fetch(url, requestOptions);

    let responseData = {};
    const responseType = response.headers.get("content-type") || "";

    if (responseType.includes("application/json")) {
        responseData = await response.json();
    } else {
        const responseText = await response.text();
        responseData = responseText ? { message: responseText } : {};
    }

    if (!response.ok || responseData.success === false) {
        const error = new Error(
            responseData.message ||
            `Request failed with status ${response.status}.`
        );

        error.status = response.status;
        error.data = responseData;

        if (response.status === 401) {
            showToast(getCurrentText(
                "Your session has expired. Please log in again.",
                "আপনার সেশনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।"
            ));
        }

        throw error;
    }

    return responseData;
}


/* =========================================================
   4. CITIZEN PROFILE AND GREETING
========================================================= */

function updateGreeting() {
    const greetingElement = $("greetingText");
    const nameElement = $("citizenGreetingName");

    if (!greetingElement || !nameElement) return;

    const hour = new Date().getHours();
    let englishGreeting = "Good evening,";
    let banglaGreeting = "শুভ সন্ধ্যা,";

    if (hour < 12) {
        englishGreeting = "Good morning,";
        banglaGreeting = "শুভ সকাল,";
    } else if (hour < 17) {
        englishGreeting = "Good afternoon,";
        banglaGreeting = "শুভ অপরাহ্ন,";
    }

    greetingElement.textContent = getCurrentText(englishGreeting, banglaGreeting);
    nameElement.textContent = citizenProfile.full_name || "Citizen";
}

function updateProfileInterface() {
    const fullName = citizenProfile.full_name || "Citizen";
    const initials = getInitials(fullName);

    if ($("citizenProfileName")) {
        $("citizenProfileName").textContent = fullName;
    }

    if ($("citizenAvatarInitials")) {
        $("citizenAvatarInitials").textContent = initials;
    }

    if ($("citizenTopAvatar")) {
        $("citizenTopAvatar").textContent = initials;
    }

    updateGreeting();
    updateAccountDropdown();
}

async function loadCitizenProfile() {
    try {
        const data = await apiRequest(`${API_URL}/profile`);
        const profile = data.profile || data.user || data.citizen || data;

        citizenProfile = {
            ...citizenProfile,
            ...profile,
            full_name:
                profile.full_name ||
                profile.name ||
                profile.fullName ||
                "Citizen",
            email: profile.email || ""
        };

        updateProfileInterface();

    } catch (error) {
        console.error("Unable to load citizen profile:", error);

        if (error.status !== 401) {
            showToast(getCurrentText(
                "Could not load your profile.",
                "আপনার প্রোফাইল লোড করা যায়নি।"
            ));
        }
    }
}


/* =========================================================
   5. ACCOUNT DROPDOWN
========================================================= */

function createAccountDropdown() {
    const moreButton = document.querySelector(".more-button");

    if (!moreButton || $("citizenAccountDropdown")) return;

    const userMini = moreButton.closest(".user-mini");
    if (!userMini) return;

    const dropdown = document.createElement("div");
    dropdown.id = "citizenAccountDropdown";
    dropdown.className = "citizen-account-dropdown";
    dropdown.hidden = true;

    dropdown.innerHTML = `
        <strong id="accountDropdownName">Citizen</strong>
        <small id="accountDropdownEmail"></small>
        <button type="button" id="accountDropdownLogout">
            ${getCurrentText("Log out", "লগ আউট")}
        </button>
    `;

    userMini.style.position = "relative";
    userMini.appendChild(dropdown);

    moreButton.setAttribute("aria-expanded", "false");
    moreButton.setAttribute("aria-label", getCurrentText("Account options", "অ্যাকাউন্ট অপশন"));

    moreButton.addEventListener("click", event => {
        event.stopPropagation();
        dropdown.hidden = !dropdown.hidden;
        moreButton.setAttribute("aria-expanded", String(!dropdown.hidden));
    });

    dropdown.addEventListener("click", event => event.stopPropagation());

    $("accountDropdownLogout").addEventListener("click", logoutCitizen);

    document.addEventListener("click", () => {
        dropdown.hidden = true;
        moreButton.setAttribute("aria-expanded", "false");
    });
}

function updateAccountDropdown() {
    const nameElement = $("accountDropdownName");
    const emailElement = $("accountDropdownEmail");
    const logoutElement = $("accountDropdownLogout");

    if (nameElement) nameElement.textContent = citizenProfile.full_name || "Citizen";
    if (emailElement) emailElement.textContent = citizenProfile.email || "";

    if (logoutElement) {
        logoutElement.textContent = getCurrentText("Log out", "লগ আউট");
    }
}


/* =========================================================
   6. DASHBOARD STATISTICS
========================================================= */

function updateStatisticsOnScreen() {
    if ($("totalStat")) {
        $("totalStat").textContent = Number(citizenStats.total_reports || 0);
    }

    if ($("progressStat")) {
        $("progressStat").textContent = Number(citizenStats.progress_reports || 0);
    }

    if ($("resolvedStat")) {
        $("resolvedStat").textContent = Number(citizenStats.resolved_reports || 0);
    }
}

async function loadCitizenStats() {
    try {
        const data = await apiRequest(`${API_URL}/stats`);
        const stats = data.stats || data;

        citizenStats = {
            total_reports: Number(stats.total_reports || 0),
            progress_reports: Number(stats.progress_reports || 0),
            resolved_reports: Number(stats.resolved_reports || 0)
        };

        updateStatisticsOnScreen();

    } catch (error) {
        console.error("Unable to load citizen statistics:", error);

        if (error.status !== 401) {
            // Use the currently loaded report list as a fallback.
            calculateStatisticsFromReports();
        }
    }
}

function calculateStatisticsFromReports() {
    citizenStats.total_reports = citizenReports.length;
    citizenStats.progress_reports = citizenReports.filter(report => [
        "Submitted",
        "Under review",
        "Forwarded",
        "In progress",
        "Reopened"
    ].includes(report.status)).length;
    citizenStats.resolved_reports = citizenReports.filter(report =>
        report.status === "Resolved" || report.status === "Closed"
    ).length;

    updateStatisticsOnScreen();
}


/* =========================================================
   7. REPORT IMAGE DISPLAY HELPERS
========================================================= */

function getSafeReportImageUrl(image) {
    const rawPath = image && (image.image_url || image.image_path);

    if (!rawPath || typeof rawPath !== "string") return "";

    // The current backend saves report images under /uploads/reports/.
    // Do not render protocol-relative or parent-directory paths.
    if (rawPath.startsWith("//") || rawPath.includes("..")) return "";

    if (rawPath.startsWith("/")) return rawPath;

    if (/^https?:\/\//i.test(rawPath)) {
        try {
            const parsed = new URL(rawPath, window.location.origin);
            if (parsed.origin !== window.location.origin) return "";
            return parsed.pathname + parsed.search;
        } catch (error) {
            return "";
        }
    }

    if (rawPath.startsWith("uploads/")) {
        return `/${rawPath}`;
    }

    return "";
}

function renderReportImages(images) {
    if (!Array.isArray(images) || images.length === 0) return "";

    const imageItems = images.map((image, index) => {
        const imageUrl = getSafeReportImageUrl(image);
        if (!imageUrl) return "";

        const filename = image.original_filename || `Report image ${index + 1}`;

        return `
            <a class="citizen-report-image-link"
               href="${escapeHTML(imageUrl)}"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="${escapeHTML(filename)}">
                <img class="citizen-report-image"
                     src="${escapeHTML(imageUrl)}"
                     alt="${escapeHTML(filename)}"
                     loading="lazy">
            </a>
        `;
    }).join("");

    return imageItems ? `<div class="citizen-report-images">${imageItems}</div>` : "";
}


/* =========================================================
   8. RENDER RECENT REPORTS
========================================================= */

function renderRecentReports() {
    const container = $("recentReportList");
    if (!container) return;

    const recentReports = citizenReports.slice(0, 3);

    if (recentReports.length === 0) {
        container.innerHTML = `
            <div class="empty-list">
                ${getCurrentText(
                    "You haven't submitted any reports yet.",
                    "আপনি এখনও কোনো অভিযোগ জমা দেননি।"
                )}
            </div>
        `;
        return;
    }

    container.innerHTML = recentReports.map(report => `
        <article class="mini-report">
            <div class="issue-icon">⌖</div>

            <div class="mini-report-info">
                <strong>${escapeHTML(report.title)}</strong>
                <small>${escapeHTML(report.id)} · ${escapeHTML(report.date)}</small>
                ${renderReportImages(report.images)}
            </div>

            <span class="status-pill ${getStatusClass(report.status)}">
                ${escapeHTML(getTranslatedStatus(report.status))}
            </span>
        </article>
    `).join("");
}


/* =========================================================
   9. RENDER ALL CITIZEN REPORTS
========================================================= */

function renderAllReports() {
    const container = $("allReportsList");
    if (!container) return;

    const searchElement = $("reportSearch");
    const filterElement = $("reportStatusFilter");

    const searchText = searchElement
        ? searchElement.value.trim().toLowerCase()
        : "";

    const selectedStatus = filterElement
        ? filterElement.value
        : "all";

    const filteredReports = citizenReports.filter(report => {
        const searchableText = [
            report.title,
            report.id,
            report.category,
            report.location,
            report.description
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(searchText);
        const matchesStatus =
            selectedStatus === "all" ||
            getFriendlyStatus(report.status).toLowerCase() === selectedStatus.toLowerCase();

        return matchesSearch && matchesStatus;
    });

    if (filteredReports.length === 0) {
        container.innerHTML = `
            <div class="empty-list">
                ${getCurrentText("No reports found.", "কোনো অভিযোগ পাওয়া যায়নি।")}
            </div>
        `;
        return;
    }

    container.innerHTML = filteredReports.map(report => `
        <article class="full-report">
            <div class="issue-icon">⌖</div>

            <div class="full-report-main">
                <strong>${escapeHTML(report.title)}</strong>
                <p>${escapeHTML(report.category)} · ${escapeHTML(report.location)}</p>
                <p>${escapeHTML(report.id)} · ${escapeHTML(report.date)}</p>
                ${report.description
                    ? `<p class="citizen-report-description">${escapeHTML(report.description)}</p>`
                    : ""}
                ${renderReportImages(report.images)}
            </div>

            <div class="full-report-meta">
                <span class="status-pill ${getStatusClass(report.status)}">
                    ${escapeHTML(getTranslatedStatus(report.status))}
                </span>
            </div>
        </article>
    `).join("");
}


/* =========================================================
   10. LOAD REPORTS FROM MYSQL
========================================================= */

async function loadCitizenReports() {
    try {
        const data = await apiRequest(`${API_URL}/reports`);
        const reports = data.reports || data.data || [];

        citizenReports = Array.isArray(reports)
            ? reports.map(normalizeReport)
            : [];

        renderRecentReports();
        renderAllReports();

        // Keep the dashboard consistent if the separate stats request fails.
        if (!Number.isFinite(citizenStats.total_reports)) {
            calculateStatisticsFromReports();
        }

    } catch (error) {
        console.error("Unable to load citizen reports:", error);

        if (error.status !== 401) {
            showToast(getCurrentText(
                "Unable to load your reports. Please refresh the page.",
                "আপনার অভিযোগগুলো লোড করা যায়নি। পেজটি রিফ্রেশ করুন।"
            ));
        }
    }
}


/* =========================================================
   11. REFRESH DASHBOARD DATA
========================================================= */

async function refreshCitizenDashboard() {
    await Promise.allSettled([
        loadCitizenProfile(),
        loadCitizenReports(),
        loadCitizenStats()
    ]);

    updateProfileInterface();
    renderRecentReports();
    renderAllReports();
    updateStatisticsOnScreen();
}


/* =========================================================
   12. NAVIGATION BETWEEN DASHBOARD SECTIONS
========================================================= */

function navigate(sectionName) {
    document.querySelectorAll(".page-section").forEach(section => {
        section.classList.remove("active");
    });

    const targetSection = $("section-" + sectionName);

    if (targetSection) {
        targetSection.classList.add("active");
    }

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.section === sectionName);
    });

    const selectedNavItem = document.querySelector(
        `.nav-item[data-section="${sectionName}"]`
    );

    const selectedNavText = selectedNavItem
        ? selectedNavItem.querySelector("span[data-en], span[data-bn]")
        : null;

    const breadcrumb = $("breadcrumbCurrent");

    if (breadcrumb) {
        const fallbackLabels = {
            overview: ["Overview", "ওভারভিউ"],
            "new-report": ["Submit a complaint", "অভিযোগ জমা দিন"],
            "my-reports": ["My reports", "আমার অভিযোগ"],
            notifications: ["Notifications", "নোটিফিকেশন"]
        };

        breadcrumb.textContent = selectedNavText
            ? selectedNavText.textContent.trim()
            : getCurrentText(
                (fallbackLabels[sectionName] || ["Citizen Portal", "নাগরিক পোর্টাল"])[0],
                (fallbackLabels[sectionName] || ["Citizen Portal", "নাগরিক পোর্টাল"])[1]
            );
    }

    if ($("sidebar")) {
        $("sidebar").classList.remove("open");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    if (sectionName === "my-reports") {
        renderAllReports();
    }
}

// Buttons and links with data-section are handled in one place.
document.addEventListener("click", event => {
    const sectionButton = event.target.closest("[data-section]");

    if (!sectionButton) return;

    event.preventDefault();
    navigate(sectionButton.dataset.section);
});


/* =========================================================
   13. LANGUAGE SWITCHING (ENGLISH / BANGLA)
========================================================= */

function setLanguage(language) {
    currentLanguage = language === "bn" ? "bn" : "en";
    document.documentElement.lang = currentLanguage;

    document.querySelectorAll("[data-en][data-bn]").forEach(element => {
        element.textContent = element.dataset[currentLanguage];
    });

    if ($("languageToggle")) {
        $("languageToggle").textContent = currentLanguage === "en" ? "বাংলা" : "English";
    }

    if ($("issueTitle")) {
        $("issueTitle").placeholder = getCurrentText(
            "e.g. Large pothole near the school gate",
            "যেমন: স্কুল গেটের পাশে বড় গর্ত"
        );
    }

    if ($("issueDescription")) {
        $("issueDescription").placeholder = getCurrentText(
            "Explain what happened, how long it has been happening, and how it affects people...",
            "কী ঘটেছে, কতদিন ধরে হচ্ছে এবং মানুষের কী সমস্যা হচ্ছে তা লিখুন..."
        );
    }

    if ($("issueLocation")) {
        $("issueLocation").placeholder = getCurrentText(
            "e.g. Mirpur 10, near the bus stand, Dhaka",
            "যেমন: মিরপুর ১০, বাসস্ট্যান্ডের পাশে, ঢাকা"
        );
    }

    if ($("reportSearch")) {
        $("reportSearch").placeholder = getCurrentText(
            "Search by title or tracking ID",
            "শিরোনাম বা ট্র্যাকিং আইডি দিয়ে খুঁজুন"
        );
    }

    if ($("accountDropdownLogout")) {
        $("accountDropdownLogout").textContent = getCurrentText("Log out", "লগ আউট");
    }

    updateGreeting();
    updateUploadLanguage();
    renderRecentReports();
    renderAllReports();
}

if ($("languageToggle")) {
    $("languageToggle").addEventListener("click", () => {
        setLanguage(currentLanguage === "en" ? "bn" : "en");
    });
}


/* =========================================================
   14. DARK / LIGHT THEME
========================================================= */

function applySavedTheme() {
    const savedTheme = localStorage.getItem("civicFixTheme");
    const isDark = savedTheme === "dark";

    document.body.classList.toggle("dark", isDark);

    if ($("themeToggle")) {
        $("themeToggle").textContent = isDark ? "☀" : "☾";
    }
}

if ($("themeToggle")) {
    $("themeToggle").addEventListener("click", () => {
        document.body.classList.toggle("dark");
        const isDark = document.body.classList.contains("dark");

        $("themeToggle").textContent = isDark ? "☀" : "☾";
        localStorage.setItem("civicFixTheme", isDark ? "dark" : "light");
    });
}


/* =========================================================
   15. MOBILE SIDEBAR
========================================================= */

if ($("mobileMenu")) {
    $("mobileMenu").addEventListener("click", () => {
        if ($("sidebar")) {
            $("sidebar").classList.toggle("open");
        }
    });
}


/* =========================================================
   16. DESCRIPTION CHARACTER COUNTER
========================================================= */

if ($("issueDescription")) {
    $("issueDescription").addEventListener("input", () => {
        if ($("charCount")) {
            $("charCount").textContent = `${$("issueDescription").value.length} / 2000`;
        }
    });
}


/* =========================================================
   17. CURRENT LOCATION (OPTIONAL GPS)
========================================================= */

if ($("locationButton")) {
    $("locationButton").addEventListener("click", () => {
        if (!navigator.geolocation) {
            showToast(getCurrentText(
                "Location is not supported by this browser.",
                "এই ব্রাউজারে অবস্থান সুবিধা সমর্থিত নয়।"
            ));
            return;
        }

        const button = $("locationButton");
        const originalText = getCurrentText(
            "◎ Use my current location",
            "◎ আমার বর্তমান অবস্থান ব্যবহার করুন"
        );

        button.disabled = true;
        button.textContent = getCurrentText(
            "Getting your location...",
            "আপনার অবস্থান নেওয়া হচ্ছে..."
        );

        navigator.geolocation.getCurrentPosition(
            position => {
                if ($("latitude")) {
                    $("latitude").value = position.coords.latitude.toFixed(7);
                }

                if ($("longitude")) {
                    $("longitude").value = position.coords.longitude.toFixed(7);
                }

                button.disabled = false;
                button.textContent = getCurrentText(
                    "◎ Location added",
                    "◎ অবস্থান যুক্ত হয়েছে"
                );

                showToast(getCurrentText(
                    "Coordinates added. Please enter the address or area too.",
                    "স্থানাঙ্ক যুক্ত হয়েছে। ঠিকানা বা এলাকার নামও লিখুন।"
                ));
            },
            error => {
                button.disabled = false;
                button.textContent = originalText;

                let message = getCurrentText(
                    "Could not get your location.",
                    "আপনার অবস্থান নেওয়া যায়নি।"
                );

                if (error && error.code === 1) {
                    message = getCurrentText(
                        "Location permission was denied.",
                        "অবস্থান ব্যবহারের অনুমতি দেওয়া হয়নি।"
                    );
                } else if (error && error.code === 3) {
                    message = getCurrentText(
                        "Location request timed out. Please try again.",
                        "অবস্থান পেতে বেশি সময় লাগছে। আবার চেষ্টা করুন।"
                    );
                }

                showToast(message);
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0
            }
        );
    });
}


/* =========================================================
   18. INJECT OPTIONAL IMAGE UPLOAD FIELD INTO THE FORM
   citizen.html does not need to be edited.
========================================================= */

function addImageUploadStyles() {
    if ($("citizenImageUploadStyles")) return;

    const style = document.createElement("style");
    style.id = "citizenImageUploadStyles";
    style.textContent = `
        .citizen-image-upload {
            margin: 22px 0 8px;
            padding: 17px;
            border: 1px dashed var(--border-color, #d8dce5);
            border-radius: 14px;
            background: var(--surface-soft, rgba(120, 130, 150, .045));
        }
        .citizen-image-upload-title {
            display: block;
            margin-bottom: 7px;
            font-weight: 700;
            color: inherit;
        }
        .citizen-image-upload-help {
            display: block;
            margin: 0 0 13px;
            color: var(--muted, #777);
            font-size: 13px;
            line-height: 1.55;
        }
        .citizen-image-picker {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 42px;
            padding: 9px 15px;
            border: 1px solid var(--border-color, #d8dce5);
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            background: var(--card-bg, #fff);
            color: inherit;
        }
        .citizen-image-picker:hover { filter: brightness(.97); }
        .citizen-image-picker input { display: none; }
        .citizen-image-count {
            display: inline-block;
            margin-left: 9px;
            color: var(--muted, #777);
            font-size: 12px;
        }
        .citizen-image-previews {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 14px;
        }
        .citizen-image-preview {
            position: relative;
            width: 104px;
            height: 92px;
            overflow: hidden;
            border-radius: 10px;
            border: 1px solid var(--border-color, #ddd);
            background: #eee;
        }
        .citizen-image-preview img {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
        }
        .citizen-image-remove {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 25px;
            height: 25px;
            padding: 0;
            border: 0;
            border-radius: 50%;
            cursor: pointer;
            background: rgba(25, 25, 25, .82);
            color: white;
            font-size: 17px;
            line-height: 25px;
        }
        .citizen-image-filename {
            display: block;
            padding: 4px 5px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            font-size: 10px;
            background: var(--card-bg, #fff);
            color: var(--muted, #777);
        }
        .citizen-report-images {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            margin-top: 9px;
        }
        .citizen-report-image-link {
            display: inline-flex;
            width: 66px;
            height: 58px;
            overflow: hidden;
            border-radius: 8px;
            border: 1px solid var(--border-color, #ddd);
        }
        .citizen-report-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .citizen-report-description {
            margin-top: 7px;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }
        .citizen-account-dropdown {
            position: absolute;
            z-index: 50;
            right: 0;
            bottom: calc(100% + 8px);
            width: 220px;
            padding: 13px;
            border: 1px solid var(--border-color, #ddd);
            border-radius: 12px;
            background: var(--card-bg, #fff);
            box-shadow: 0 10px 30px rgba(0,0,0,.12);
        }
        .citizen-account-dropdown[hidden] { display: none; }
        .citizen-account-dropdown strong,
        .citizen-account-dropdown small { display: block; overflow-wrap: anywhere; }
        .citizen-account-dropdown small { margin: 5px 0 12px; color: var(--muted, #777); }
        .citizen-account-dropdown button {
            width: 100%;
            padding: 8px 10px;
            border: 0;
            border-radius: 8px;
            cursor: pointer;
            text-align: left;
            background: var(--surface-soft, #f4f5f7);
            color: inherit;
        }
        .citizen-image-upload button:disabled { opacity: .6; cursor: not-allowed; }
        @media (max-width: 560px) {
            .citizen-image-upload { padding: 13px; }
            .citizen-image-preview { width: 88px; height: 82px; }
        }
    `;

    document.head.appendChild(style);
}

function createImageUploadField() {
    const form = $("complaintForm");

    if (!form || $("issueImages")) return;

    const formActions = form.querySelector(".form-actions");
    if (!formActions) return;

    addImageUploadStyles();

    const uploadSection = document.createElement("section");
    uploadSection.className = "citizen-image-upload";
    uploadSection.id = "citizenImageUpload";

    uploadSection.innerHTML = `
        <label class="citizen-image-upload-title" for="issueImages"
               data-en="Add photos (optional)"
               data-bn="ছবি যোগ করুন (ঐচ্ছিক)">
            Add photos (optional)
        </label>

        <p class="citizen-image-upload-help"
           data-en="You can attach up to 3 JPG, PNG or WebP images. Maximum 5 MB per image."
           data-bn="সর্বোচ্চ ৩টি JPG, PNG অথবা WebP ছবি যুক্ত করতে পারবেন। প্রতিটি ছবির সর্বোচ্চ আকার ৫ MB।">
            You can attach up to 3 JPG, PNG or WebP images. Maximum 5 MB per image.
        </p>

        <label class="citizen-image-picker" for="issueImages">
            <span>＋</span>
            <span id="imagePickerText" data-en="Choose images" data-bn="ছবি নির্বাচন করুন">
                Choose images
            </span>
            <input id="issueImages"
                   name="images"
                   type="file"
                   accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                   multiple>
        </label>

        <span class="citizen-image-count" id="imageCountText">0 / 3</span>
        <div class="citizen-image-previews" id="imagePreviewList"></div>
    `;

    form.insertBefore(uploadSection, formActions);

    $("issueImages").addEventListener("change", event => {
        addSelectedImages(event.target.files);
    });

    $("imagePreviewList").addEventListener("click", event => {
        const removeButton = event.target.closest("[data-remove-image]");
        if (!removeButton) return;

        const index = Number(removeButton.dataset.removeImage);
        removeSelectedImage(index);
    });

    updateUploadLanguage();
    renderImagePreviews();
}

function updateUploadLanguage() {
    const pickerText = $("imagePickerText");
    const countText = $("imageCountText");

    if (pickerText) {
        pickerText.textContent = getCurrentText("Choose images", "ছবি নির্বাচন করুন");
    }

    if (countText) {
        countText.textContent = `${selectedImageFiles.length} / ${MAX_IMAGES}`;
    }
}

function addSelectedImages(fileList) {
    const incomingFiles = Array.from(fileList || []);
    let addedCount = 0;
    let errorMessage = "";

    for (const file of incomingFiles) {
        if (selectedImageFiles.length >= MAX_IMAGES) {
            errorMessage = getCurrentText(
                `You can upload a maximum of ${MAX_IMAGES} images.`,
                `সর্বোচ্চ ${MAX_IMAGES}টি ছবি আপলোড করতে পারবেন।`
            );
            break;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            errorMessage = getCurrentText(
                `${file.name}: Only JPG, PNG and WebP images are allowed.`,
                `${file.name}: শুধু JPG, PNG এবং WebP ছবি দেওয়া যাবে।`
            );
            continue;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            errorMessage = getCurrentText(
                `${file.name}: Image size must not exceed 5 MB.`,
                `${file.name}: ছবির আকার ৫ MB-এর বেশি হতে পারবে না।`
            );
            continue;
        }

        const duplicate = selectedImageFiles.some(existing =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
        );

        if (!duplicate) {
            selectedImageFiles.push(file);
            addedCount++;
        }
    }

    syncImageInputFiles();
    renderImagePreviews();

    if (errorMessage) {
        showToast(errorMessage);
    } else if (addedCount > 0) {
        showToast(getCurrentText(
            `${addedCount} image(s) added.`,
            `${addedCount}টি ছবি যুক্ত হয়েছে।`
        ));
    }
}

function syncImageInputFiles() {
    const input = $("issueImages");
    if (!input || typeof DataTransfer === "undefined") return;

    const transfer = new DataTransfer();

    selectedImageFiles.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
}

function clearImagePreviewURLs() {
    previewObjectURLs.forEach(url => URL.revokeObjectURL(url));
    previewObjectURLs = [];
}

function renderImagePreviews() {
    const previewContainer = $("imagePreviewList");
    if (!previewContainer) return;

    clearImagePreviewURLs();

    previewContainer.innerHTML = selectedImageFiles.map((file, index) => {
        const previewURL = URL.createObjectURL(file);
        previewObjectURLs.push(previewURL);

        return `
            <div class="citizen-image-preview">
                <img src="${previewURL}" alt="${escapeHTML(file.name)}">
                <button type="button"
                        class="citizen-image-remove"
                        data-remove-image="${index}"
                        aria-label="${escapeHTML(getCurrentText("Remove image", "ছবি সরান"))}">
                    ×
                </button>
                <span class="citizen-image-filename" title="${escapeHTML(file.name)}">
                    ${escapeHTML(file.name)}
                </span>
            </div>
        `;
    }).join("");

    updateUploadLanguage();
}

function removeSelectedImage(index) {
    if (!Number.isInteger(index) || index < 0 || index >= selectedImageFiles.length) {
        return;
    }

    selectedImageFiles.splice(index, 1);
    syncImageInputFiles();
    renderImagePreviews();
}

function resetSelectedImages() {
    selectedImageFiles = [];
    clearImagePreviewURLs();

    if ($("issueImages")) {
        $("issueImages").value = "";
    }

    if ($("imagePreviewList")) {
        $("imagePreviewList").innerHTML = "";
    }

    updateUploadLanguage();
}


/* =========================================================
   19. FORM RESET HANDLING
========================================================= */

if ($("complaintForm")) {
    $("complaintForm").addEventListener("reset", () => {
        // A short delay allows the browser to reset the form fields first.
        window.setTimeout(() => {
            resetSelectedImages();

            if ($("charCount")) {
                $("charCount").textContent = "0 / 2000";
            }

            if ($("locationButton")) {
                $("locationButton").disabled = false;
                $("locationButton").textContent = getCurrentText(
                    "◎ Use my current location",
                    "◎ আমার বর্তমান অবস্থান ব্যবহার করুন"
                );
            }
        }, 0);
    });
}


/* =========================================================
   20. SUBMIT COMPLAINT TO MYSQL
   Text fields + optional images are sent as multipart FormData.
========================================================= */

async function submitComplaint(event) {
    event.preventDefault();

    if (isSubmittingReport) return;

    const title = $("issueTitle") ? $("issueTitle").value.trim() : "";
    const category = $("issueCategory") ? $("issueCategory").value.trim() : "";
    const description = $("issueDescription") ? $("issueDescription").value.trim() : "";
    const location = $("issueLocation") ? $("issueLocation").value.trim() : "";
    const latitude = $("latitude") ? $("latitude").value.trim() : "";
    const longitude = $("longitude") ? $("longitude").value.trim() : "";

    if (!title || !category || !description || !location) {
        showToast(getCurrentText(
            "Please complete all required fields.",
            "সব প্রয়োজনীয় তথ্য পূরণ করুন।"
        ));
        return;
    }

    if (title.length > 220) {
        showToast(getCurrentText(
            "The complaint title must not exceed 220 characters.",
            "অভিযোগের শিরোনাম ২২০ অক্ষরের বেশি হতে পারবে না।"
        ));
        return;
    }

    if (description.length < 20) {
        showToast(getCurrentText(
            "Please provide at least 20 characters in the description.",
            "বিবরণে কমপক্ষে ২০টি অক্ষর লিখুন।"
        ));
        return;
    }

    if (description.length > 2000) {
        showToast(getCurrentText(
            "The description must not exceed 2000 characters.",
            "বিবরণ ২০০০ অক্ষরের বেশি হতে পারবে না।"
        ));
        return;
    }

    if (location.length > 300) {
        showToast(getCurrentText(
            "The location must not exceed 300 characters.",
            "অবস্থানের বিবরণ ৩০০ অক্ষরের বেশি হতে পারবে না।"
        ));
        return;
    }

    if (selectedImageFiles.length > MAX_IMAGES) {
        showToast(getCurrentText(
            "You can upload a maximum of 3 images.",
            "সর্বোচ্চ ৩টি ছবি আপলোড করতে পারবেন।"
        ));
        return;
    }

    // Build multipart data. The field name "images" must match upload.array("images", 3) in server.js.
    const formData = new FormData();

    formData.append("title", title);
    formData.append("category", category);
    formData.append("description", description);
    formData.append("location", location);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);

    selectedImageFiles.forEach(file => {
        formData.append("images", file);
    });

    const form = $("complaintForm");
    const submitButton = form ? form.querySelector('button[type="submit"]') : null;
    const originalButtonHTML = submitButton ? submitButton.innerHTML : "";

    isSubmittingReport = true;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <span>${getCurrentText("Submitting...", "জমা দেওয়া হচ্ছে...")}</span>
        `;
    }

    try {
        const data = await apiRequest(`${API_URL}/reports`, {
            method: "POST",
            body: formData
        });

        const report = data.report || data.data || {};
        const trackingCode =
            report.tracking_code ||
            report.id ||
            data.tracking_code ||
            "Submitted";

        // Reload the official report list and statistics from the database.
        await Promise.allSettled([
            loadCitizenReports(),
            loadCitizenStats()
        ]);

        if ($("successTrackingId")) {
            $("successTrackingId").textContent = trackingCode;
        }

        if ($("successModal")) {
            $("successModal").classList.add("show");
            $("successModal").setAttribute("aria-hidden", "false");
        }

        if (form) {
            form.reset();
        }

        resetSelectedImages();

        if ($("charCount")) {
            $("charCount").textContent = "0 / 2000";
        }

    } catch (error) {
        console.error("Complaint submission failed:", error);

        showToast(error.message || getCurrentText(
            "Unable to submit your complaint. Please try again.",
            "অভিযোগ জমা দেওয়া যায়নি। আবার চেষ্টা করুন।"
        ));

    } finally {
        isSubmittingReport = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHTML;
        }
    }
}

if ($("complaintForm")) {
    $("complaintForm").addEventListener("submit", submitComplaint);
}


/* =========================================================
   21. SUCCESS MODAL
========================================================= */

function closeSuccessModal() {
    const modal = $("successModal");
    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

if ($("closeSuccess")) {
    $("closeSuccess").addEventListener("click", closeSuccessModal);
}

if ($("doneSuccess")) {
    $("doneSuccess").addEventListener("click", () => {
        closeSuccessModal();
        navigate("my-reports");
    });
}

if ($("successModal")) {
    $("successModal").addEventListener("click", event => {
        if (event.target === $("successModal")) {
            closeSuccessModal();
        }
    });
}

// Close the success modal with the Escape key.
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("successModal")?.classList.contains("show")) {
        closeSuccessModal();
    }
});


/* =========================================================
   22. SEARCH AND STATUS FILTER
========================================================= */

if ($("reportSearch")) {
    $("reportSearch").addEventListener("input", renderAllReports);
}

if ($("reportStatusFilter")) {
    $("reportStatusFilter").addEventListener("change", renderAllReports);
}


/* =========================================================
   23. HELP BUTTONS
========================================================= */

if ($("helpButton")) {
    $("helpButton").addEventListener("click", () => {
        showToast(getCurrentText(
            "Describe the issue, add its location, and submit your complaint. You may also attach up to 3 photos.",
            "সমস্যার বিবরণ ও অবস্থান লিখে অভিযোগ জমা দিন। চাইলে সর্বোচ্চ ৩টি ছবি যুক্ত করতে পারেন।"
        ));
    });
}

if ($("footerHelp")) {
    $("footerHelp").addEventListener("click", event => {
        event.preventDefault();

        showToast(getCurrentText(
            "Please contact your Civic Fix support team.",
            "Civic Fix সহায়তা দলের সাথে যোগাযোগ করুন।"
        ));
    });
}


/* =========================================================
   24. LOG OUT AND RETURN TO HOMEPAGE
========================================================= */

async function logoutCitizen() {
    try {
        await apiRequest("/api/auth/logout", {
            method: "POST"
        });
    } catch (error) {
        console.error("Logout request failed:", error);
    } finally {
        window.location.href = "/index.html";
    }
}

if ($("logoutButton")) {
    $("logoutButton").addEventListener("click", logoutCitizen);
}


/* =========================================================
   25. INITIALIZE CITIZEN PORTAL
========================================================= */

async function initializeCitizenPortal() {
    createImageUploadField();
    createAccountDropdown();
    applySavedTheme();

    updateProfileInterface();
    updateStatisticsOnScreen();
    updateUploadLanguage();

    if ($("charCount") && $("issueDescription")) {
        $("charCount").textContent = `${$("issueDescription").value.length} / 2000`;
    }

    await refreshCitizenDashboard();
}

initializeCitizenPortal();
