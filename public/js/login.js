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
    emailInput.placeholder = usePhone ? "1712345678" : "Enter your email address";
    emailInput.autocomplete = usePhone ? "tel-national" : "email";
    emailInput.inputMode = usePhone ? "numeric" : "email";
    identifierLabel.textContent = usePhone ? "Bangladesh Phone Number" : "Email Address";
    phonePrefix.hidden = !usePhone;
    emailTab.setAttribute("aria-pressed", String(!usePhone));
    phoneTab.setAttribute("aria-pressed", String(usePhone));
    emailInput.value = "";
    clearMessage();
}

emailTab.addEventListener("click", () => setLoginMethod("email"));
phoneTab.addEventListener("click", () => setLoginMethod("phone"));
setLoginMethod("email");


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
        showMessage("Google did not return a sign-in credential.");
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
            throw new Error(data.message || "Google sign-in failed.");
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
        showMessage(error.message || "Unable to sign in with Google. Please try again.");
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
        { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: 320 }
    );
}

initializeGoogleLogin();

loginOtpForm.addEventListener("submit", async event => {
    event.preventDefault();
    loginOtpMessage.textContent = "";
    loginOtpMessage.className = "login-message";

    const otp = loginOtpInput.value.trim();
    if (!/^[0-9]{6}$/.test(otp)) {
        showLoginOtpMessage("Enter the 6-digit code from your email.");
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
            throw new Error(data.message || "Could not verify the code.");
        }
        showLoginOtpMessage("Code verified. Redirecting...", "success");
        window.location.href = data.redirect || "/citizen.html";
    } catch (error) {
        showLoginOtpMessage(error.message || "Could not verify the code.");
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
            throw new Error(data.message || "Could not resend the code.");
        }
        showLoginOtpMessage(data.message || "A new code was sent.", "success");
    } catch (error) {
        showLoginOtpMessage(error.message || "Could not resend the code.");
    } finally {
        resendLoginOtpButton.disabled = false;
    }
});


// ==========================================
// END OF LOGIN JAVASCRIPT
// ==========================================
