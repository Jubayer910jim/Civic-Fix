
// ==============================
// CIVIC FIX - MAIN JAVASCRIPT
// ==============================


// ==============================
// 1. ENGLISH / BANGLA LANGUAGE MODE
// ==============================

const languageToggle = document.getElementById("languageToggle");

let currentLanguage =
    localStorage.getItem("civicFixLanguage") || "en";

function changeLanguage(language) {

    currentLanguage = language;

    document.documentElement.lang = language;

    // Translate normal text
    document.querySelectorAll("[data-en][data-bn]").forEach(element => {

        element.textContent =
            language === "bn"
                ? element.dataset.bn
                : element.dataset.en;

    });

    // Translate HTML content
    document.querySelectorAll("[data-en-html][data-bn-html]").forEach(element => {

        element.innerHTML =
            language === "bn"
                ? element.dataset.bnHtml
                : element.dataset.enHtml;

    });

    // Translate placeholders
    document.querySelectorAll(
        "[data-en-placeholder][data-bn-placeholder]"
    ).forEach(element => {

        element.placeholder =
            language === "bn"
                ? element.dataset.bnPlaceholder
                : element.dataset.enPlaceholder;

    });

    // Update language button
    if (languageToggle) {

        languageToggle.textContent =
            language === "en" ? "বাংলা" : "English";

    }

    localStorage.setItem("civicFixLanguage", language);

}


// Language button event
if (languageToggle) {

    languageToggle.addEventListener("click", () => {

        changeLanguage(
            currentLanguage === "en" ? "bn" : "en"
        );

    });

}


// Load saved language
changeLanguage(currentLanguage);


// ==============================
// 2. LIGHT / DARK MODE
// ==============================

// Support both possible button IDs
const themeButton =
    document.getElementById("themeToggle") ||
    document.getElementById("themeBtn");

let currentTheme =
    localStorage.getItem("civicFixTheme") || "light";


function updateThemeButton() {

    if (!themeButton) return;

    const icon = currentTheme === "dark" ? "☀️" : "🌙";

    const label = currentTheme === "dark"
        ? (currentLanguage === "bn" ? "লাইট মোড" : "Light mode")
        : (currentLanguage === "bn" ? "ডার্ক মোড" : "Dark mode");

    // Update button icon and label
    const labelElement = themeButton.querySelector("span");

    if (labelElement) {

        themeButton.firstChild.textContent = icon + " ";
        labelElement.textContent = label;

    } else {

        themeButton.textContent = icon;

    }

    themeButton.setAttribute(
        "aria-label",
        currentTheme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"
    );

}


function applyTheme() {

    document.body.classList.toggle(
        "dark-mode",
        currentTheme === "dark"
    );

    localStorage.setItem("civicFixTheme", currentTheme);

    updateThemeButton();

}


// Theme button click
if (themeButton) {

    themeButton.addEventListener("click", () => {

        currentTheme =
            currentTheme === "light" ? "dark" : "light";

        applyTheme();

    });

}


// Load saved theme
applyTheme();


// ==============================
// 3. SCROLL REVEAL ANIMATIONS
// ==============================

function initializeRevealAnimations() {

    const revealElements =
        document.querySelectorAll(".reveal");

    // Browser compatibility fallback
    if (!("IntersectionObserver" in window)) {

        revealElements.forEach(element => {
            element.classList.add("visible");
        });

        return;
    }

    const revealObserver = new IntersectionObserver(

        (entries, observer) => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("visible");

                    observer.unobserve(entry.target);

                }

            });

        },

        {
            threshold: 0.10,
            rootMargin: "0px 0px 40px 0px"
        }

    );

    revealElements.forEach(element => {

        revealObserver.observe(element);

    });

}


// Initialize scroll animations
if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeRevealAnimations
    );

} else {

    initializeRevealAnimations();

}

// ==============================
// FAQ ACCORDION
// ==============================

document.querySelectorAll(".faq-question").forEach(button => {

    button.addEventListener("click", function () {

        const faqItem = this.closest(".faq-item");

        if (!faqItem) return;

        const isOpen = faqItem.classList.contains("active");

        // Toggle the FAQ item
        faqItem.classList.toggle("active");

        // Update accessibility state
        this.setAttribute("aria-expanded", String(!isOpen));

    });

});
