/* =========================================================
   CIVIC FIX - CITIZEN PORTAL JAVASCRIPT
   Connected to Node.js + Express + MySQL
   Optional report images: maximum 3 images, 5 MB each
========================================================= */


/* =========================================================
   1. GLOBAL VARIABLES AND CONFIGURATION
========================================================= */

let currentLanguage = localStorage.getItem("civicFixLanguage") === "bn" ? "bn" : "en";
let citizenReports = [];
let citizenLeaderboard = [];
let currentCitizenScore = { rank: null, legitimateReports: 0, points: 0 };
let hasLoadedLeaderboard = false;
let citizenCurrentLocation = null;
let newsfeedReports = [];
let hasLoadedNewsfeed = false;
let communityMap = null;
let communityMapMarkers = [];
let communityReportMarkers = new Map();
let communitySearchMarker = null;
let newsfeedAreaLocation = null;
let lastNewsfeedGeocodeAt = 0;
let newsfeedGeocodeCache = new Map();
let communityRadiusCircle = null;
let isCitizenAuthenticated = false;
let serverRequestsLocationPermission = false;

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
let profilePreviewObjectURL = null;
let profileFocusReturn = null;
let isSubmittingReport = false;
let activeMessageUser = null;
let inboxSearchTimer = null;
let inboxRefreshTimer = null;


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

    toast.hidden = false;
    toast.style.display = "block";
    toast.textContent = message;
    toast.classList.add("show");

    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
        toast.classList.remove("show");
        toast.hidden = true;
        toast.style.display = "none";
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

function formatReportTime(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(currentLanguage === "bn" ? "bn-BD" : "en-GB", {
        hour: "2-digit", minute: "2-digit"
    });
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
        time: formatReportTime(report.created_at),
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
    let englishGreeting;
    let banglaGreeting;

    if (hour >= 5 && hour < 12) {
        englishGreeting = "Good morning,";
        banglaGreeting = "শুভ সকাল,";
    } else if (hour >= 12 && hour < 17) {
        englishGreeting = "Good afternoon,";
        banglaGreeting = "শুভ অপরাহ্ন,";
    } else if (hour >= 17 && hour < 22) {
        englishGreeting = "Good evening,";
        banglaGreeting = "শুভ সন্ধ্যা,";
    } else {
        englishGreeting = "Good night,";
        banglaGreeting = "শুভ রাত্রি,";
    }

    greetingElement.textContent = getCurrentText(englishGreeting, banglaGreeting);
    nameElement.textContent = citizenProfile.full_name || "Citizen";
}

updateGreeting();
window.setInterval(updateGreeting, 60 * 1000);
function updateProfileInterface() {
    const fullName = citizenProfile.full_name || "Citizen";
    const initials = getInitials(fullName);

    if ($("citizenProfileName")) {
        $("citizenProfileName").textContent = fullName;
    }
    if ($("citizenProfileUsername")) $("citizenProfileUsername").textContent = citizenProfile.username ? `@${citizenProfile.username}` : "";

    [$("citizenAvatarInitials"), $("citizenTopAvatar")].forEach(avatar => {
        if (!avatar) return;
        avatar.replaceChildren();
        if (citizenProfile.profile_image) {
            const image = document.createElement("img");
            image.className = "citizen-image-avatar";
            image.src = citizenProfile.profile_image;
            image.alt = `${fullName} profile photo`;
            image.loading = "lazy";
            image.decoding = "async";
            image.onerror = () => { avatar.textContent = initials; };
            avatar.appendChild(image);
        } else {
            avatar.textContent = initials;
        }
    });

    updateGreeting();
    updateAccountDropdown();
}

async function loadCitizenProfile() {
    try {
        const data = await apiRequest(`${API_URL}/profile`);
        const profile = data.profile || data.user || data.citizen || data;
        isCitizenAuthenticated = true;
        serverRequestsLocationPermission = data.requestLocationPermission === true;

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
        return true;

    } catch (error) {
        const isFilePage = window.location.protocol === "file:";
        if (error.status !== 401 && !isFilePage) {
            console.error("Unable to load citizen profile:", error);
        }

        if (error.status !== 401 && !isFilePage) {
            showToast(getCurrentText(
                "Could not load your profile.",
                "আপনার প্রোফাইল লোড করা যায়নি।"
            ));
        }
        return false;
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
        <button type="button" class="logout-button" id="accountDropdownLogout">
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


function setProfileMessage(message, isSuccess = false) {
    const element = $("profileMessage");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("success", isSuccess);
}

function showProfilePhotoPreview(imageUrl) {
    const preview = $("profilePhotoPreview");
    if (!preview) return;
    if (profilePreviewObjectURL) {
        URL.revokeObjectURL(profilePreviewObjectURL);
        profilePreviewObjectURL = null;
    }
    preview.replaceChildren();
    if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = "Profile photo preview";
        image.decoding = "async";
        image.onerror = () => { preview.textContent = getInitials(citizenProfile.full_name); };
        preview.appendChild(image);
    } else {
        preview.textContent = getInitials(citizenProfile.full_name);
    }
}

function openProfileModal() {
    const modal = $("profileModal");
    if (!modal) return;
    profileFocusReturn = document.activeElement;
    if ($("citizenAccountDropdown")) $("citizenAccountDropdown").hidden = true;
    $("profileFullName").value = citizenProfile.full_name || "";
    $("profileUsername").value = citizenProfile.username || "";
    $("profilePhone").value = citizenProfile.phone || "";
    $("profileCity").value = citizenProfile.city || "";
    $("profileEmail").value = citizenProfile.email || "";
    $("profileCurrentPassword").value = "";
    $("profileNewPassword").value = "";
    $("profileConfirmPassword").value = "";
    $("profileImageFile").value = "";
    setProfileMessage("");
    showProfilePhotoPreview(citizenProfile.profile_image);
    modal.classList.add("show");
    modal.hidden = false;
    modal.style.display = "grid";
    modal.setAttribute("aria-hidden", "false");
    if ($("profileButton")) $("profileButton").setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    $("profileFullName").focus();
}

function closeProfileModal() {
    const modal = $("profileModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.hidden = true;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    showProfilePhotoPreview(citizenProfile.profile_image);
    if ($("profileButton")) $("profileButton").setAttribute("aria-expanded", "false");
    const focusTarget = profileFocusReturn;
    profileFocusReturn = null;
    if (focusTarget instanceof HTMLElement && focusTarget.isConnected) focusTarget.focus();
}

if ($("profileButton")) $("profileButton").addEventListener("click", openProfileModal);
if ($("closeProfileModal")) $("closeProfileModal").addEventListener("click", closeProfileModal);
if ($("cancelProfileModal")) $("cancelProfileModal").addEventListener("click", closeProfileModal);
if ($("profileLogoutButton")) $("profileLogoutButton").addEventListener("click", logoutCitizen);

if ($("profileModal")) {
    $("profileModal").addEventListener("click", event => {
        if (event.target === $("profileModal")) closeProfileModal();
    });
    $("profileModal").addEventListener("keydown", event => {
        if (!$("profileModal").classList.contains("show")) return;
        if (event.key === "Escape") {
            event.preventDefault();
            closeProfileModal();
            return;
        }
        if (event.key !== "Tab") return;

        const focusable = [...$("profileModal").querySelectorAll(
            'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(element => element.getClientRects().length > 0);
        if (!focusable.length) {
            event.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
}

if ($("profileImageFile")) {
    $("profileImageFile").addEventListener("change", () => {
        const file = $("profileImageFile").files[0];
        if (!file) return showProfilePhotoPreview(citizenProfile.profile_image);
        if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) {
            $("profileImageFile").value = "";
            showProfilePhotoPreview(citizenProfile.profile_image);
            setProfileMessage("Choose a JPG, PNG or WebP image smaller than 2 MB.");
            return;
        }
        const previewURL = URL.createObjectURL(file);
        showProfilePhotoPreview(previewURL);
        profilePreviewObjectURL = previewURL;
        setProfileMessage("");
    });
}

if ($("profileForm")) {
    $("profileForm").addEventListener("submit", async event => {
        event.preventDefault();
        const newPassword = $("profileNewPassword").value;
        const confirmPassword = $("profileConfirmPassword").value;
        const emailInput = $("profileEmail");
        const email = emailInput.value.trim();
        const phone = $("profilePhone").value.trim();
        const currentPassword = $("profileCurrentPassword").value;

        if (email && !emailInput.checkValidity()) {
            setProfileMessage("Enter a valid email address.");
            emailInput.focus();
            return;
        }
        if (newPassword && newPassword !== confirmPassword) {
            setProfileMessage("The new passwords do not match.");
            $("profileConfirmPassword").focus();
            return;
        }
        if (!newPassword && confirmPassword) {
            setProfileMessage("Enter a new password before confirming it.");
            $("profileNewPassword").focus();
            return;
        }
        if (newPassword && (newPassword.length < 8 || newPassword.length > 72)) {
            setProfileMessage("Your new password must be 8 to 72 characters.");
            $("profileNewPassword").focus();
            return;
        }

        const phoneDigits = value => {
            let digits = value.replace(/\D/g, "");
            if (digits.startsWith("880")) digits = digits.slice(3);
            else if (digits.startsWith("0")) digits = digits.slice(1);
            return digits;
        };
        const emailChanged = email.toLowerCase() !== String(citizenProfile.email || "").toLowerCase();
        const phoneChanged = phoneDigits(phone) !== phoneDigits(String(citizenProfile.phone || ""));
        if ((newPassword || emailChanged || phoneChanged) &&
            citizenProfile.auth_provider !== "google" && !currentPassword) {
            setProfileMessage("Enter your current password to change your email, phone or password.");
            $("profileCurrentPassword").focus();
            return;
        }

        const formData = new FormData();
        ["fullName", "username", "phone", "city", "email", "currentPassword", "newPassword"].forEach(name => {
            formData.append(name, $("profileForm").elements[name].value);
        });
        const selectedPhoto = $("profileImageFile").files[0];
        if (selectedPhoto) formData.append("profileImage", selectedPhoto);
        const saveButton = $("saveProfileButton");
        saveButton.disabled = true;
        setProfileMessage(getCurrentText("Saving your profile...", "প্রোফাইল সংরক্ষণ হচ্ছে..."));
        try {
            const data = await apiRequest(`${API_URL}/profile`, {
                method: "PUT",
                body: formData
            });
            citizenProfile = { ...citizenProfile, ...(data.profile || {}) };
            updateProfileInterface();
            closeProfileModal();
            showToast(getCurrentText("Profile updated successfully.", "প্রোফাইল হালনাগাদ হয়েছে।"));
        } catch (error) {
            setProfileMessage(error.message || "Unable to update your profile.");
        } finally {
            saveButton.disabled = false;
        }
    });
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

function renderCitizenLeaderboard() {
    const list = $("leaderboardList");
    if (!list) return;

    const points = $("myLeaderboardPoints");
    const rank = $("myLeaderboardRank");
    const reportCount = $("myLeaderboardReportCount");
    const myAvatar = $("myLeaderboardAvatar");
    const locale = currentLanguage === "bn" ? "bn-BD" : "en-US";
    const numberFormat = new Intl.NumberFormat(locale);

    if (points) points.textContent = numberFormat.format(currentCitizenScore.points || 0);
    if (myAvatar) {
        myAvatar.replaceChildren();
        if (citizenProfile.profile_image) {
            const image = document.createElement("img");
            image.src = citizenProfile.profile_image;
            image.alt = "Your citizen profile photo";
            myAvatar.appendChild(image);
        } else {
            myAvatar.textContent = getInitials(citizenProfile.full_name);
        }
    }
    if (rank) {
        const currentRank = Number(currentCitizenScore.rank);
        rank.textContent = currentRank === 1 ? "🥇" : currentRank === 2 ? "🥈" : currentRank === 3 ? "🥉" : currentRank > 3 ? `#${numberFormat.format(currentRank)}` : getCurrentText("—", "—");
    }
    if (reportCount) {
        const count = numberFormat.format(currentCitizenScore.legitimateReports || 0);
        reportCount.textContent = currentLanguage === "bn"
            ? `${count}টি বৈধ অভিযোগ`
            : `${count} legitimate report${Number(currentCitizenScore.legitimateReports) === 1 ? "" : "s"}`;
    }

    if (!citizenLeaderboard.length) {
        list.innerHTML = `<li class="leaderboard-empty">${escapeHTML(getCurrentText(
            "No active citizen rankings yet.",
            "এখনও কোনো সক্রিয় নাগরিকের র‍্যাঙ্কিং নেই।"
        ))}</li>`;
        return;
    }

    list.innerHTML = citizenLeaderboard.map(person => {
        const rankLabel = person.rank === 1 ? "🥇" : person.rank === 2 ? "🥈" : person.rank === 3 ? "🥉" : `#${numberFormat.format(person.rank)}`;
        return `
        <li class="leaderboard-item${person.isCurrentUser ? " is-current-user" : ""}">
            <span class="leaderboard-rank-group">
                <span class="leaderboard-avatar" aria-hidden="true">${person.profileImage ? `<img src="${escapeHTML(person.profileImage)}" alt="">` : escapeHTML(getInitials(person.name))}</span>
                <span class="leaderboard-rank" aria-label="${person.rank <= 3 ? ["", "Gold", "Silver", "Bronze"][person.rank] : `Rank ${person.rank}`}">${rankLabel}</span>
            </span>
            <span class="leaderboard-citizen">
                <strong>${escapeHTML(person.name)}</strong>
                ${person.isCurrentUser ? `<small>${escapeHTML(getCurrentText("You", "আপনি"))}</small>` : ""}
            </span>
            <span class="leaderboard-report-count">
                <strong>${numberFormat.format(person.legitimateReports)}</strong>
                <small>${escapeHTML(getCurrentText("reports", "টি অভিযোগ"))}</small>
            </span>
            <span class="leaderboard-points">
                <strong>${numberFormat.format(person.points)}</strong>
                <small>${escapeHTML(getCurrentText("points", "পয়েন্ট"))}</small>
            </span>
        </li>
    `}).join("");
}

async function loadCitizenLeaderboard() {
    const list = $("leaderboardList");
    if (!list) return;
    list.innerHTML = `<li class="leaderboard-loading">${escapeHTML(getCurrentText(
        "Loading leaderboard…",
        "লিডারবোর্ড লোড হচ্ছে…"
    ))}</li>`;

    try {
        const data = await apiRequest(`${API_URL}/leaderboard`);
        citizenLeaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];
        currentCitizenScore = data.currentUser || { rank: null, legitimateReports: 0, points: 0 };
        hasLoadedLeaderboard = true;
        renderCitizenLeaderboard();
    } catch (error) {
        console.error("Unable to load citizen leaderboard:", error);
        list.innerHTML = `<li class="leaderboard-empty">${escapeHTML(error.message || getCurrentText(
            "Unable to load the leaderboard. Please try again.",
            "লিডারবোর্ড লোড করা যায়নি। আবার চেষ্টা করুন।"
        ))}</li>`;
    }
}

function newsfeedStatusLabel(status) {
    const labels = {
        pending: ["Pending", "অপেক্ষমাণ"],
        in_progress: ["In progress", "চলমান"],
        resolved: ["Resolved", "সমাধান হয়েছে"],
        rejected: ["Rejected", "বাতিল"]
    };
    const key = String(status || "pending").toLowerCase();
    return getCurrentText(...(labels[key] || [getFriendlyStatus(key), getFriendlyStatus(key)]));
}

function newsfeedStatusClass(status) {
    return ({ pending: "submitted", in_progress: "forwarded", resolved: "resolved", rejected: "rejected" })[
        String(status || "pending").toLowerCase()
    ] || "submitted";
}

function getNewsfeedCenter() {
    return newsfeedAreaLocation || citizenCurrentLocation;
}

function ensureCommunityMap() {
    if (!window.L) return false;
    const center = getNewsfeedCenter() || { latitude: 23.685, longitude: 90.3563 };
    if (!communityMap) {
        communityMap = L.map("newsfeedMap", { scrollWheelZoom: true }).setView(
            [center.latitude, center.longitude], getNewsfeedCenter() ? 13 : 7
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
        }).addTo(communityMap);
    } else if (getNewsfeedCenter()) {
        communityMap.setView([center.latitude, center.longitude], communityMap.getZoom());
    }
    return true;
}
function getFilteredNewsfeedReports() {
    const filter = $("newsfeedStatusFilter")?.value || "all";
    return newsfeedReports.filter(report => filter === "all" || String(report.status).toLowerCase() === filter);
}

function formatReportDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

function renderNewsfeed() {
    const list = $("newsfeedList");
    if (!list) return;
    const reports = getFilteredNewsfeedReports();
    if ($("newsfeedCount")) $("newsfeedCount").textContent = new Intl.NumberFormat(currentLanguage === "bn" ? "bn-BD" : "en-US").format(reports.length);

    if (!reports.length) {
        list.innerHTML = `<div class="newsfeed-empty">${escapeHTML(getCurrentText(
            newsfeedReports.length ? "No nearby reports match this status." : "No geolocated reports were found in this area yet.",
            newsfeedReports.length ? "এই অবস্থার কাছাকাছি কোনো অভিযোগ নেই।" : "এই এলাকায় অবস্থান-চিহ্নিত কোনো অভিযোগ নেই।"
        ))}</div>`;
    } else {
        list.innerHTML = reports.map(report => {
            const reportId = Number(report.report_id);
            const images = Array.isArray(report.images) ? report.images : [];
            const imageMarkup = images.map((image, index) => {
                const url = getSafeReportImageUrl(image);
                if (!url) return "";
                const alt = image.original_filename || `${report.title} ${index + 1}`;
                return `<a class="newsfeed-image-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(url)}" alt="${escapeHTML(alt)}" loading="lazy"></a>`;
            }).join("");
            const status = String(report.status || "pending").toLowerCase();
            const dateTime = formatReportDateTime(report.created_at);
            const description = String(report.description || "");
            const canExpandDescription = description.length > 180;
            const isoDate = Number.isNaN(new Date(report.created_at).getTime()) ? "" : new Date(report.created_at).toISOString();
            return `
                <article class="newsfeed-report" data-report-id="${reportId}">
                    <div class="newsfeed-report-topline">
                        <span class="status-pill ${newsfeedStatusClass(status)}">${escapeHTML(newsfeedStatusLabel(status))}</span>
                        <time datetime="${escapeHTML(isoDate)}">${escapeHTML(dateTime)}</time>
                    </div>
                    <div class="newsfeed-author-row">
                        <button type="button" class="newsfeed-author-profile" data-view-user="${Number(report.user_id) || 0}" aria-label="View ${escapeHTML(report.author_name || "citizen")} profile">
                            <span class="newsfeed-author-avatar">${report.author_profile_image ? `<img src="${escapeHTML(report.author_profile_image)}" alt="">` : escapeHTML(getInitials(report.author_name || "Citizen"))}</span>
                            <span><strong>${escapeHTML(report.author_name || getCurrentText("Citizen", "নাগরিক"))}</strong><small>${escapeHTML(report.author_username ? `@${report.author_username}` : "")}</small></span>
                        </button>
                        ${Number(report.user_id) ? `<button type="button" class="newsfeed-message-link" data-message-user="${Number(report.user_id)}" data-user-name="${escapeHTML(report.author_name || "Citizen")}">${escapeHTML(getCurrentText("Message", "বার্তা"))}</button>` : ""}
                    </div>
                    <div class="newsfeed-report-heading">
                        <div><small>${escapeHTML(report.category || getCurrentText("Community report", "কমিউনিটি অভিযোগ"))}</small>
                        <h3>${escapeHTML(report.title || getCurrentText("Untitled report", "শিরোনামহীন অভিযোগ"))}</h3></div>
                        <span class="newsfeed-distance">${escapeHTML(Number(report.distance_km || 0).toFixed(1))} km</span>
                    </div>
                    <p class="newsfeed-description" data-newsfeed-description="${reportId}">${escapeHTML(description)}</p>
                    ${canExpandDescription ? `<button type="button" class="newsfeed-read-more" data-newsfeed-expand="${reportId}" aria-expanded="false">${escapeHTML(getCurrentText("Read more", "আরও দেখুন"))}</button>` : ""}
                    <p class="newsfeed-location">⌖ ${escapeHTML(report.location || "")}</p>
                    ${imageMarkup ? `<div class="newsfeed-images">${imageMarkup}</div>` : ""}
                    <div class="newsfeed-report-footer">
                        <button type="button" class="newsfeed-comments-toggle" data-comments-toggle="${reportId}" aria-expanded="false">
                            ${escapeHTML(getCurrentText("Comments", "মন্তব্য"))} (${Number(report.comment_count || 0)})
                        </button>
                    </div>
                    <div class="newsfeed-comments" id="newsfeed-comments-${reportId}" hidden>
                        <div class="newsfeed-comment-list" data-comment-list="${reportId}"></div>
                        <form class="newsfeed-comment-form" data-comment-form="${reportId}">
                            <label class="visually-hidden" for="newsfeed-comment-input-${reportId}">${escapeHTML(getCurrentText("Write a comment", "মন্তব্য লিখুন"))}</label>
                            <textarea id="newsfeed-comment-input-${reportId}" name="comment" maxlength="1000" required placeholder="${escapeHTML(getCurrentText("Write a helpful comment…", "সহায়ক মন্তব্য লিখুন…"))}"></textarea>
                            <button type="submit" class="submit-button">${escapeHTML(getCurrentText("Comment", "মন্তব্য করুন"))}</button>
                        </form>
                    </div>
                </article>
            `;
        }).join("");
    }

    if (!ensureCommunityMap()) {
        const status = $("newsfeedMapStatus");
        if (status) {
            status.hidden = false;
            status.textContent = getCurrentText(
                "The interactive map could not load. Nearby reports are still listed.",
                "ইন্টারঅ্যাকটিভ মানচিত্র লোড হয়নি। কাছের প্রতিবেদন তালিকায় আছে।"
            );
        }
        return;
    }

    communityMapMarkers.forEach(marker => marker.remove());
    communityMapMarkers = [];
    communityReportMarkers.clear();
    if (communityRadiusCircle) communityRadiusCircle.remove();
    if (communitySearchMarker) {
        communitySearchMarker.remove();
        communitySearchMarker = null;
    }

    const center = getNewsfeedCenter();
    const radiusKm = Number($("newsfeedRadius")?.value || 10);
    if (center) {
        communityRadiusCircle = L.circle(
            [center.latitude, center.longitude],
            { radius: radiusKm * 1000, color: "#087b65", weight: 1, fillColor: "#4bb995", fillOpacity: 0.08 }
        ).addTo(communityMap);
    }

    if (citizenCurrentLocation) {
        const userMarker = L.circleMarker(
            [citizenCurrentLocation.latitude, citizenCurrentLocation.longitude],
            { radius: 8, color: "#fff", weight: 3, fillColor: "#087c78", fillOpacity: 1 }
        ).bindTooltip(getCurrentText("Your location", "আপনার অবস্থান")).addTo(communityMap);
        communityMapMarkers.push(userMarker);
    }

    if (newsfeedAreaLocation) {
        communitySearchMarker = L.marker(
            [newsfeedAreaLocation.latitude, newsfeedAreaLocation.longitude]
        ).bindTooltip(getCurrentText("Selected area", "নির্বাচিত এলাকা")).addTo(communityMap);
        communityMapMarkers.push(communitySearchMarker);
    }

    reports.forEach(report => {
        const latitude = Number(report.latitude);
        const longitude = Number(report.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const reportId = String(report.report_id);
        const status = String(report.status || "pending").toLowerCase();
        const marker = L.circleMarker([latitude, longitude], {
            radius: 8, color: "#fff", weight: 2,
            fillColor: status === "resolved" ? "#31865f" : (status === "rejected" ? "#b94b42" : "#d08b35"),
            fillOpacity: .96
        });
        const popup = `<strong>${escapeHTML(report.title || getCurrentText("Community report", "নাগরিক প্রতিবেদন"))}</strong><br>${escapeHTML(report.category || "")}<br>${escapeHTML(newsfeedStatusLabel(status))}<br>${escapeHTML(report.location || "")}`;
        marker.bindPopup(popup).addTo(communityMap);
        marker.on("click", () => {
            document.querySelectorAll(".newsfeed-report.is-map-selected").forEach(card => card.classList.remove("is-map-selected"));
            const card = document.querySelector(`.newsfeed-report[data-report-id="${reportId}"]`);
            if (card) {
                card.classList.add("is-map-selected");
                card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        });
        communityReportMarkers.set(reportId, marker);
        communityMapMarkers.push(marker);
    });

    if (communityRadiusCircle && reports.length) {
        communityMap.fitBounds(communityRadiusCircle.getBounds(), { padding: [28, 28], maxZoom: 14 });
    }
    window.setTimeout(() => communityMap && communityMap.invalidateSize(), 80);
}

function focusNewsfeedReport(reportId) {
    const id = String(reportId);
    const report = newsfeedReports.find(item => String(item.report_id) === id);
    const marker = communityReportMarkers.get(id);
    if (report && marker && communityMap) {
        communityMap.flyTo(marker.getLatLng(), Math.max(communityMap.getZoom(), 15), { duration: 0.45 });
        marker.openPopup();
    }
    document.querySelectorAll(".newsfeed-report.is-map-selected").forEach(card => card.classList.remove("is-map-selected"));
    const card = document.querySelector(`.newsfeed-report[data-report-id="${id}"]`);
    if (card) {
        card.classList.add("is-map-selected");
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

async function searchNewsfeedMap(event) {
    event.preventDefault();
    const input = $("newsfeedMapSearchInput");
    const button = $("newsfeedMapSearch")?.querySelector('button[type="submit"]');
    const status = $("newsfeedMapSearchStatus");
    const query = input?.value.trim();
    if (!query || !button || !status) return;

    button.disabled = true;
    button.textContent = getCurrentText("Searching…", "খোঁজা হচ্ছে…");
    status.hidden = false;
    status.textContent = getCurrentText("Searching for this place…", "এই স্থানটি খোঁজা হচ্ছে…");

    try {
        const cacheKey = query.toLocaleLowerCase();
        let place = newsfeedGeocodeCache.get(cacheKey);
        if (!place) {
            const elapsed = Date.now() - lastNewsfeedGeocodeAt;
            if (elapsed < 1100) await new Promise(resolve => window.setTimeout(resolve, 1100 - elapsed));
            lastNewsfeedGeocodeAt = Date.now();
            const params = new URLSearchParams({ q: query });
            const data = await apiRequest(`${API_URL}/geocode?${params.toString()}`);
            place = data.place;
            if (!place || !Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lon))) {
                throw new Error(getCurrentText("No matching place was found. Try a nearby street or landmark.", "মিল পাওয়া যায়নি। কাছের রাস্তা বা স্থাপনার নাম দিয়ে চেষ্টা করুন।"));
            }
            if (newsfeedGeocodeCache.size >= 100) newsfeedGeocodeCache.delete(newsfeedGeocodeCache.keys().next().value);
            newsfeedGeocodeCache.set(cacheKey, place);
        }

        newsfeedAreaLocation = { latitude: Number(place.lat), longitude: Number(place.lon) };
        const label = place.name || place.display_name || query;
        status.textContent = getCurrentText(`Showing reports near ${label}`, `${label} এলাকার প্রতিবেদন দেখানো হচ্ছে`);
        ensureCommunityMap();
        communityMap.setView([newsfeedAreaLocation.latitude, newsfeedAreaLocation.longitude], 14);
        await loadNewsfeed();
    } catch (error) {
        status.hidden = false;
        status.textContent = error.message || getCurrentText("Could not search for that place.", "স্থানটি খোঁজা যায়নি।");
    } finally {
        button.disabled = false;
        button.textContent = getCurrentText("Search", "খুঁজুন");
    }
}
async function loadNewsfeed() {
    const list = $("newsfeedList");
    if (!list) return;
    const center = getNewsfeedCenter();
    if (!center) {
        list.innerHTML = `<div class="newsfeed-empty">${escapeHTML(getCurrentText(
            "Use your location or search for a place to see nearby reports.",
            "কাছের প্রতিবেদন দেখতে আপনার অবস্থান ব্যবহার করুন বা কোনো স্থান খুঁজুন।"
        ))}</div>`;
        if ($("newsfeedMapStatus")) $("newsfeedMapStatus").hidden = false;
        ensureCommunityMap();
        return;
    }
    const radiusKm = Number($("newsfeedRadius")?.value || 10);
    list.innerHTML = `<div class="newsfeed-empty">${escapeHTML(getCurrentText("Loading nearby reports…", "কাছের প্রতিবেদন লোড হচ্ছে…"))}</div>`;
    try {
        const query = new URLSearchParams({
            lat: String(center.latitude),
            lng: String(center.longitude),
            radiusKm: String(radiusKm)
        });
        const data = await apiRequest(`${API_URL}/newsfeed?${query.toString()}`);
        newsfeedReports = Array.isArray(data.reports) ? data.reports : [];
        hasLoadedNewsfeed = true;
        const mapStatus = $("newsfeedMapStatus");
        if (mapStatus) mapStatus.hidden = true;
        renderNewsfeed();
    } catch (error) {
        console.error("Unable to load nearby reports:", error);
        list.innerHTML = `<div class="newsfeed-empty">${escapeHTML(error.message || getCurrentText("Unable to load nearby reports.", "কাছের প্রতিবেদন লোড করা যায়নি।"))}</div>`;
    }
}
if ($("newsfeedMapSearch")) {
    $("newsfeedMapSearch").addEventListener("submit", searchNewsfeedMap);
}

if ($("newsfeedMapLocate")) {
    $("newsfeedMapLocate").addEventListener("click", () => {
        if (!citizenCurrentLocation) {
            $("newsfeedLocateButton")?.click();
            return;
        }
        newsfeedAreaLocation = null;
        const status = $("newsfeedMapSearchStatus");
        if (status) status.hidden = true;
        ensureCommunityMap();
        communityMap.setView([citizenCurrentLocation.latitude, citizenCurrentLocation.longitude], 14);
        loadNewsfeed();
    });
}
if ($("newsfeedLocateButton")) {
    $("newsfeedLocateButton").addEventListener("click", () => {
        if (!navigator.geolocation) {
            showToast(getCurrentText("Location is not supported by this browser.", "এই ব্রাউজারে অবস্থান সুবিধা নেই।"));
            return;
        }
        const button = $("newsfeedLocateButton");
        button.disabled = true;
        button.textContent = getCurrentText("Finding your area…", "আপনার এলাকা খোঁজা হচ্ছে…");
        navigator.geolocation.getCurrentPosition(position => {
            citizenCurrentLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            newsfeedAreaLocation = null;
            const mapSearchStatus = $("newsfeedMapSearchStatus");
            if (mapSearchStatus) mapSearchStatus.hidden = true;
            if ($("latitude")) $("latitude").value = position.coords.latitude.toFixed(7);
            if ($("longitude")) $("longitude").value = position.coords.longitude.toFixed(7);
            button.disabled = false;
            button.textContent = getCurrentText("Update my location", "আমার অবস্থান আপডেট করুন");
            loadNewsfeed();
        }, error => {
            button.disabled = false;
            button.textContent = getCurrentText("Use my location", "আমার অবস্থান ব্যবহার করুন");
            showToast(error.code === 1
                ? getCurrentText("Location permission was denied.", "অবস্থানের অনুমতি দেওয়া হয়নি।")
                : getCurrentText("Could not get your location. Please try again.", "অবস্থান পাওয়া যায়নি। আবার চেষ্টা করুন।"));
        }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    });
}

if ($("refreshNewsfeed")) $("refreshNewsfeed").addEventListener("click", loadNewsfeed);
if ($("newsfeedRadius")) $("newsfeedRadius").addEventListener("change", loadNewsfeed);
if ($("newsfeedStatusFilter")) $("newsfeedStatusFilter").addEventListener("change", renderNewsfeed);

if ($("newsfeedList")) {
    $("newsfeedList").addEventListener("click", async event => {
        const profileButton = event.target.closest("[data-view-user]");
        if (profileButton && Number(profileButton.dataset.viewUser)) {
            await openPublicProfile(profileButton.dataset.viewUser);
            return;
        }
        const messageButton = event.target.closest("[data-message-user]");
        if (messageButton) {
            navigate("inbox");
            await openMessageConversation(Number(messageButton.dataset.messageUser), messageButton.dataset.userName);
            return;
        }
        const reportCard = event.target.closest(".newsfeed-report");
        if (reportCard && !event.target.closest("button, a, input, textarea, form")) {
            focusNewsfeedReport(reportCard.dataset.reportId);
            return;
        }
        const expandButton = event.target.closest("[data-newsfeed-expand]");
        if (expandButton) {
            const description = document.querySelector(`[data-newsfeed-description="${expandButton.dataset.newsfeedExpand}"]`);
            if (description) {
                const expanded = expandButton.getAttribute("aria-expanded") !== "true";
                description.classList.toggle("is-expanded", expanded);
                expandButton.setAttribute("aria-expanded", String(expanded));
                expandButton.textContent = getCurrentText(expanded ? "Show less" : "Read more", expanded ? "কম দেখুন" : "আরও দেখুন");
            }
            return;
        }
        const button = event.target.closest("[data-comments-toggle]");
        if (!button) return;
        const reportId = button.dataset.commentsToggle;
        const panel = $(`newsfeed-comments-${reportId}`);
        if (!panel) return;
        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden && panel.dataset.loaded !== "true") await loadReportComments(reportId, panel);
    });

    $("newsfeedList").addEventListener("submit", async event => {
        const form = event.target.closest("[data-comment-form]");
        if (!form) return;
        event.preventDefault();
        const reportId = form.dataset.commentForm;
        const textarea = form.elements.comment;
        const submitButton = form.querySelector('button[type="submit"]');
        const comment = textarea.value.trim();
        if (!comment || comment.length > 1000) return;
        submitButton.disabled = true;
        try {
            await apiRequest(`${API_URL}/reports/${reportId}/comments`, {
                method: "POST",
                body: JSON.stringify({ comment })
            });
            textarea.value = "";
            const report = newsfeedReports.find(item => String(item.report_id) === String(reportId));
            if (report) report.comment_count = Number(report.comment_count || 0) + 1;
            await loadReportComments(reportId, $(`newsfeed-comments-${reportId}`));
            const toggle = document.querySelector(`[data-comments-toggle="${reportId}"]`);
            if (toggle) toggle.textContent = `${getCurrentText("Comments", "মন্তব্য")} (${report?.comment_count || 0})`;
        } catch (error) {
            showToast(error.message || getCurrentText("Unable to post comment.", "মন্তব্য পাঠানো যায়নি।"));
        } finally {
            submitButton.disabled = false;
        }
    });
}

async function loadReportComments(reportId, panel) {
    const commentList = panel?.querySelector(`[data-comment-list="${reportId}"]`);
    if (!commentList) return;
    commentList.innerHTML = `<p class="newsfeed-comment-loading">${escapeHTML(getCurrentText("Loading comments…", "মন্তব্য লোড হচ্ছে…"))}</p>`;
    try {
        const data = await apiRequest(`${API_URL}/reports/${reportId}/comments`);
        const comments = Array.isArray(data.comments) ? data.comments : [];
        commentList.innerHTML = comments.length ? comments.map(comment => `
            <article class="newsfeed-comment">
                <strong>${escapeHTML(comment.author || getCurrentText("Citizen", "নাগরিক"))}</strong>
                <time>${escapeHTML(formatReportDateTime(comment.created_at))}</time>
                <p>${escapeHTML(comment.comment_text)}</p>
            </article>
        `).join("") : `<p class="newsfeed-comment-loading">${escapeHTML(getCurrentText("No comments yet. Start the conversation.", "এখনও মন্তব্য নেই। আলোচনা শুরু করুন।"))}</p>`;
        panel.dataset.loaded = "true";
    } catch (error) {
        commentList.innerHTML = `<p class="newsfeed-comment-loading">${escapeHTML(error.message || getCurrentText("Unable to load comments.", "মন্তব্য লোড করা যায়নি।"))}</p>`;
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
                ${report.time ? `<p class="citizen-report-time">${escapeHTML(report.time)}</p>` : ""}
                ${report.description
                    ? `<p class="citizen-report-description">${escapeHTML(report.description)}</p>`
                    : ""}
                ${renderReportImages(report.images)}
            </div>

            <div class="full-report-meta">
                <span class="status-pill ${getStatusClass(report.status)}">
                    ${escapeHTML(getTranslatedStatus(report.status))}
                </span>
                <div class="citizen-report-actions">
                    <button type="button" class="report-delete-button" data-delete-report="${Number(report.report_id)}">Delete</button>
                </div>
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

async function deleteCitizenReport(reportId) {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
        await apiRequest(`${API_URL}/reports/${Number(reportId)}`, { method: "DELETE" });
        await Promise.allSettled([loadCitizenReports(), loadCitizenStats()]);
        showToast("Report deleted.");
    } catch (error) { showToast(error.message || "Unable to delete report."); }
}

$("allReportsList")?.addEventListener("click", event => {
    const remove = event.target.closest("[data-delete-report]");
    if (remove) deleteCitizenReport(remove.dataset.deleteReport);
});


/* =========================================================
   11. REFRESH DASHBOARD DATA
========================================================= */

async function refreshCitizenDashboard() {
    await loadCitizenProfile();

    // Request private report data only after the profile confirms a session.
    if (isCitizenAuthenticated) {
        await Promise.allSettled([
            loadCitizenReports(),
            loadCitizenStats()
        ]);
    }

    updateProfileInterface();
    renderRecentReports();
    renderAllReports();
    updateStatisticsOnScreen();
}


/* =========================================================
   12. NAVIGATION BETWEEN DASHBOARD SECTIONS
========================================================= */

function navigate(sectionName) {
    const targetSection = $("section-" + sectionName);
    if (!targetSection || !targetSection.classList.contains("page-section")) return;

    // Keep inactive sections out of the accessibility tree and the page flow.
    // This also keeps navigation correct if CSS fails to load.
    document.querySelectorAll(".page-section").forEach(section => {
        const isCurrent = section === targetSection;
        section.classList.toggle("active", isCurrent);
        section.hidden = !isCurrent;
    });

    document.querySelectorAll(".nav-item").forEach(item => {
        const isCurrent = item.dataset.section === sectionName;
        item.classList.toggle("active", isCurrent);
        if (isCurrent) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
    });

    const selectedNavItem = [...document.querySelectorAll(".nav-item")]
        .find(item => item.dataset.section === sectionName);

    const selectedNavText = selectedNavItem
        ? selectedNavItem.querySelector("span[data-en], span[data-bn]")
        : null;

    const breadcrumb = $("breadcrumbCurrent");

    if (breadcrumb) {
        const fallbackLabels = {
            newsfeed: ["Newsfeed", "নিউজফিড"],
            overview: ["Overview", "ওভারভিউ"],
            "new-report": ["Submit a complaint", "অভিযোগ জমা দিন"],
            "my-reports": ["My reports", "আমার অভিযোগ"],
            notifications: ["Notifications", "নোটিফিকেশন"],
            leaderboard: ["Leaderboard", "লিডারবোর্ড"],
            inbox: ["Inbox", "ইনবক্স"]
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
    if (sectionName === "leaderboard") {
        loadCitizenLeaderboard();
    }
    if (sectionName === "newsfeed") loadNewsfeed();
    if (sectionName === "inbox") loadInboxConversations();
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
    localStorage.setItem("civicFixLanguage", currentLanguage);
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
    if (hasLoadedLeaderboard) renderCitizenLeaderboard();
    if (hasLoadedNewsfeed) renderNewsfeed();
}

if ($("languageToggle")) {
    $("languageToggle").addEventListener("click", () => {
        setLanguage(currentLanguage === "en" ? "bn" : "en");
    });
}

function showFirstVisitLocationPrompt() {
    const prompt = $("locationPermissionPrompt");
    if (!prompt || localStorage.getItem("civicFixLocationPromptDecision")) return;

    prompt.classList.add("show");
    prompt.hidden = false;
    prompt.style.display = "grid";
    prompt.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const closePrompt = decision => {
        localStorage.setItem("civicFixLocationPromptDecision", decision);
        prompt.classList.remove("show");
        prompt.hidden = true;
        prompt.style.display = "none";
        prompt.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    };

    $("locationPromptLater").addEventListener("click", () => closePrompt("later"), { once: true });
    $("locationPromptAllow").addEventListener("click", () => {
        closePrompt("allow");
        if ($("locationButton")) $("locationButton").click();
    }, { once: true });
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
                citizenCurrentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
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
            min-height: 34px;
            padding: 6px 10px;
            border: 1px solid var(--border-color, #d8dce5);
            border-radius: 10px;
            cursor: pointer;
            font-size: 12px;
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
            z-index: 1000;
            right: 0;
            left: 0;
            top: auto;
            bottom: calc(100% + 10px);
            box-sizing: border-box;
            width: max-content;
            min-width: min(220px, calc(100vw - 32px));
            max-width: calc(100vw - 32px);
            padding: 14px;
            border: 1px solid var(--border-color, #ddd);
            border-radius: 12px;
            background: var(--card-bg, #fff);
            box-shadow: 0 10px 30px rgba(0,0,0,.12);
            overflow: visible;
        }
        .citizen-account-dropdown[hidden] { display: none; }
        .citizen-account-dropdown strong,
        .citizen-account-dropdown small { display: block; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
        .citizen-account-dropdown small { margin: 5px 0 10px; color: var(--muted, #777); font-size: 12px; }
        .citizen-account-dropdown #accountDropdownLogout {
            display: flex;
            align-items: center;
            width: 100%;
            min-height: 42px;
            box-sizing: border-box;
            padding: 10px 12px;
            border: 1px solid #f2cbc4;
            border-radius: 9px;
            background: #fff0ed;
            color: #ad3934;
            font-weight: 700;
            text-align: left;
        }
        .citizen-account-dropdown #accountDropdownLogout:hover { background: #ffe1dc; color: #8f3029; }
        body.dark .citizen-account-dropdown #accountDropdownLogout { background: #392522; color: #ffb8ac; border-color: #624039; }
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
            $("successModal").hidden = false;
            $("successModal").style.display = "grid";
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
    modal.hidden = true;
    modal.style.display = "none";
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

function userAvatarMarkup(user, sizeClass = "") {
    const name = user.full_name || "Citizen";
    return `<span class="inbox-avatar ${sizeClass}">${user.profile_image ? `<img src="${escapeHTML(user.profile_image)}" alt="">` : escapeHTML(getInitials(name))}</span>`;
}

async function openPublicProfile(userId) {
    try {
        const data = await apiRequest(`/api/users/${Number(userId)}/profile`);
        const profile = data.profile;
        const content = $("publicProfileContent");
        const publicReports = Array.isArray(profile.reports) ? profile.reports : [];
        content.innerHTML = `<div class="public-profile-avatar">${userAvatarMarkup(profile)}</div>
            <h2 id="publicProfileName">${escapeHTML(profile.full_name)}</h2>
            <p class="public-profile-username">@${escapeHTML(profile.username || "")}</p>
            <span class="public-profile-role">${escapeHTML(profile.role || "user")}</span>
            ${profile.city ? `<p class="public-profile-city">${escapeHTML(profile.city)}</p>` : ""}
            <div class="public-profile-stats"><span><strong>${Number(profile.report_count || 0)}</strong> reports</span><span><strong>${Number(profile.points || 0)}</strong> points</span></div>
            <section class="public-profile-reports"><h3>Reports</h3>${publicReports.length ? `<ul>${publicReports.map(report => `<li><strong>${escapeHTML(report.title)}</strong><small>${escapeHTML(report.category || "Report")} · ${escapeHTML(report.status || "submitted")}</small></li>`).join("")}</ul>` : `<p>No reports yet.</p>`}</section>
            <button type="button" class="submit-button" data-profile-message="${Number(profile.user_id)}" data-user-name="${escapeHTML(profile.full_name)}">${escapeHTML(getCurrentText("Send a message", "বার্তা পাঠান"))}</button>`;
        const modal = $("publicProfileModal");
        modal.hidden = false;
        modal.style.display = "grid";
        modal.setAttribute("aria-hidden", "false");
        $("closePublicProfile").focus();
    } catch (error) {
        showToast(error.message || "Unable to load this profile.");
    }
}

function closePublicProfile() {
    const modal = $("publicProfileModal");
    if (!modal) return;
    modal.hidden = true;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}

function renderPeople(container, users, emptyText, withDelete = false) {
    if (!container) return;
    if (!users.length) {
        container.innerHTML = `<p class="inbox-list-empty">${escapeHTML(emptyText)}</p>`;
        return;
    }
    container.innerHTML = users.map(user => `<article class="inbox-person">
        <button type="button" class="inbox-person-main" data-open-conversation="${Number(user.user_id)}" data-user-name="${escapeHTML(user.full_name)}">
            ${userAvatarMarkup(user)}<span><strong>${escapeHTML(user.full_name || "Citizen")}</strong><small>@${escapeHTML(user.username || "user")} · ${escapeHTML(user.role || "user")}</small></span>
        </button>
        <button type="button" class="inbox-person-profile" data-view-user="${Number(user.user_id)}" aria-label="View profile">Profile</button>
        ${withDelete ? `<button type="button" class="inbox-delete-chat" data-delete-conversation="${Number(user.user_id)}" aria-label="Delete conversation">Delete</button>` : ""}
    </article>`).join("");
}

async function searchInboxUsers(query) {
    const results = $("inboxSearchResults");
    if (!query || query.length < 2) {
        results.replaceChildren();
        return;
    }
    try {
        const data = await apiRequest(`/api/messages/users?q=${encodeURIComponent(query)}`);
        renderPeople(results, data.users || [], getCurrentText("No matching users.", "কোনো ব্যবহারকারী মেলেনি।"));
    } catch (error) {
        results.innerHTML = `<p class="inbox-list-empty">${escapeHTML(error.message)}</p>`;
    }
}

async function loadInboxConversations() {
    try {
        const data = await apiRequest("/api/messages/conversations");
        renderPeople($("inboxConversationList"), data.conversations || [], getCurrentText("No conversations yet.", "এখনও কোনো কথোপকথন নেই।"), true);
    } catch (error) {
        $("inboxConversationList").innerHTML = `<p class="inbox-list-empty">${escapeHTML(error.message)}</p>`;
    }
}

async function openMessageConversation(userId, name = "") {
    activeMessageUser = Number(userId);
    const knownUser = [...document.querySelectorAll(`[data-open-conversation="${activeMessageUser}"]`)].map(button => button.dataset.userName).find(Boolean);
    const displayName = name || knownUser || "Conversation";
    $("inboxEmpty").hidden = true;
    $("inboxActiveChat").hidden = false;
    $("inboxChatHeader").innerHTML = `<button type="button" class="inbox-chat-profile" data-view-user="${activeMessageUser}">${escapeHTML(displayName)} <small>View profile</small></button>`;
    await refreshMessageHistory();
    if (inboxRefreshTimer) clearInterval(inboxRefreshTimer);
    inboxRefreshTimer = setInterval(() => {
        if (!$(("section-inbox")).hidden && activeMessageUser) refreshMessageHistory();
    }, 5000);
}

async function refreshMessageHistory() {
    if (!activeMessageUser) return;
    try {
        const data = await apiRequest(`/api/messages/conversations/${activeMessageUser}`);
        const list = $("inboxMessages");
        list.innerHTML = (data.messages || []).map(message => `<article class="inbox-message ${Number(message.sender_id) === Number(citizenProfile.user_id) ? "mine" : "theirs"}"><p>${escapeHTML(message.message_text)}</p><time>${escapeHTML(formatReportDateTime(message.created_at))}</time></article>`).join("") || `<p class="inbox-list-empty">${escapeHTML(getCurrentText("No messages yet. Say hello!", "কোনো বার্তা নেই। শুভেচ্ছা জানান!"))}</p>`;
        list.scrollTop = list.scrollHeight;
    } catch (error) {
        showToast(error.message || "Unable to load messages.");
    }
}

$("inboxUserSearch")?.addEventListener("input", event => {
    clearTimeout(inboxSearchTimer);
    const query = event.target.value.trim();
    inboxSearchTimer = setTimeout(() => searchInboxUsers(query), 220);
});
$("inboxSearchResults")?.addEventListener("click", event => {
    const button = event.target.closest("[data-open-conversation]");
    if (button) openMessageConversation(button.dataset.openConversation, button.dataset.userName);
});
$("inboxConversationList")?.addEventListener("click", event => {
    const remove = event.target.closest("[data-delete-conversation]");
    if (remove) {
        event.stopPropagation();
        const userId = Number(remove.dataset.deleteConversation);
        if (window.confirm("Delete this conversation for both people?")) {
            apiRequest(`/api/messages/conversations/${userId}`, { method: "DELETE" }).then(async () => {
                if (activeMessageUser === userId) {
                    activeMessageUser = null;
                    $("inboxActiveChat").hidden = true;
                    $("inboxEmpty").hidden = false;
                    if (inboxRefreshTimer) clearInterval(inboxRefreshTimer);
                }
                await loadInboxConversations();
                showToast("Conversation deleted.");
            }).catch(error => showToast(error.message || "Unable to delete conversation."));
        }
        return;
    }
    const button = event.target.closest("[data-open-conversation]");
    if (button) openMessageConversation(button.dataset.openConversation, button.dataset.userName);
});
$("inboxCompose")?.addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("inboxMessageInput");
    const message = input.value.trim();
    if (!activeMessageUser || !message) return;
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    try {
        await apiRequest(`/api/messages/conversations/${activeMessageUser}`, { method: "POST", body: JSON.stringify({ message }) });
        input.value = "";
        await refreshMessageHistory();
        await loadInboxConversations();
    } catch (error) {
        showToast(error.message || "Unable to send message.");
    } finally {
        button.disabled = false;
    }
});
$("closePublicProfile")?.addEventListener("click", closePublicProfile);
$("publicProfileModal")?.addEventListener("click", event => { if (event.target === $("publicProfileModal")) closePublicProfile(); });
$("publicProfileContent")?.addEventListener("click", event => {
    const button = event.target.closest("[data-profile-message]");
    if (!button) return;
    closePublicProfile();
    navigate("inbox");
    openMessageConversation(button.dataset.profileMessage, button.dataset.userName);
});
$("inboxChatHeader")?.addEventListener("click", event => {
    const button = event.target.closest("[data-view-user]");
    if (button) openPublicProfile(button.dataset.viewUser);
});

document.addEventListener("click", event => {
    const button = event.target.closest(".inbox-person-profile");
    if (button?.dataset.viewUser && Number(button.dataset.viewUser)) openPublicProfile(button.dataset.viewUser);
});

async function initializeCitizenPortal() {
    // Modal backdrops are hidden until their corresponding action requests them.
    ["profileModal", "locationPermissionPrompt", "successModal"].forEach(id => {
        const modal = $(id);
        if (modal && !modal.classList.contains("show")) {
            modal.hidden = true;
            modal.style.display = "none";
            modal.setAttribute("aria-hidden", "true");
        }
    });

    if ($("toast")) {
        $("toast").hidden = true;
        $("toast").style.display = "none";
    }

    createImageUploadField();
    createAccountDropdown();
    applySavedTheme();
    setLanguage(currentLanguage);

    updateProfileInterface();
    updateStatisticsOnScreen();
    updateUploadLanguage();
    navigate("overview");

    if ($("charCount") && $("issueDescription")) {
        $("charCount").textContent = `${$("issueDescription").value.length} / 2000`;
    }

    await refreshCitizenDashboard();
    if (window.location.protocol === "file:") {
        // A directly opened HTML file bypasses Express, so it cannot receive
        // the server's profile signal. Keep the page-level location prompt usable.
        showFirstVisitLocationPrompt();
    } else if (isCitizenAuthenticated && serverRequestsLocationPermission) {
        showFirstVisitLocationPrompt();
    }
}

initializeCitizenPortal();
