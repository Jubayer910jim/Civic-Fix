"use strict";

const $ = id => document.getElementById(id);
let dashboardData = { cases: [], feedback: [], repeated_delays: [], stats: {} };
let currentLanguage = localStorage.getItem("civicFixLanguage") === "bn" ? "bn" : "en";
let currentTheme = localStorage.getItem("civicFixTheme") === "dark" ? "dark" : "light";

const translations = {
    en: {
        authorityPortal:"AUTHORITY PORTAL",oversight:"OVERSIGHT",dashboard:"Dashboard",caseDelays:"Case delays",citizenFeedback:"Citizen feedback",oversightOnly:"Oversight view",oversightHint:"Review progress across assigned institutions.",logout:"Log out",backHome:"← Back to homepage",openNavigation:"Open navigation",oversightWorkspace:"CIVIC FIX · OVERSIGHT",dashboardTitle:"Authority Dashboard",authorityRole:"Authority",loadingAccount:"Loading account…",heroKicker:"PUBLIC SERVICE OVERSIGHT",heroTitle:"See where cases need attention.",heroDescription:"Track overdue reports, service targets, recurring delays and what citizens are saying.",refresh:"Refresh data",overdueCases:"Overdue cases",openCasesPastTarget:"Open cases past target",slaBreaches:"SLA breaches",staleCases:"Cases with no timely update",recentComments:"Recent citizen comments",repeatedDelays:"Repeated delays",institutionsWithRepeat:"Institutions with multiple overdue cases",slaPolicy:"SLA monitoring policy",slaPolicyText:"Awaiting action: 7 days · In progress: 14 days. A breach is flagged when a case has had no update within its target.",needsAttention:"NEEDS ATTENTION",delayReviewTitle:"Overdue cases & SLA breaches",delayReviewDescription:"Open cases grouped by the institution handling them.",allDelayed:"All delayed",overdueOnly:"Overdue",breachesOnly:"SLA breaches",report:"Report",institution:"Institution",status:"Status",caseAge:"Age",lastUpdate:"Last update",signal:"Signal",loadingData:"Loading oversight data…",patterns:"PATTERNS",repeatTitle:"Repeated delays by institution",repeatDescription:"Institutions with more than one overdue open case.",citizenVoice:"CITIZEN VOICE",feedbackTitle:"Recent citizen feedback",feedbackDescription:"Comments posted by citizens on their reports.",footer:"Better services through transparent follow-up.",days:"days",overdue:"Overdue",breach:"SLA breach",both:"Overdue + breach",noDelayed:"No overdue cases or SLA breaches.",noRepeated:"No institution has multiple overdue cases.",noFeedback:"No citizen comments have been submitted yet.",unknownInstitution:"Unassigned",awaiting:"Awaiting action",inProgress:"In progress",submitted:"Submitted",underReview:"Under review",forwarded:"Forwarded",resolved:"Resolved",closed:"Closed",rejected:"Rejected",updated:"Last refreshed",switchToDark:"Switch to dark mode",switchToLight:"Switch to light mode",switchToBangla:"Switch to Bangla",switchToEnglish:"Switch to English",loadError:"Unable to load authority dashboard data.",signIn:"Please sign in with an authority account."
    },
    bn: {
        authorityPortal:"কর্তৃপক্ষ পোর্টাল",oversight:"তদারকি",dashboard:"ড্যাশবোর্ড",caseDelays:"প্রতিবেদনে বিলম্ব",citizenFeedback:"নাগরিক মতামত",oversightOnly:"তদারকি প্যানেল",oversightHint:"সংশ্লিষ্ট প্রতিষ্ঠানগুলোর অগ্রগতি পর্যালোচনা করুন।",logout:"লগ আউট",backHome:"← হোমপেজে ফিরুন",openNavigation:"নেভিগেশন খুলুন",oversightWorkspace:"CIVIC FIX · তদারকি",dashboardTitle:"কর্তৃপক্ষ ড্যাশবোর্ড",authorityRole:"কর্তৃপক্ষ",loadingAccount:"অ্যাকাউন্ট লোড হচ্ছে…",heroKicker:"জনসেবা তদারকি",heroTitle:"কোন মামলায় নজর দেওয়া দরকার দেখুন।",heroDescription:"বিলম্বিত প্রতিবেদন, সেবার সময়সীমা, পুনরাবৃত্ত বিলম্ব ও নাগরিক মতামত দেখুন।",refresh:"তথ্য রিফ্রেশ",overdueCases:"সময় পেরোনো প্রতিবেদন",openCasesPastTarget:"নির্ধারিত সময়ের বাইরে খোলা প্রতিবেদন",slaBreaches:"SLA লঙ্ঘন",staleCases:"সময়মতো আপডেট হয়নি",recentComments:"সাম্প্রতিক নাগরিক মন্তব্য",repeatedDelays:"পুনরাবৃত্ত বিলম্ব",institutionsWithRepeat:"একাধিক বিলম্বিত প্রতিবেদন আছে এমন প্রতিষ্ঠান",slaPolicy:"SLA পর্যবেক্ষণ নীতি",slaPolicyText:"কাজ শুরুর অপেক্ষা: ৭ দিন · কাজ চলছে: ১৪ দিন। নির্ধারিত সময়ে আপডেট না এলে লঙ্ঘন হিসেবে দেখানো হয়।",needsAttention:"মনোযোগ প্রয়োজন",delayReviewTitle:"বিলম্বিত প্রতিবেদন ও SLA লঙ্ঘন",delayReviewDescription:"দায়িত্বপ্রাপ্ত প্রতিষ্ঠান অনুযায়ী খোলা প্রতিবেদন।",allDelayed:"সব বিলম্বিত",overdueOnly:"সময় পেরিয়েছে",breachesOnly:"SLA লঙ্ঘন",report:"প্রতিবেদন",institution:"প্রতিষ্ঠান",status:"অবস্থা",caseAge:"সময়কাল",lastUpdate:"শেষ আপডেট",signal:"সংকেত",loadingData:"তদারকির তথ্য লোড হচ্ছে…",patterns:"ধারা",repeatTitle:"প্রতিষ্ঠানভিত্তিক পুনরাবৃত্ত বিলম্ব",repeatDescription:"একাধিক সময়োত্তীর্ণ প্রতিবেদন আছে এমন প্রতিষ্ঠান।",citizenVoice:"নাগরিকের মতামত",feedbackTitle:"সাম্প্রতিক নাগরিক মতামত",feedbackDescription:"নাগরিকদের প্রতিবেদনে করা মন্তব্য।",footer:"স্বচ্ছ তদারকিতে উন্নত সেবা।",days:"দিন",overdue:"সময় পেরিয়েছে",breach:"SLA লঙ্ঘন",both:"সময় পেরিয়েছে + লঙ্ঘন",noDelayed:"কোনো বিলম্বিত প্রতিবেদন বা SLA লঙ্ঘন নেই।",noRepeated:"কোনো প্রতিষ্ঠানে একাধিক বিলম্বিত প্রতিবেদন নেই।",noFeedback:"এখনো কোনো নাগরিক মন্তব্য জমা পড়েনি।",unknownInstitution:"বরাদ্দ হয়নি",awaiting:"কাজের অপেক্ষায়",inProgress:"কাজ চলছে",submitted:"জমা হয়েছে",underReview:"পর্যালোচনাধীন",forwarded:"পাঠানো হয়েছে",resolved:"সমাধান হয়েছে",closed:"বন্ধ",rejected:"বাতিল",updated:"সর্বশেষ রিফ্রেশ",switchToDark:"ডার্ক মোড চালু করুন",switchToLight:"লাইট মোড চালু করুন",switchToBangla:"বাংলায় পরিবর্তন করুন",switchToEnglish:"ইংরেজিতে পরিবর্তন করুন",loadError:"কর্তৃপক্ষ ড্যাশবোর্ডের তথ্য লোড করা যায়নি।",signIn:"কর্তৃপক্ষ অ্যাকাউন্ট দিয়ে লগইন করুন।"
    }
};

function t(key) { return translations[currentLanguage][key] || translations.en[key] || key; }
function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char])); }
function setTheme(theme) {
    currentTheme = theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark", currentTheme === "dark");
    localStorage.setItem("civicFixTheme", currentTheme);
    const button = $("themeToggle");
    button.textContent = currentTheme === "dark" ? "☀" : "☾";
    button.setAttribute("aria-label", t(currentTheme === "dark" ? "switchToLight" : "switchToDark"));
    button.title = t(currentTheme === "dark" ? "switchToLight" : "switchToDark");
}
function applyLanguage() {
    document.documentElement.lang = currentLanguage;
    document.title = currentLanguage === "bn" ? "কর্তৃপক্ষ ড্যাশবোর্ড | Civic Fix" : "Authority Dashboard | Civic Fix";
    document.querySelectorAll("[data-i18n]").forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll("[data-i18n-aria]").forEach(element => element.setAttribute("aria-label", t(element.dataset.i18nAria)));
    $("languageToggle").textContent = currentLanguage === "en" ? "বাংলা" : "English";
    $("languageToggle").setAttribute("aria-label", t(currentLanguage === "en" ? "switchToBangla" : "switchToEnglish"));
    setTheme(currentTheme);
    renderDashboard();
}
async function apiRequest(url, options = {}) {
    const response = await fetch(url, { credentials:"same-origin", ...options, headers:{"Content-Type":"application/json",...(options.headers||{})} });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { location.replace("/login.html?role=authority"); throw new Error(t("signIn")); }
    if (response.status === 403) { location.replace("/login.html?role=authority"); throw new Error(t("signIn")); }
    if (!response.ok || !data.success) throw new Error(data.message || t("loadError"));
    return data;
}
function statusText(status) {
    const key = String(status || "").toLowerCase();
    const keys = {pending:"awaiting",submitted:"submitted",under_review:"underReview",forwarded:"forwarded",in_progress:"inProgress",resolved:"resolved",closed:"closed",rejected:"rejected"};
    return t(keys[key] || key);
}
function renderCases() {
    const filter = $("caseFilter").value;
    const cases = dashboardData.cases.filter(item => item.is_overdue || item.is_sla_breached).filter(item => filter === "all" || (filter === "overdue" ? item.is_overdue : item.is_sla_breached));
    const body = $("caseRows");
    if (!cases.length) { body.innerHTML = `<tr><td colspan="6" class="table-state">${escapeHTML(t("noDelayed"))}</td></tr>`; return; }
    body.innerHTML = cases.map(item => {
        const signalKey = item.is_overdue && item.is_sla_breached ? "both" : item.is_sla_breached ? "breach" : "overdue";
        const signalClass = signalKey === "both" ? "both" : signalKey;
        const age = Number(item.age_days).toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-US");
        const since = Number(item.days_since_update).toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-US");
        return `<tr><td><span class="report-cell"><strong>${escapeHTML(item.title || "Untitled")}</strong><small>${escapeHTML(item.tracking_code || `#${item.report_id}`)}</small></span></td><td>${escapeHTML(item.institution_name || t("unknownInstitution"))}</td><td><span class="status-pill ${escapeHTML(String(item.status).toLowerCase())}">${escapeHTML(statusText(item.status))}</span></td><td>${age} ${escapeHTML(t("days"))}</td><td>${since} ${escapeHTML(t("days"))}</td><td><span class="signal-pill ${signalClass}">${escapeHTML(t(signalKey))}</span></td></tr>`;
    }).join("");
}
function renderRepeats() {
    const list = $("repeatList");
    const repeats = dashboardData.repeated_delays || [];
    if (!repeats.length) { list.innerHTML = `<div class="table-state">${escapeHTML(t("noRepeated"))}</div>`; return; }
    list.innerHTML = repeats.map(item => `<article class="repeat-item"><span><strong>${escapeHTML(item.institution_name || t("unknownInstitution"))}</strong><small>${Number(item.oldest_case_days).toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-US")} ${escapeHTML(t("days"))} · ${escapeHTML(t("overdue"))}</small></span><span class="repeat-count">${Number(item.overdue_cases).toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-US")}</span></article>`).join("");
}
function renderFeedback() {
    const feedback = dashboardData.feedback || [];
    $("feedbackSectionCount").textContent = Number(feedback.length).toLocaleString(currentLanguage === "bn" ? "bn-BD" : "en-US");
    if (!feedback.length) { $("feedbackList").innerHTML = `<div class="table-state">${escapeHTML(t("noFeedback"))}</div>`; return; }
    $("feedbackList").innerHTML = feedback.map(item => `<article class="feedback-item"><p>${escapeHTML(item.comment_text)}</p><footer><span>${escapeHTML(item.citizen_name || "Citizen")} · ${escapeHTML(item.institution_name || t("unknownInstitution"))}</span><span>${escapeHTML(item.tracking_code || `#${item.report_id}`)} · ${escapeHTML(new Date(item.created_at).toLocaleDateString(currentLanguage === "bn" ? "bn-BD" : "en-GB", {day:"2-digit",month:"short",year:"numeric"}))}</span></footer></article>`).join("");
}
function renderDashboard() {
    const locale = currentLanguage === "bn" ? "bn-BD" : "en-US";
    $("overdueCount").textContent = Number(dashboardData.stats?.overdue_cases || 0).toLocaleString(locale);
    $("breachCount").textContent = Number(dashboardData.stats?.sla_breaches || 0).toLocaleString(locale);
    $("feedbackCount").textContent = Number(dashboardData.stats?.citizen_feedback || 0).toLocaleString(locale);
    $("repeatCount").textContent = Number(dashboardData.stats?.repeated_delays || 0).toLocaleString(locale);
    const overdueBadge = $("navOverdueCount");
    overdueBadge.textContent = Number(dashboardData.stats?.overdue_cases || 0).toLocaleString(locale);
    overdueBadge.hidden = !dashboardData.stats?.overdue_cases;
    renderCases(); renderRepeats(); renderFeedback();
}
async function loadDashboard() {
    $("refreshButton").disabled = true;
    try {
        const [dashboard, currentUser] = await Promise.all([apiRequest("/api/authority/dashboard"), apiRequest("/api/auth/me")]);
        dashboardData = dashboard;
        const name = currentUser.user?.full_name || currentUser.user?.email || t("authorityRole");
        $("accountName").textContent = name;
        $("accountAvatar").textContent = name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
        renderDashboard();
        $("lastRefreshed").textContent = `${t("updated")}: ${new Date().toLocaleTimeString(currentLanguage === "bn" ? "bn-BD" : "en-GB", {hour:"2-digit",minute:"2-digit"})}`;
    } catch (error) {
        if (error.message !== t("signIn")) showToast(error.message || t("loadError"));
    } finally { $("refreshButton").disabled = false; }
}
function showToast(message) { const toast = $("toast"); toast.textContent = message; toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 3500); }

$("refreshButton").addEventListener("click", loadDashboard);
$("caseFilter").addEventListener("change", renderCases);
$("themeToggle").addEventListener("click", () => setTheme(currentTheme === "dark" ? "light" : "dark"));
$("languageToggle").addEventListener("click", () => { currentLanguage = currentLanguage === "en" ? "bn" : "en"; localStorage.setItem("civicFixLanguage", currentLanguage); applyLanguage(); });
$("menuButton").addEventListener("click", () => { const open = $("authoritySidebar").classList.toggle("open"); $("menuButton").setAttribute("aria-expanded", String(open)); });
document.querySelectorAll(".authority-nav a").forEach(link => link.addEventListener("click", () => { document.querySelectorAll(".authority-nav a").forEach(item => item.classList.remove("active")); link.classList.add("active"); $("authoritySidebar").classList.remove("open"); }));
$("logoutButton").addEventListener("click", async () => { try { await apiRequest("/api/auth/logout", {method:"POST",body:"{}"}); } finally { location.replace("/"); } });
applyLanguage();
loadDashboard();
