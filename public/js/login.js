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

    }

}


// Run immediately

setupPortalDesign();


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

        const email =
            emailInput.value.trim();


        const password =
            passwordInput.value;


        // ==========================================
        // VALIDATION
        // ==========================================

        if (!email) {


            showMessage(
                "Please enter your email address."
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
                                email: email,
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
// END OF LOGIN JAVASCRIPT
// ==========================================