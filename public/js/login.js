// ==========================================
// CIVIC FIX - LOGIN JAVASCRIPT
// Citizen + Admin Login
// ==========================================


// ==========================================
// 1. GET HTML ELEMENTS
// ==========================================

const loginForm =
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

let loginMethod = "email";
let currentLanguage = localStorage.getItem("civicFixLanguage") === "bn" ? "bn" : "en";
const loginTranslations = {
    en: {
        back: "← Back to homepage", email: "Email Address", phone: "Bangladesh Phone Number",
        emailPlaceholder: "Enter your email address", password: "Password", passwordPlaceholder: "Enter your password",
        showPassword: "Show password", hidePassword: "Hide password", emailTab: "Email", phoneTab: "Phone",
        signInMethod: "Sign-in method", divider: "OR SIGN IN WITH EMAIL OR PHONE", secure: "Secure access to your account",
        track: "Track and manage community issues", updates: "Stay updated with Civic Fix", footer: "Building better communities together.",
        noteTitle: "Civic Fix Authentication", note: "Use your registered email or phone number and password to access your assigned portal.",
        newHere: "New to Civic Fix?", create: "Create an account", otpTitle: "Verify your sign-in", otpLead: "We sent a 6-digit verification code to",
        otpLabel: "Verification code", otpPlaceholder: "Enter 6-digit code", verify: "Verify and continue", resend: "Resend code",
        citizenTitle: "Your Community. Your Voice.", citizenDesc: "Report community problems, track your complaints, and stay updated about their progress.",
        adminTitle: "Manage Issues. Create Solutions.", adminDesc: "Review community reports, verify AI suggestions, and manage the issue resolution process.",
        citizenLogin: "Citizen Login", adminLogin: "Admin Login", citizenSubtitle: "Sign in to access your Citizen Portal.",
        adminSubtitle: "Sign in to access the Civic Fix Admin Dashboard.", citizenTag: "CITIZEN PORTAL", adminTag: "ADMIN PORTAL",
        loginCitizen: "Login as Citizen", loginAdmin: "Login as Admin", signIn: "Signing in...", loggedIn: "Login successful! Redirecting...",
        enterPhone: "Please enter your phone number.", enterEmail: "Please enter your email address.", enterPassword: "Please enter your password.",
        loginFailed: "Login failed. Check your details and try again.", googleCredential: "Google did not return a sign-in credential.", googleFailed: "Google sign-in failed.",
        otpInvalid: "Enter the 6-digit code from your email.", otpVerify: "Could not verify the code.", otpVerified: "Code verified. Redirecting...", otpResend: "Could not resend the code.",
        language: "বাংলা"
    },
    bn: {
        back: "← হোমপেজে ফিরে যান", email: "ইমেইল ঠিকানা", phone: "বাংলাদেশের ফোন নম্বর",
        emailPlaceholder: "আপনার ইমেইল ঠিকানা লিখুন", password: "পাসওয়ার্ড", passwordPlaceholder: "আপনার পাসওয়ার্ড লিখুন",
        showPassword: "পাসওয়ার্ড দেখান", hidePassword: "পাসওয়ার্ড লুকান", emailTab: "ইমেইল", phoneTab: "ফোন",
        signInMethod: "লগইনের পদ্ধতি", divider: "অথবা ইমেইল/ফোন দিয়ে লগইন করুন", secure: "আপনার অ্যাকাউন্টে নিরাপদ প্রবেশাধিকার",
        track: "কমিউনিটির সমস্যাগুলো দেখুন ও পরিচালনা করুন", updates: "Civic Fix-এর সর্বশেষ তথ্য জানুন", footer: "একসাথে গড়ি উন্নত কমিউনিটি।",
        noteTitle: "Civic Fix অ্যাকাউন্ট যাচাই", note: "আপনার নির্ধারিত পোর্টালে প্রবেশ করতে নিবন্ধিত ইমেইল বা ফোন নম্বর এবং পাসওয়ার্ড ব্যবহার করুন।",
        newHere: "Civic Fix-এ নতুন?", create: "অ্যাকাউন্ট তৈরি করুন", otpTitle: "লগইন যাচাই করুন", otpLead: "৬ সংখ্যার যাচাইকরণ কোড পাঠানো হয়েছে",
        otpLabel: "যাচাইকরণ কোড", otpPlaceholder: "৬ সংখ্যার কোড লিখুন", verify: "যাচাই করে চালিয়ে যান", resend: "কোড আবার পাঠান",
        citizenTitle: "আপনার কমিউনিটি। আপনার কণ্ঠস্বর।", citizenDesc: "কমিউনিটির সমস্যা জানান, অভিযোগের অগ্রগতি দেখুন এবং সর্বশেষ তথ্য জানুন।",
        adminTitle: "সমস্যা পরিচালনা করুন। সমাধান তৈরি করুন।", adminDesc: "কমিউনিটির প্রতিবেদন পর্যালোচনা, AI পরামর্শ যাচাই এবং সমস্যা সমাধানের প্রক্রিয়া পরিচালনা করুন।",
        citizenLogin: "নাগরিক লগইন", adminLogin: "অ্যাডমিন লগইন", citizenSubtitle: "আপনার নাগরিক পোর্টালে প্রবেশ করুন।",
        adminSubtitle: "Civic Fix অ্যাডমিন ড্যাশবোর্ডে প্রবেশ করুন।", citizenTag: "নাগরিক পোর্টাল", adminTag: "অ্যাডমিন পোর্টাল",
        loginCitizen: "নাগরিক হিসেবে লগইন", loginAdmin: "অ্যাডমিন হিসেবে লগইন", signIn: "লগইন হচ্ছে...", loggedIn: "লগইন সফল! পৃষ্ঠায় নেওয়া হচ্ছে...",
        enterPhone: "আপনার ফোন নম্বর লিখুন।", enterEmail: "আপনার ইমেইল ঠিকানা লিখুন।", enterPassword: "আপনার পাসওয়ার্ড লিখুন।",
        loginFailed: "লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করে আবার চেষ্টা করুন।", googleCredential: "Google থেকে লগইন তথ্য পাওয়া যায়নি।", googleFailed: "Google দিয়ে লগইন ব্যর্থ হয়েছে।",
        otpInvalid: "ইমেইলে পাওয়া ৬ সংখ্যার কোডটি লিখুন।", otpVerify: "কোড যাচাই করা যায়নি।", otpVerified: "কোড যাচাই হয়েছে। পৃষ্ঠায় নেওয়া হচ্ছে...", otpResend: "কোড আবার পাঠানো যায়নি।",
        language: "English"
    }
};
const t = key => loginTranslations[currentLanguage][key] || loginTranslations.en[key] || key;
const emailTab = document.getElementById("loginEmailTab");
const phoneTab = document.getElementById("loginPhoneTab");
const identifierLabel = document.getElementById("identifierLabel");
const phonePrefix = document.getElementById("phonePrefix");
const methodToggle = document.getElementById("loginMethodToggle");
const googleLoginSection = document.getElementById("googleLoginSection");
const googleLoginButton = document.getElementById("googleLoginButton");
const loginOtpView = document.getElementById("loginOtpView");
const loginOtpForm = document.getElementById("loginOtpForm");
const loginOtpInput = document.getElementById("loginOtp");
const loginOtpMessage = document.getElementById("loginOtpMessage");
const loginOtpDestination = document.getElementById("loginOtpDestination");
const verifyLoginOtpButton = document.getElementById("verifyLoginOtpButton");
const resendLoginOtpButton = document.getElementById("resendLoginOtpButton");

const passwordInput =
    document.getElementById("password");

const togglePassword =
    document.getElementById("togglePassword");

const loginButton =
    document.getElementById("loginButton");

const loginButtonText =
    document.getElementById("loginButtonText");

const loginMessage =
    document.getElementById("loginMessage");

const loginTitle =
    document.getElementById("loginTitle");

const loginSubtitle =
    document.getElementById("loginSubtitle");

const loginPortalIcon =
    document.getElementById("loginPortalIcon");

const portalTag =
    document.getElementById("portalTag");

const portalTitle =
    document.getElementById("portalTitle");

const portalDescription =
    document.getElementById("portalDescription");


// ==========================================
// 2. GET ROLE FROM URL
// ==========================================

// Example:
// login.html?role=citizen
// login.html?role=admin

const urlParameters =
    new URLSearchParams(window.location.search);


let selectedRole =
    urlParameters.get("role");


// Only allow current supported roles

if (
    selectedRole !== "citizen" &&
    selectedRole !== "admin"
) {

    // Default role
    selectedRole = "citizen";

}


// ==========================================
// 3. UPDATE PAGE FOR ROLE
// ==========================================

function setupPortalDesign() {


    // ==========================================
    // CITIZEN LOGIN
    // ==========================================

    if (selectedRole === "citizen") {


        document.title =
            "Citizen Login | Civic Fix";


        loginPortalIcon.textContent =
            "👤";


        loginTitle.textContent =
            "Citizen Login";


        loginSubtitle.textContent =
            "Sign in to access your Citizen Portal.";


        portalTag.textContent =
            "CITIZEN PORTAL";


        portalTitle.textContent =
            "Your Community. Your Voice.";


        portalDescription.textContent =
            "Report community problems, track your complaints, and stay updated about their progress.";


        loginButtonText.textContent =
            "Login as Citizen";
        methodToggle.hidden = false;
        googleLoginSection.hidden = false;

    }


    // ==========================================
    // ADMIN LOGIN
    // ==========================================

    else if (selectedRole === "admin") {


        document.title =
            "Admin Login | Civic Fix";


        loginPortalIcon.textContent =
            "🛡️";


        loginTitle.textContent =
            "Admin Login";


        loginSubtitle.textContent =
            "Sign in to access the Civic Fix Admin Dashboard.";


        portalTag.textContent =
            "ADMIN PORTAL";


        portalTitle.textContent =
            "Manage Issues. Create Solutions.";


        portalDescription.textContent =
            "Review community reports, verify AI suggestions, and manage the issue resolution process.";


        loginButtonText.textContent =
            "Login as Admin";
        methodToggle.hidden = true;
        googleLoginSection.hidden = true;

    }

}


// Run immediately

setupPortalDesign();

function setLoginMethod(method) {
    loginMethod = method;
    const usePhone = method === "phone";

    emailInput.type = usePhone ? "tel" : "email";
    emailInput.name = usePhone ? "phone" : "email";
    emailInput.placeholder = usePhone ? "1712345678" : t("emailPlaceholder");
    emailInput.autocomplete = usePhone ? "tel-national" : "email";
    emailInput.inputMode = usePhone ? "numeric" : "email";
    identifierLabel.textContent = usePhone ? t("phone") : t("email");
    phonePrefix.hidden = !usePhone;
    emailTab.setAttribute("aria-pressed", String(!usePhone));
    phoneTab.setAttribute("aria-pressed", String(usePhone));
    emailInput.value = "";
    clearMessage();
}

emailTab.addEventListener("click", () => setLoginMethod("email"));
phoneTab.addEventListener("click", () => setLoginMethod("phone"));
setLoginMethod("email");

function applyLoginLanguage() {
    document.documentElement.lang = currentLanguage;
    document.title = currentLanguage === "bn" ? "লগইন | Civic Fix" : (selectedRole === "admin" ? "Admin Login | Civic Fix" : "Citizen Login | Civic Fix");
    document.querySelector(".back-link").textContent = t("back");
    document.querySelector(".feature-list .feature-item:nth-child(1) span:last-child").textContent = t("secure");
    document.querySelector(".feature-list .feature-item:nth-child(2) span:last-child").textContent = t("track");
    document.querySelector(".feature-list .feature-item:nth-child(3) span:last-child").textContent = t("updates");
    document.querySelector(".info-footer").textContent = t("footer");
    document.querySelector(".login-auth-divider span").textContent = t("divider");
    emailTab.textContent = t("emailTab"); phoneTab.textContent = t("phoneTab");
    methodToggle.setAttribute("aria-label", t("signInMethod"));
    document.querySelector('label[for="password"]').textContent = t("password");
    passwordInput.placeholder = t("passwordPlaceholder");
    togglePassword.setAttribute("aria-label", passwordInput.type === "password" ? t("showPassword") : t("hidePassword"));
    document.getElementById("loginOtpTitle").textContent = t("otpTitle");
    const otpLead = document.querySelector("#loginOtpView > p");
    otpLead.replaceChildren(document.createTextNode(`${t("otpLead")} `), loginOtpDestination, document.createTextNode("."));
    document.querySelector('label[for="loginOtp"]').textContent = t("otpLabel");
    loginOtpInput.placeholder = t("otpPlaceholder");
    verifyLoginOtpButton.textContent = t("verify"); resendLoginOtpButton.textContent = t("resend");
    document.querySelector(".login-note strong").textContent = t("noteTitle");
    document.querySelector(".login-note p").textContent = t("note");
    const prompt = document.querySelector(".login-register-prompt");
    prompt.firstChild.textContent = `${t("newHere")} `;
    prompt.querySelector("a").textContent = t("create");
    portalTag.textContent = selectedRole === "admin" ? t("adminTag") : t("citizenTag");
    portalTitle.textContent = selectedRole === "admin" ? t("adminTitle") : t("citizenTitle");
    portalDescription.textContent = selectedRole === "admin" ? t("adminDesc") : t("citizenDesc");
    loginTitle.textContent = selectedRole === "admin" ? t("adminLogin") : t("citizenLogin");
    loginSubtitle.textContent = selectedRole === "admin" ? t("adminSubtitle") : t("citizenSubtitle");
    loginButtonText.textContent = selectedRole === "admin" ? t("loginAdmin") : t("loginCitizen");
    document.getElementById("languageToggle").textContent = t("language");
    document.getElementById("languageToggle").setAttribute("aria-label", currentLanguage === "en" ? "Switch language to Bangla" : "Switch language to English");
    setLoginMethod(loginMethod);
    if (window.google && window.google.accounts && window.google.accounts.id && selectedRole === "citizen") {
        googleLoginButton.replaceChildren();
        window.google.accounts.id.renderButton(googleLoginButton, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: 320, locale: currentLanguage });
    }
}

document.getElementById("languageToggle").addEventListener("click", () => {
    currentLanguage = currentLanguage === "en" ? "bn" : "en";
    localStorage.setItem("civicFixLanguage", currentLanguage);
    applyLoginLanguage();
});
applyLoginLanguage();


// ==========================================
// 4. SHOW / HIDE PASSWORD
// ==========================================

togglePassword.addEventListener(
    "click",
    function () {


        if (
            passwordInput.type === "password"
        ) {


            passwordInput.type = "text";


            togglePassword.textContent =
                "🙈";


            togglePassword.setAttribute(
                "aria-label",
                "Hide password"
            );

        }


        else {


            passwordInput.type = "password";


            togglePassword.textContent =
                "👁";


            togglePassword.setAttribute(
                "aria-label",
                "Show password"
            );

        }


    }
);


// ==========================================
// 5. SHOW LOGIN MESSAGE
// ==========================================

function showMessage(
    message,
    type = "error"
) {


    loginMessage.textContent =
        message;


    loginMessage.className =
        "login-message show " + type;

}


// ==========================================
// 6. CLEAR MESSAGE
// ==========================================

function clearMessage() {


    loginMessage.textContent =
        "";


    loginMessage.className =
        "login-message";

}


// ==========================================
// 7. LOGIN FORM
// ==========================================

loginForm.addEventListener(
    "submit",
    async function (event) {


        // Stop normal form submission

        event.preventDefault();


        // Clear previous message

        clearMessage();


        // Get values

        const identifier =
            emailInput.value.trim();


        const password =
            passwordInput.value;


        // ==========================================
        // VALIDATION
        // ==========================================

        if (!identifier) {


            showMessage(
                loginMethod === "phone" ? "Please enter your phone number." : "Please enter your email address."
            );


            emailInput.focus();

            return;

        }


        if (!password) {


            showMessage(
                "Please enter your password."
            );


            passwordInput.focus();

            return;

        }


        // ==========================================
        // DISABLE BUTTON
        // ==========================================

        const originalButtonText =
            loginButtonText.textContent;


        loginButton.disabled = true;


        loginButtonText.textContent =
            "Signing in...";


        try {


            // ==========================================
            // SEND LOGIN REQUEST
            // ==========================================

            const response =
                await fetch(
                    "/api/auth/login",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                ...(loginMethod === "phone" ? { phone: identifier, method: "phone" } : { email: identifier, method: "email" }),
                                password: password,
                                role: selectedRole
                            })

                    }
                );


            // ==========================================
            // GET RESPONSE
            // ==========================================

            const data =
                await response.json();


            // ==========================================
            // LOGIN FAILED
            // ==========================================

            if (
                !response.ok ||
                !data.success
            ) {


                throw new Error(
                    data.message ||
                    "Login failed."
                );

            }


            // ==========================================
            // LOGIN SUCCESS
            // ==========================================

            showMessage(
                "Login successful! Redirecting...",
                "success"
            );


            // ==========================================
            // REDIRECT CITIZEN
            // ==========================================

            if (
                data.user.role === "citizen"
            ) {


                window.setTimeout(
                    function () {


                        window.location.href =
                            "/citizen.html";


                    },
                    600
                );

            }


            // ==========================================
            // REDIRECT ADMIN
            // ==========================================

            else if (
                data.user.role === "admin"
            ) {


                window.setTimeout(
                    function () {


                        window.location.href =
                            "/admin.html";


                    },
                    600
                );

            }


        }


        // ==========================================
        // ERROR
        // ==========================================

        catch (error) {


            console.error(
                "Login error:",
                error
            );


            showMessage(
                error.message ||
                "Unable to login. Please try again."
            );

        }


        // ==========================================
        // ENABLE BUTTON
        // ==========================================

        finally {


            loginButton.disabled =
                false;


            loginButtonText.textContent =
                originalButtonText;

        }


    }
);

// ==========================================
// GOOGLE SIGN-IN WITH EMAIL OTP
// ==========================================

const GOOGLE_CLIENT_ID = "739688046500-notkt1q3m2ptdaq7eej1kebkj3g7mqbl.apps.googleusercontent.com";

function showLoginOtpMessage(message, type = "error") {
    loginOtpMessage.textContent = message;
    loginOtpMessage.className = "login-message show " + type;
}

async function handleGoogleLoginCredential(response) {
    clearMessage();
    if (!response || !response.credential) {
        showMessage(t("googleCredential"));
        return;
    }

    googleLoginButton.style.pointerEvents = "none";
    try {
        const result = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await result.json();
        if (!result.ok || !data.success) {
            throw new Error(currentLanguage === "bn" ? t("googleFailed") : (data.message || t("googleFailed")));
        }

        if (data.otpRequired) {
            loginOtpDestination.textContent = data.destination || "your Google account email";
            loginForm.hidden = true;
            googleLoginSection.hidden = true;
            loginOtpView.hidden = false;
            loginOtpInput.focus();
            showLoginOtpMessage(data.message || "Enter the verification code sent to your email.", "success");
            return;
        }

        window.location.href = data.redirect || "/citizen.html";
    } catch (error) {
        showMessage(currentLanguage === "bn" ? t("googleFailed") : (error.message || t("googleFailed")));
        googleLoginButton.style.pointerEvents = "";
    }
}

function initializeGoogleLogin() {
    if (selectedRole !== "citizen") return;
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        window.setTimeout(initializeGoogleLogin, 150);
        return;
    }

    window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleLoginCredential
    });
    window.google.accounts.id.renderButton(
        googleLoginButton,
        { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: 320, locale: currentLanguage }
    );
}

initializeGoogleLogin();

loginOtpForm.addEventListener("submit", async event => {
    event.preventDefault();
    loginOtpMessage.textContent = "";
    loginOtpMessage.className = "login-message";

    const otp = loginOtpInput.value.trim();
    if (!/^[0-9]{6}$/.test(otp)) {
        showLoginOtpMessage(t("otpInvalid"));
        loginOtpInput.focus();
        return;
    }

    verifyLoginOtpButton.disabled = true;
    try {
        const result = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ otp, method: "email" })
        });
        const data = await result.json();
        if (!result.ok || !data.success) {
            throw new Error(currentLanguage === "bn" ? t("otpVerify") : (data.message || t("otpVerify")));
        }
        showLoginOtpMessage(t("otpVerified"), "success");
        window.location.href = data.redirect || "/citizen.html";
    } catch (error) {
        showLoginOtpMessage(currentLanguage === "bn" ? t("otpVerify") : (error.message || t("otpVerify")));
    } finally {
        verifyLoginOtpButton.disabled = false;
    }
});

resendLoginOtpButton.addEventListener("click", async () => {
    resendLoginOtpButton.disabled = true;
    try {
        const result = await fetch("/api/auth/resend-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ method: "email" })
        });
        const data = await result.json();
        if (!result.ok || !data.success) {
            throw new Error(currentLanguage === "bn" ? t("otpResend") : (data.message || t("otpResend")));
        }
        showLoginOtpMessage(data.message || "A new code was sent.", "success");
    } catch (error) {
        showLoginOtpMessage(currentLanguage === "bn" ? t("otpResend") : (error.message || t("otpResend")));
    } finally {
        resendLoginOtpButton.disabled = false;
    }
});


// ==========================================
// END OF LOGIN JAVASCRIPT
// ==========================================
