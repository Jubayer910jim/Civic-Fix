// ==========================================
// CIVIC FIX - MAIN JAVASCRIPT
// Homepage
// Language Switching + Dark/Light Mode
// ==========================================


// ==========================================
// 1. GET HTML ELEMENTS
// ==========================================

const languageBtn = document.getElementById("languageBtn");
const themeBtn = document.getElementById("themeBtn");


// ==========================================
// 2. LANGUAGE SETTINGS
// ==========================================

// Load saved language or use English by default
let currentLanguage =
    localStorage.getItem("civicFixLanguage") || "en";


// ==========================================
// CHANGE LANGUAGE
// ==========================================

function changeLanguage(language) {

    currentLanguage = language;

    // Update HTML language
    document.documentElement.lang = currentLanguage;

    // Apply Bengali font class
    document.body.classList.toggle(
        "bengali",
        currentLanguage === "bn"
    );

    // Find all bilingual elements
    const elements = document.querySelectorAll(
        "[data-en][data-bn]"
    );

    // Change all text
    elements.forEach(function (element) {

        if (currentLanguage === "bn") {

            element.textContent =
                element.getAttribute("data-bn");

        } else {

            element.textContent =
                element.getAttribute("data-en");

        }

    });


    // Update language button
    if (languageBtn) {

        languageBtn.textContent =
            currentLanguage === "bn"
                ? "English"
                : "বাংলা";

    }


    // Save language
    localStorage.setItem(
        "civicFixLanguage",
        currentLanguage
    );


    // Update theme button text
    updateThemeButtonText();

}


// ==========================================
// LANGUAGE BUTTON CLICK
// ==========================================

if (languageBtn) {

    languageBtn.addEventListener("click", function () {

        if (currentLanguage === "en") {

            changeLanguage("bn");

        } else {

            changeLanguage("en");

        }

    });

}


// ==========================================
// 3. DARK / LIGHT MODE
// ==========================================


// Load saved theme
let currentTheme =
    localStorage.getItem("civicFixTheme") || "light";


// ==========================================
// UPDATE THEME BUTTON TEXT
// ==========================================

function updateThemeButtonText() {

    if (!themeBtn) return;

    const themeText =
        themeBtn.querySelector("span");

    if (!themeText) return;


    if (currentTheme === "dark") {

        if (currentLanguage === "bn") {

            themeText.textContent = "লাইট মোড";

        } else {

            themeText.textContent = "Light Mode";

        }

    } else {

        if (currentLanguage === "bn") {

            themeText.textContent = "ডার্ক মোড";

        } else {

            themeText.textContent = "Dark Mode";

        }

    }

}


// ==========================================
// APPLY THEME
// ==========================================

function applyTheme() {

    if (!themeBtn) return;


    if (currentTheme === "dark") {

        // Enable dark mode
        document.body.classList.add("dark-mode");

        themeBtn.innerHTML =
            "☀️ <span>Light Mode</span>";

    } else {

        // Enable light mode
        document.body.classList.remove("dark-mode");

        themeBtn.innerHTML =
            "🌙 <span>Dark Mode</span>";

    }


    // Apply correct language to theme button
    updateThemeButtonText();


    // Save theme
    localStorage.setItem(
        "civicFixTheme",
        currentTheme
    );

}


// ==========================================
// THEME BUTTON CLICK
// ==========================================

if (themeBtn) {

    themeBtn.addEventListener("click", function () {

        if (currentTheme === "light") {

            currentTheme = "dark";

        } else {

            currentTheme = "light";

        }


        applyTheme();

    });

}


// ==========================================
// 4. COMING SOON MESSAGE
// Institution and Authority
// ==========================================

function showComingSoon(event, portalName) {

    // Stop the link
    event.preventDefault();


    let message;


    if (currentLanguage === "bn") {

        if (portalName === "Institution") {

            message =
                "Institution Portal বর্তমানে তৈরি করা হচ্ছে।";

        } else if (portalName === "Authority") {

            message =
                "Authority Portal বর্তমানে তৈরি করা হচ্ছে।";

        } else {

            message =
                portalName +
                " পোর্টালটি বর্তমানে তৈরি করা হচ্ছে।";

        }

    } else {

        message =
            portalName +
            " Portal is currently under development.";

    }


    alert(message);

}


// ==========================================
// 5. DISPLAY CURRENT YEAR
// ==========================================

const yearElement =
    document.getElementById("year");


if (yearElement) {

    yearElement.textContent =
        new Date().getFullYear();

}


// ==========================================
// 6. SMOOTH SCROLL
// ==========================================

document.querySelectorAll('a[href^="#"]')
    .forEach(function (link) {

        link.addEventListener(
            "click",
            function (event) {

                const targetId =
                    link.getAttribute("href");


                // Ignore just "#"
                if (
                    !targetId ||
                    targetId === "#"
                ) {
                    return;
                }


                const target =
                    document.querySelector(targetId);


                if (target) {

                    event.preventDefault();

                    target.scrollIntoView({

                        behavior: "smooth",
                        block: "start"

                    });

                }

            }
        );

    });


// ==========================================
// 7. INITIALIZE WEBSITE
// ==========================================

// Load saved language
changeLanguage(currentLanguage);

// Load saved theme
applyTheme();


// ==========================================
// END OF CIVIC FIX MAIN JAVASCRIPT
// ==========================================