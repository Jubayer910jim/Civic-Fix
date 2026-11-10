"use strict";

const $ = id => document.getElementById(id);
let reports = [];
let institutionProfile = null;
let reportsLoaded = false;
let currentLanguage = localStorage.getItem("civicFixLanguage") === "bn" ? "bn" : "en";
let currentTheme = localStorage.getItem("civicFixTheme") === "dark" ? "dark" : "light";
let activeConversationUser = null;
let inboxSearchTimer = null;
let inboxConversations = [];

const translations = {
    en: {
        institutionPortal: "INSTITUTION PORTAL", workspace: "WORKSPACE", overview: "Overview", assignedReports: "Assigned reports",
        communityService: "Community service", progressTip: "Clear updates help citizens follow progress.", logout: "Log out", backHome: "← Back to homepage",
        openNavigation: "Open navigation", institutionWorkspace: "INSTITUTION WORKSPACE", institutionFallback: "Institution Portal",
        institutionAccount: "Institution account", reportManagement: "CIVIC FIX · REPORT MANAGEMENT", welcomeTitle: "Make progress visible.",
        welcomeDescription: "Review issues assigned to your institution and update citizens as your team works on them.",
        reportSummary: "Report summary", totalAssigned: "Total assigned", awaitingAction: "Awaiting action", inProgress: "In progress", resolved: "Resolved",
        yourQueue: "YOUR QUEUE", queueDescription: "Open a report to review details and update its progress.", refresh: "Refresh",
        searchPlaceholder: "Search reports, categories or locations", filterStatus: "Filter by status", allStatuses: "All statuses",
        loadingReports: "Loading assigned reports…", footerMessage: "Working together for better communities", loadingAccount: "Loading account…",
        switchToBangla: "Switch to Bangla", switchToEnglish: "Switch to English", switchToDark: "Switch to dark mode", switchToLight: "Switch to light mode",
        selectInstitution: "Select an institution", communityProgress: "Community progress", pleaseSignIn: "Please sign in to your institution account.",
        requestFailed: "The request could not be completed.", noFilteredReports: "No reports match these filters.", noAssignedReports: "No reports have been assigned to your institution yet.",
        reportEvidence: "Report evidence", untitled: "Untitled report", generalIssue: "General issue", locationMissing: "Location not given",
        noDescription: "No description provided.", reportedBy: "Reported by", citizen: "Citizen", priority: "Priority", submitted: "Submitted",
        markInProgress: "Mark in progress", markResolved: "Mark resolved", tryAgain: "Try again", reportUpdated: "Report progress updated.",
        askAdministrator: "Ask an administrator to link this account to an institution.",
        pending: "Awaiting action", closed: "Closed", rejected: "Rejected", priorityColon: "Priority:",
        inbox: "Inbox", notifications: "Notifications", directMessages: "DIRECT MESSAGES", inboxDescription: "Message registered citizens, administrators and other institution users.",
        findPeople: "Find people", peopleSearchPlaceholder: "Search name or username…", conversations: "Conversations", loadingConversations: "Loading conversations…",
        chooseConversation: "Choose someone to start a conversation.", writeMessage: "Write a message…", send: "Send", updates: "UPDATES",
        notificationDescription: "Official notifications from administrators and authorities appear here.", loadingNotifications: "Loading notifications…", noConversations: "No conversations yet.",
        noSearchResults: "No registered users found.", searchPrompt: "Type at least 2 characters to search.", noNotifications: "You're all caught up.",
        noMessages: "No messages yet. Say hello!", messageSent: "Message sent.", conversationError: "Unable to load conversations.",
        messageError: "Unable to load messages.", sendError: "Unable to send message.", notificationFrom: "Message from", openChat: "Open conversation", searchError: "Unable to search users."
    },
    bn: {
        institutionPortal: "প্রতিষ্ঠান পোর্টাল", workspace: "কর্মক্ষেত্র", overview: "সংক্ষিপ্ত বিবরণ", assignedReports: "বরাদ্দকৃত প্রতিবেদন",
        communityService: "জনসেবা", progressTip: "নিয়মিত অগ্রগতির তথ্য নাগরিকদের আপডেট থাকতে সাহায্য করে।", logout: "লগ আউট", backHome: "← হোমপেজে ফিরুন",
        openNavigation: "নেভিগেশন খুলুন", institutionWorkspace: "প্রতিষ্ঠানের কর্মক্ষেত্র", institutionFallback: "প্রতিষ্ঠান পোর্টাল",
        institutionAccount: "প্রতিষ্ঠান অ্যাকাউন্ট", reportManagement: "CIVIC FIX · প্রতিবেদন পরিচালনা", welcomeTitle: "অগ্রগতি সবার সামনে আনুন।",
        welcomeDescription: "আপনার প্রতিষ্ঠানে বরাদ্দ করা সমস্যা পর্যালোচনা করুন এবং কাজ চলার সময় নাগরিকদের অগ্রগতি জানান।",
        reportSummary: "প্রতিবেদনের সারাংশ", totalAssigned: "মোট বরাদ্দ", awaitingAction: "কাজ শুরু হয়নি", inProgress: "কাজ চলছে", resolved: "সমাধান হয়েছে",
        yourQueue: "আপনার তালিকা", queueDescription: "বিস্তারিত দেখতে ও অগ্রগতি জানাতে একটি প্রতিবেদন খুলুন।", refresh: "রিফ্রেশ",
        searchPlaceholder: "প্রতিবেদন, বিভাগ বা অবস্থান খুঁজুন", filterStatus: "অবস্থা অনুযায়ী দেখুন", allStatuses: "সব অবস্থা",
        loadingReports: "বরাদ্দকৃত প্রতিবেদন লোড হচ্ছে…", footerMessage: "উন্নত কমিউনিটির জন্য একসাথে কাজ করি", loadingAccount: "অ্যাকাউন্ট লোড হচ্ছে…",
        switchToBangla: "বাংলায় পরিবর্তন করুন", switchToEnglish: "ইংরেজিতে পরিবর্তন করুন", switchToDark: "ডার্ক মোড চালু করুন", switchToLight: "লাইট মোড চালু করুন",
        selectInstitution: "প্রতিষ্ঠান নির্বাচন করুন", communityProgress: "কমিউনিটির অগ্রগতি", pleaseSignIn: "আপনার প্রতিষ্ঠান অ্যাকাউন্টে লগইন করুন।",
        requestFailed: "অনুরোধটি সম্পন্ন করা যায়নি।", noFilteredReports: "এই ফিল্টারে কোনো প্রতিবেদন মেলেনি।", noAssignedReports: "আপনার প্রতিষ্ঠানে এখনো কোনো প্রতিবেদন বরাদ্দ হয়নি।",
        reportEvidence: "প্রতিবেদনের ছবি", untitled: "শিরোনামহীন প্রতিবেদন", generalIssue: "সাধারণ সমস্যা", locationMissing: "অবস্থান দেওয়া হয়নি",
        noDescription: "কোনো বিবরণ দেওয়া হয়নি।", reportedBy: "প্রতিবেদনকারী", citizen: "নাগরিক", priority: "অগ্রাধিকার", submitted: "জমা হয়েছে",
        markInProgress: "কাজ শুরু করুন", markResolved: "সমাধান চিহ্নিত করুন", tryAgain: "আবার চেষ্টা করুন", reportUpdated: "প্রতিবেদনের অগ্রগতি আপডেট হয়েছে।",
        askAdministrator: "এই অ্যাকাউন্টটি কোনো প্রতিষ্ঠানের সঙ্গে যুক্ত করতে প্রশাসকের সঙ্গে যোগাযোগ করুন।",
        pending: "কাজ শুরু হয়নি", closed: "বন্ধ", rejected: "বাতিল", priorityColon: "অগ্রাধিকার:",
        inbox: "ইনবক্স", notifications: "নোটিফিকেশন", directMessages: "সরাসরি বার্তা", inboxDescription: "নিবন্ধিত নাগরিক, প্রশাসক ও অন্য প্রতিষ্ঠানের ব্যবহারকারীদের বার্তা পাঠান।",
        findPeople: "ব্যবহারকারী খুঁজুন", peopleSearchPlaceholder: "নাম বা ইউজারনেম লিখুন…", conversations: "কথোপকথন", loadingConversations: "কথোপকথন লোড হচ্ছে…",
        chooseConversation: "কথোপকথন শুরু করতে কাউকে বেছে নিন।", writeMessage: "বার্তা লিখুন…", send: "পাঠান", updates: "আপডেট",
        notificationDescription: "প্রশাসক ও কর্তৃপক্ষের আনুষ্ঠানিক নোটিফিকেশন এখানে দেখা যাবে।", loadingNotifications: "নোটিফিকেশন লোড হচ্ছে…", noConversations: "এখনো কোনো কথোপকথন নেই।",
        noSearchResults: "কোনো নিবন্ধিত ব্যবহারকারী পাওয়া যায়নি।", searchPrompt: "খুঁজতে কমপক্ষে ২টি অক্ষর লিখুন।", noNotifications: "আপনি সব আপডেট দেখে ফেলেছেন।",
        noMessages: "কোনো বার্তা নেই। শুভেচ্ছা জানান!", messageSent: "বার্তা পাঠানো হয়েছে।", conversationError: "কথোপকথন লোড করা যায়নি।",
        messageError: "বার্তা লোড করা যায়নি।", sendError: "বার্তা পাঠানো যায়নি।", notificationFrom: "বার্তা পাঠিয়েছেন", openChat: "কথোপকথন খুলুন", searchError: "ব্যবহারকারী খোঁজা যায়নি।"
    }
};

function t(key) { return translations[currentLanguage][key] || translations.en[key] || key; }

function setTheme(theme) {
    currentTheme = theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark", currentTheme === "dark");
    localStorage.setItem("civicFixTheme", currentTheme);
    const button = $("themeToggle");
    button.textContent = currentTheme === "dark" ? "☀" : "☾";
    button.setAttribute("aria-label", t(currentTheme === "dark" ? "switchToLight" : "switchToDark"));
    button.title = t(currentTheme === "dark" ? "switchToLight" : "switchToDark");
}

function localizeInstitutionName(name) {
    const normalized = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    if (currentLanguage === "bn") {
        if (normalized.includes("wasa")) return "ওয়াসা";
        if (normalized.includes("citycorporation")) return "সিটি কর্পোরেশন";
        if (normalized.includes("pallibidyut") || normalized.includes("pollibiddut")) return "পল্লী বিদ্যুৎ";
    }
    return name || t("institutionFallback");
}

function setInstitutionAvatar(name) {
    const avatar = $("accountInitials");
    const normalized = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
    const initials = String(name || "Civic Fix").split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
    const institutionLogos = [
        { match: value => value.includes("wasa"), url: "https://commons.wikimedia.org/wiki/Special:FilePath/Seal_of_Dhaka_Water_Supply_and_Sewerage_Authority.svg" },
        { match: value => value.includes("citycorporation"), url: "https://erevenue.dncc.gov.bd/images/logo_TL_Print.png" },
        { match: value => value.includes("pollibiddut") || value.includes("pallibidyut") || value.includes("ruralelectrification"), url: "https://www.tbsnews.net/sites/default/files/styles/author/public/organization/logo/bangladesh_rural_electrification_board.jpg" }
    ];
    const logo = institutionLogos.find(item => item.match(normalized));
    avatar.textContent = initials || "CF";
    avatar.removeAttribute("aria-label");
    if (!logo) return;
    avatar.innerHTML = `<img src="${logo.url}" alt="${escapeHTML(name || "Institution")} logo" loading="lazy">`;
    avatar.setAttribute("aria-label", `${name || "Institution"} logo`);
    avatar.querySelector("img").addEventListener("error", () => {
        avatar.textContent = initials || "CF";
        avatar.removeAttribute("aria-label");
    }, { once: true });
}

function applyLanguage() {
    document.documentElement.lang = currentLanguage;
    document.title = currentLanguage === "bn" ? "প্রতিষ্ঠান পোর্টাল | Civic Fix" : "Institution Portal | Civic Fix";
    document.querySelectorAll("[data-i18n]").forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-aria]").forEach(element => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
    $("languageToggle").textContent = currentLanguage === "en" ? "বাংলা" : "English";
    $("languageToggle").setAttribute("aria-label", t(currentLanguage === "en" ? "switchToBangla" : "switchToEnglish"));
    $("languageToggle").title = t(currentLanguage === "en" ? "switchToBangla" : "switchToEnglish");
    if (institutionProfile) {
        $("institutionName").textContent = localizeInstitutionName(institutionProfile.institution_name);
        $("accountName").textContent = institutionProfile.full_name || localizeInstitutionName(institutionProfile.institution_name) || t("institutionAccount");
    }
    setTheme(currentTheme);
    renderStats(lastStats);
    if (reportsLoaded) renderReports();
    renderInboxPeople(inboxConversations, $("institutionConversationList"), t("noConversations"), true);
    renderNotifications();
}

let lastStats = {};

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
}

function safeAssetUrl(value) {
    const url = String(value || "");
    return url.startsWith("/") || /^https:\/\//i.test(url) ? url : "";
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
        window.location.replace("/login.html?role=institution");
        throw new Error("Please sign in to your institution account.");
    }
    if (!response.ok || !data.success) throw new Error(data.message || "The request could not be completed.");
    return data;
}

function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function localizedError(error) {
    const message = String(error?.message || "");
    if (/sign in/i.test(message)) return t("pleaseSignIn");
    if (/not linked to an institution/i.test(message)) return t("askAdministrator");
    if (/request could not be completed/i.test(message)) return t("requestFailed");
    return message || t("requestFailed");
}

function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

function formatMessageTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function messageAvatar(user) {
    const name = user.full_name || user.username || "?";
    const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    return `<span class="institution-person-avatar">${escapeHTML(initials || "?")}</span>`;
}

function renderInboxPeople(people, container, emptyText, showLastMessage = false) {
    if (!container) return;
    if (!people.length) { container.innerHTML = `<p class="inbox-list-empty">${escapeHTML(emptyText)}</p>`; return; }
    container.innerHTML = people.map(person => {
        const id = Number(person.user_id || person.other_user_id);
        const name = person.full_name || person.username || "User";
        const preview = showLastMessage ? `<small>${escapeHTML(person.message_text || "")}</small>` : "";
        return `<button type="button" class="institution-person" data-open-institution-chat="${id}" data-user-name="${escapeHTML(name)}">
            ${messageAvatar(person)}<span class="institution-person-copy"><strong>${escapeHTML(name)}</strong><small>@${escapeHTML(person.username || "user")} · ${escapeHTML(person.role || "user")}</small>${preview}</span>
            ${showLastMessage ? `<time>${escapeHTML(formatMessageTime(person.created_at))}</time>` : ""}
        </button>`;
    }).join("");
}

async function searchInstitutionUsers(query) {
    const results = $("institutionSearchResults");
    if (query.length < 2) { results.innerHTML = query ? `<p class="inbox-list-empty">${escapeHTML(t("searchPrompt"))}</p>` : ""; return; }
    try {
        const data = await apiRequest(`/api/messages/users?q=${encodeURIComponent(query)}`);
        renderInboxPeople(data.users || [], results, t("noSearchResults"));
    } catch (error) { results.innerHTML = `<p class="inbox-list-empty">${escapeHTML(error.message || t("searchError"))}</p>`; }
}

async function loadInstitutionConversations() {
    try {
        const data = await apiRequest("/api/messages/conversations");
        inboxConversations = data.conversations || [];
        renderInboxPeople(inboxConversations, $("institutionConversationList"), t("noConversations"), true);
        renderNotifications();
    } catch (error) {
        $("institutionConversationList").innerHTML = `<p class="inbox-list-empty">${escapeHTML(error.message || t("conversationError"))}</p>`;
    }
}

function renderNotifications() {
    const target = $("institutionNotificationList");
    if (!target) return;
    const incoming = inboxConversations.filter(message => Number(message.sender_id) !== Number(institutionProfile?.user_id));
    const officialNotifications = incoming.filter(message => ["admin", "authority", "institution"].includes(String(message.role || "").toLowerCase()));
    const inboxBadge = $("navInboxCount");
    const notificationBadge = $("navNotificationCount");
    inboxBadge.textContent = String(incoming.length);
    inboxBadge.hidden = incoming.length === 0;
    notificationBadge.textContent = String(officialNotifications.length);
    notificationBadge.hidden = officialNotifications.length === 0;
    if (!officialNotifications.length) { target.innerHTML = `<div class="empty-state">${escapeHTML(t("noNotifications"))}</div>`; return; }
    target.innerHTML = officialNotifications.map(message => {
        const name = message.full_name || message.username || "User";
        return `<article class="institution-notification">${messageAvatar(message)}<div><strong>${escapeHTML(t("notificationFrom"))} ${escapeHTML(name)}</strong><p>${escapeHTML(message.message_text || "")}</p><time>${escapeHTML(formatDateTime(message.created_at))}</time></div><button type="button" class="refresh-button" data-open-institution-chat="${Number(message.other_user_id)}" data-user-name="${escapeHTML(name)}">${escapeHTML(t("openChat"))}</button></article>`;
    }).join("");
}

async function openInstitutionConversation(userId, name = "") {
    activeConversationUser = Number(userId);
    const person = inboxConversations.find(item => Number(item.other_user_id) === activeConversationUser);
    const displayName = name || person?.full_name || person?.username || "User";
    $("institutionInboxEmpty").hidden = true;
    $("institutionActiveChat").hidden = false;
    $("institutionChatHeader").innerHTML = `<strong>${escapeHTML(displayName)}</strong><small>@${escapeHTML(person?.username || "")}</small>`;
    await refreshInstitutionMessages();
    if (inboxRefreshTimer) clearInterval(inboxRefreshTimer);
    inboxRefreshTimer = setInterval(() => { if (activeConversationUser) refreshInstitutionMessages(); }, 15000);
}

async function refreshInstitutionMessages() {
    if (!activeConversationUser) return;
    try {
        const data = await apiRequest(`/api/messages/conversations/${activeConversationUser}`);
        const list = $("institutionMessages");
        list.innerHTML = (data.messages || []).map(message => `<article class="institution-message ${Number(message.sender_id) === Number(institutionProfile?.user_id) ? "mine" : "theirs"}"><p>${escapeHTML(message.message_text)}</p><time>${escapeHTML(formatDateTime(message.created_at))}</time></article>`).join("") || `<p class="inbox-list-empty">${escapeHTML(t("noMessages"))}</p>`;
        list.scrollTop = list.scrollHeight;
    } catch (error) { showToast(error.message || t("messageError")); }
}

function showInstitutionPage(page, updateHash = true) {
    const pageId = ({ overview: "overviewPage", inbox: "inboxPage", notifications: "notificationsPage" })[page] || "overviewPage";
    document.querySelectorAll(".institution-page").forEach(section => { section.hidden = section.id !== pageId; });
    document.querySelectorAll("[data-page]").forEach(link => link.classList.toggle("active", link.dataset.page === page));
    if (updateHash) history.replaceState(null, "", `#${page}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("institutionSidebar").classList.remove("open");
    $("menuButton").setAttribute("aria-expanded", "false");
    if (page === "inbox" || page === "notifications") loadInstitutionConversations();
}

function statusKey(value) {
    const status = String(value || "pending").toLowerCase().replace(/[ -]/g, "_");
    if (["forwarded", "submitted", "under_review", "pending"].includes(status)) return "pending";
    return status;
}

function statusText(value) {
    const key = statusKey(value);
    return ({ pending: t("pending"), in_progress: t("inProgress"), resolved: t("resolved"), closed: t("closed"), rejected: t("rejected") })[key] || key.replace(/_/g, " ");
}

function renderStats(stats) {
    lastStats = stats || {};
    const locale = currentLanguage === "bn" ? "bn-BD" : "en-US";
    $("totalCount").textContent = Number(stats.total || 0).toLocaleString(locale);
    $("pendingCount").textContent = Number(stats.pending || 0).toLocaleString(locale);
    $("progressCount").textContent = Number(stats.inProgress || 0).toLocaleString(locale);
    $("resolvedCount").textContent = Number(stats.resolved || 0).toLocaleString(locale);
    $("navReportCount").textContent = Number(stats.total || 0).toLocaleString(locale);
}

function getVisibleReports() {
    const query = $("reportSearch").value.trim().toLowerCase();
    const status = $("statusFilter").value;
    return reports.filter(report => {
        const searchable = [report.title, report.tracking_code, report.report_id, report.category_name,
            report.location_address, report.citizen_name, report.description].join(" ").toLowerCase();
        return searchable.includes(query) && (status === "all" || statusKey(report.status) === status);
    });
}

function renderReports() {
    const list = $("reportList");
    const visible = getVisibleReports();
    if (!visible.length) {
        list.innerHTML = `<div class="empty-state">${reports.length ? t("noFilteredReports") : t("noAssignedReports")}</div>`;
        return;
    }
    list.innerHTML = visible.map(report => {
        const key = statusKey(report.status);
        const id = Number(report.report_id);
        const images = (Array.isArray(report.images) ? report.images : []).map(image => {
            const url = safeAssetUrl(image.image_url || image.image_path);
            return url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHTML(url)}" alt="${escapeHTML(t("reportEvidence"))}" loading="lazy"></a>` : "";
        }).join("");
        const canUpdate = !["closed", "rejected", "resolved"].includes(key);
        return `<details class="report-card">
            <summary class="report-summary">
                <span class="report-main"><span class="report-number">${escapeHTML(report.tracking_code || `#${id}`)}</span><span class="report-main-text"><h3>${escapeHTML(report.title || t("untitled"))}</h3><p>${escapeHTML(report.category_name || t("generalIssue"))} · ${escapeHTML(report.location_address || t("locationMissing"))}</p></span></span>
                <span class="report-summary-side"><time class="report-date">${escapeHTML(formatDateTime(report.created_at))}</time><span class="status-badge ${escapeHTML(key.replace(/_/g, "-"))}">${escapeHTML(statusText(report.status))}</span></span>
            </summary>
            <div class="report-detail">
                <p class="report-description">${escapeHTML(report.description || t("noDescription"))}</p>
                <div class="report-meta"><span>${escapeHTML(t("reportedBy"))} <strong>${escapeHTML(report.citizen_name || t("citizen"))}</strong></span>${report.priority ? `<span>${escapeHTML(t("priorityColon"))} <strong>${escapeHTML(report.priority)}</strong></span>` : ""}<span>${escapeHTML(t("submitted"))} ${escapeHTML(formatDateTime(report.created_at))}</span></div>
                ${images ? `<div class="report-images">${images}</div>` : ""}
                ${canUpdate ? `<div class="report-actions"><button type="button" data-report-status="in_progress" data-report-id="${id}"${key === "in_progress" ? " disabled" : ""}>${escapeHTML(t("markInProgress"))}</button><button type="button" class="resolve" data-report-status="resolved" data-report-id="${id}">${escapeHTML(t("markResolved"))}</button></div>` : ""}
            </div>
        </details>`;
    }).join("");
}

async function loadReports() {
    const refresh = $("refreshButton");
    refresh.disabled = true;
    try {
        const data = await apiRequest("/api/institution/reports");
        reports = Array.isArray(data.reports) ? data.reports : [];
        reportsLoaded = true;
        renderStats(data.stats || {});
        renderReports();
    } catch (error) {
        $("reportList").innerHTML = `<div class="error-state">${escapeHTML(localizedError(error))}<br><button type="button" class="refresh-button" id="retryButton">${escapeHTML(t("tryAgain"))}</button></div>`;
    } finally {
        refresh.disabled = false;
    }
}

async function initialize() {
    try {
        const data = await apiRequest("/api/institution/profile");
        institutionProfile = data.profile;
        $("institutionName").textContent = localizeInstitutionName(institutionProfile.institution_name);
        $("accountName").textContent = institutionProfile.full_name || localizeInstitutionName(institutionProfile.institution_name) || t("institutionAccount");
        $("accountEmail").textContent = institutionProfile.email || t("institutionAccount");
        const name = institutionProfile.institution_name || institutionProfile.full_name || "Civic Fix";
        setInstitutionAvatar(name);
        await loadReports();
        await loadInstitutionConversations();
        setInterval(loadInstitutionConversations, 30000);
    } catch (error) {
        if (!/sign in/i.test(error.message)) {
            $("reportList").innerHTML = `<div class="error-state">${escapeHTML(localizedError(error))}<br>${escapeHTML(t("askAdministrator"))}</div>`;
        }
    }
}

$("reportSearch").addEventListener("input", renderReports);
$("statusFilter").addEventListener("change", renderReports);
$("refreshButton").addEventListener("click", loadReports);
$("reportList").addEventListener("click", async event => {
    const retry = event.target.closest("#retryButton");
    if (retry) return loadReports();
    const button = event.target.closest("[data-report-status]");
    if (!button) return;
    button.disabled = true;
    try {
        await apiRequest(`/api/institution/reports/${Number(button.dataset.reportId)}/status`, {
            method: "PATCH", body: JSON.stringify({ status: button.dataset.reportStatus })
        });
        showToast(t("reportUpdated"));
        await loadReports();
    } catch (error) {
        showToast(localizedError(error));
        button.disabled = false;
    }
});

$("logoutButton").addEventListener("click", async () => {
    try { await apiRequest("/api/auth/logout", { method: "POST", body: "{}" }); }
    finally { window.location.replace("/"); }
});

$("menuButton").addEventListener("click", () => {
    const open = $("institutionSidebar").classList.toggle("open");
    $("menuButton").setAttribute("aria-expanded", String(open));
});
document.querySelectorAll("[data-page]").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    showInstitutionPage(link.dataset.page);
}));
window.addEventListener("hashchange", () => showInstitutionPage(location.hash.slice(1), false));

$("institutionUserSearch").addEventListener("input", event => {
    clearTimeout(inboxSearchTimer);
    const query = event.target.value.trim();
    inboxSearchTimer = setTimeout(() => searchInstitutionUsers(query), 220);
});
for (const id of ["institutionSearchResults", "institutionConversationList", "institutionNotificationList"]) {
    $(id).addEventListener("click", event => {
        const button = event.target.closest("[data-open-institution-chat]");
        if (!button) return;
        if (id === "institutionNotificationList") showInstitutionPage("inbox");
        openInstitutionConversation(button.dataset.openInstitutionChat, button.dataset.userName);
    });
}
$("institutionCompose").addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("institutionMessageInput");
    const message = input.value.trim();
    if (!activeConversationUser || !message) return;
    try {
        await apiRequest(`/api/messages/conversations/${activeConversationUser}`, { method: "POST", body: JSON.stringify({ message }) });
        input.value = "";
        await refreshInstitutionMessages();
        await loadInstitutionConversations();
    } catch (error) { showToast(error.message || t("sendError")); }
});
$("refreshInboxButton").addEventListener("click", loadInstitutionConversations);
$("refreshNotificationsButton").addEventListener("click", loadInstitutionConversations);

$("languageToggle").addEventListener("click", () => {
    currentLanguage = currentLanguage === "en" ? "bn" : "en";
    localStorage.setItem("civicFixLanguage", currentLanguage);
    applyLanguage();
});
$("themeToggle").addEventListener("click", () => setTheme(currentTheme === "dark" ? "light" : "dark"));

applyLanguage();
showInstitutionPage(location.hash.slice(1) || "overview", false);
initialize();
