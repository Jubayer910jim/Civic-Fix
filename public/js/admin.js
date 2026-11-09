/* ==========================================
   CIVIC FIX - ADMIN DASHBOARD JAVASCRIPT
   Connected to MySQL Database
========================================== */


/* ==========================================
   1. REPORT DATA
========================================== */

// Reports will now come from the MySQL database.

let reports = [];

let activities = [

    {
        title: "Admin dashboard initialized",
        description: "The admin workspace was opened.",
        time: "Just now"
    }

];

let selectedReportId = null;


/* ==========================================
   2. GET HTML ELEMENTS
========================================== */

const reportsTableBody = document.getElementById("reportsTableBody");

const recentReportsBody = document.getElementById("recentReportsBody");

const searchInput = document.getElementById("searchInput");

const statusFilter = document.getElementById("statusFilter");

const priorityFilter = document.getElementById("priorityFilter");

const emptyState = document.getElementById("emptyState");

const reportModal = document.getElementById("reportModal");

const closeModal = document.getElementById("closeModal");

const institutionSelect = document.getElementById("institutionSelect");


/* ==========================================
   3. HELPER FUNCTIONS
========================================== */

// Convert database status into dashboard status.

function formatStatus(status) {

    const statusMap = {

        submitted: "Pending Review",

        under_review: "Pending Review",

        forwarded: "Forwarded",

        in_progress: "In Progress",

        resolved: "Resolved",

        rejected: "Rejected",

        closed: "Closed",

        reopened: "Pending Review"

    };

    return statusMap[status] || status;

}


// Convert database priority into dashboard priority.

function formatPriority(priority) {

    if (!priority) {
        return "Medium";
    }

    return priority.charAt(0).toUpperCase() +
           priority.slice(1).toLowerCase();

}


// Format database date.

function formatDate(dateValue) {

    if (!dateValue) {
        return "Not available";
    }

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-BD", {

        day: "2-digit",

        month: "short",

        year: "numeric"

    });

}


// Convert confidence score into percentage.

function formatConfidence(score) {

    if (score === null || score === undefined) {
        return 0;
    }

    let value = Number(score);

    // If the database stores 0.95 instead of 95.

    if (value > 0 && value <= 1) {
        value = value * 100;
    }

    return Math.round(value);

}


// Prevent database text from being interpreted as HTML.

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, function (character) {

        const characters = {

            "&": "&amp;",

            "<": "&lt;",

            ">": "&gt;",

            '"': "&quot;",

            "'": "&#039;"

        };

        return characters[character];

    });

}


/* ==========================================
   4. CONVERT DATABASE REPORT
   INTO DASHBOARD REPORT
========================================== */

function convertDatabaseReport(databaseReport) {

    let flag = "None";


    if (Number(databaseReport.is_suspicious) === 1) {

        flag = "Suspicious";

    }

    else if (Number(databaseReport.is_possible_duplicate) === 1) {

        flag = "Possible Duplicate";

    }


    const priority = databaseReport.suggested_priority ||
                     databaseReport.priority;


    return {

        // Use the tracking code as the visible report ID.

        id: databaseReport.tracking_code ||
            databaseReport.report_id,


        databaseId: databaseReport.report_id,


        citizen: databaseReport.citizen_name ||
                 "Unknown Citizen",


        issue: databaseReport.title ||
               "Untitled Report",


        category: databaseReport.ai_suggested_category ||
                  databaseReport.category_name ||
                  "Uncategorized",


        priority: formatPriority(priority),


        flag: flag,


        confidence: formatConfidence(
            databaseReport.confidence_score
        ),


        status: formatStatus(databaseReport.status),


        location: databaseReport.location_address ||
                  "Location not provided",


        date: formatDate(databaseReport.created_at),


        description: databaseReport.description ||
                     "No description provided.",


        aiExplanation: databaseReport.ai_explanation ||
                       "AI analysis is not available yet.",


        institution: databaseReport.institution_name || "",


        latitude: databaseReport.latitude,


        longitude: databaseReport.longitude

    };

}


/* ==========================================
   5. LOAD REPORTS FROM MYSQL
========================================== */

async function loadReports() {

    try {

        const response = await fetch("/api/admin/reports");


        if (!response.ok) {

            throw new Error("Failed to retrieve reports.");

        }


        const data = await response.json();


        if (!data.success) {

            throw new Error(data.message);

        }


        // Convert database reports.

        reports = data.reports.map(function (report) {

            return convertDatabaseReport(report);

        });


        console.log("Reports loaded from MySQL:", reports);


        refreshDashboard();


    } catch (error) {

        console.error("Report loading error:", error);


        reports = [];


        refreshDashboard();


        if (emptyState) {

            emptyState.textContent =
                "Unable to load reports. Please check your database connection.";

            emptyState.hidden = false;

        }

    }

}


/* ==========================================
   6. UPDATE DASHBOARD STATISTICS
========================================== */

function updateStatistics() {

    const total = reports.length;


    const pending = reports.filter(function (report) {

        return report.status === "Pending Review";

    }).length;


    const forwarded = reports.filter(function (report) {

        return report.status === "Forwarded" ||
               report.status === "In Progress";

    }).length;


    const flagged = reports.filter(function (report) {

        return report.flag !== "None" &&
               report.status !== "Rejected";

    }).length;


    document.getElementById("totalReports").textContent = total;


    document.getElementById("pendingReports").textContent = pending;


    document.getElementById("forwardedReports").textContent = forwarded;


    document.getElementById("flaggedReports").textContent = flagged;


    document.getElementById("suspiciousCount").textContent = flagged;


    document.getElementById("aiPending").textContent =
        pending + " reports";


    document.getElementById("aiFlagged").textContent =
        flagged + " reports";

}


/* ==========================================
   7. PRIORITY BADGE
========================================== */

function getPriorityClass(priority) {

    if (priority === "High") {

        return "priority-high";

    }

    if (priority === "Medium") {

        return "priority-medium";

    }

    return "priority-low";

}


/* ==========================================
   8. STATUS BADGE
========================================== */

function getStatusClass(status) {

    if (status === "Forwarded" ||
        status === "In Progress" ||
        status === "Resolved" ||
        status === "Closed") {

        return "status-forwarded";

    }


    if (status === "Rejected") {

        return "status-rejected";

    }


    return "status-pending";

}


/* ==========================================
   9. RENDER ALL REPORTS
========================================== */

function renderReports() {

    const searchText = searchInput.value.toLowerCase();

    const selectedStatus = statusFilter.value;

    const selectedPriority = priorityFilter.value;


    const filteredReports = reports.filter(function (report) {

        const matchesSearch =

            report.id.toLowerCase().includes(searchText) ||

            report.issue.toLowerCase().includes(searchText) ||

            report.citizen.toLowerCase().includes(searchText);


        const matchesStatus =

            selectedStatus === "all" ||

            report.status === selectedStatus;


        const matchesPriority =

            selectedPriority === "all" ||

            report.priority === selectedPriority;


        return matchesSearch &&
               matchesStatus &&
               matchesPriority;

    });


    reportsTableBody.innerHTML = "";


    filteredReports.forEach(function (report) {

        const row = document.createElement("tr");


        const flagText = report.flag === "None"
            ? "—"
            : report.flag;


        row.innerHTML = `

            <td>
                <span class="report-id">
                    ${escapeHTML(report.id)}
                </span>
            </td>

            <td>${escapeHTML(report.citizen)}</td>

            <td>${escapeHTML(report.issue)}</td>

            <td>${escapeHTML(report.category)}</td>

            <td>
                <span class="priority ${getPriorityClass(report.priority)}">
                    ${escapeHTML(report.priority)}
                </span>
            </td>

            <td>${escapeHTML(flagText)}</td>

            <td>
                <span class="status ${getStatusClass(report.status)}">
                    ${escapeHTML(report.status)}
                </span>
            </td>

            <td>
                <button class="view-btn"
                        data-report-id="${escapeHTML(report.id)}">
                    View Details
                </button>
            </td>

        `;


        reportsTableBody.appendChild(row);

    });


    if (filteredReports.length === 0) {

        emptyState.hidden = false;

        emptyState.textContent = reports.length === 0
            ? "No reports have been submitted yet."
            : "No reports match your search.";

    }

    else {

        emptyState.hidden = true;

    }

}


/* ==========================================
   10. RENDER RECENT REPORTS
========================================== */

function renderRecentReports() {

    recentReportsBody.innerHTML = "";


    const recentReports = reports.slice(0, 5);


    recentReports.forEach(function (report) {

        const row = document.createElement("tr");


        row.innerHTML = `

            <td>
                <span class="report-id">
                    ${escapeHTML(report.id)}
                </span>
            </td>

            <td>${escapeHTML(report.issue)}</td>

            <td>
                <span class="priority ${getPriorityClass(report.priority)}">
                    ${escapeHTML(report.priority)}
                </span>
            </td>

            <td>
                <span class="status ${getStatusClass(report.status)}">
                    ${escapeHTML(report.status)}
                </span>
            </td>

            <td>
                <button class="view-btn"
                        data-report-id="${escapeHTML(report.id)}">
                    View
                </button>
            </td>

        `;


        recentReportsBody.appendChild(row);

    });

}


/* ==========================================
   11. OPEN REPORT DETAILS
========================================== */

function openReport(reportId) {

    const report = reports.find(function (item) {

        return String(item.id) === String(reportId);

    });


    if (!report) {
        return;
    }


    selectedReportId = reportId;


    document.getElementById("modalTitle").textContent =
        report.issue;


    document.getElementById("modalId").textContent =
        report.id;


    document.getElementById("modalCitizen").textContent =
        report.citizen;


    document.getElementById("modalLocation").textContent =
        report.location;


    document.getElementById("modalDate").textContent =
        report.date;


    document.getElementById("modalDescription").textContent =
        report.description;


    document.getElementById("modalCategory").textContent =
        report.category;


    document.getElementById("modalPriority").textContent =
        report.priority;


    document.getElementById("modalConfidence").textContent =
        report.confidence + "%";


    document.getElementById("modalFlag").textContent =
        report.flag;


    document.getElementById("modalAIExplanation").textContent =
        report.aiExplanation;


    institutionSelect.value = report.institution || "";


    // Forward and Reject are not connected to MySQL yet.

    const forwardButton = document.getElementById("forwardBtn");

    const rejectButton = document.getElementById("rejectBtn");


    forwardButton.disabled = true;

    rejectButton.disabled = true;


    forwardButton.textContent = "Forwarding not connected yet";

    rejectButton.textContent = "Rejection not connected yet";


    reportModal.classList.add("show");

}


/* ==========================================
   12. CLOSE REPORT MODAL
========================================== */

function closeReportModal() {

    reportModal.classList.remove("show");

    selectedReportId = null;

}


closeModal.addEventListener("click", closeReportModal);


reportModal.addEventListener("click", function (event) {

    if (event.target === reportModal) {

        closeReportModal();

    }

});


/* ==========================================
   13. FORWARD BUTTON
========================================== */

// Database forwarding will be implemented
// after the report-loading stage is tested.


document.getElementById("forwardBtn").addEventListener("click", function () {

    alert("Forwarding will be connected to the database in the next stage.");

});


/* ==========================================
   14. REJECT BUTTON
========================================== */

// Database rejection will be implemented
// after the report-loading stage is tested.


document.getElementById("rejectBtn").addEventListener("click", function () {

    alert("Report rejection will be connected to the database in the next stage.");

});


/* ==========================================
   15. SUSPICIOUS REPORTS
========================================== */

function renderSuspiciousReports() {

    const suspiciousList = document.getElementById("suspiciousList");


    suspiciousList.innerHTML = "";


    const suspiciousReports = reports.filter(function (report) {

        return report.flag !== "None" &&
               report.status !== "Rejected";

    });


    if (suspiciousReports.length === 0) {

        suspiciousList.innerHTML =
            "<p>No suspicious reports currently require review.</p>";

        return;

    }


    suspiciousReports.forEach(function (report) {

        const item = document.createElement("div");


        item.className = "suspicious-item";


        item.innerHTML = `

            <div>

                <h4>${escapeHTML(report.issue)}</h4>

                <p>
                    ${escapeHTML(report.id)} ·
                    ${escapeHTML(report.flag)} ·
                    ${escapeHTML(report.citizen)}
                </p>

            </div>

            <button data-report-id="${escapeHTML(report.id)}">
                Inspect Report
            </button>

        `;


        suspiciousList.appendChild(item);

    });

}


/* ==========================================
   16. ACTIVITY HISTORY
========================================== */

function renderActivities() {

    const activityList = document.getElementById("activityList");


    activityList.innerHTML = "";


    activities.forEach(function (activity) {

        const item = document.createElement("div");


        item.className = "activity-item";


        item.innerHTML = `

            <span class="activity-dot"></span>

            <div>

                <strong>${escapeHTML(activity.title)}</strong>

                <p>${escapeHTML(activity.description)}</p>

                <small>${escapeHTML(activity.time)}</small>

            </div>

        `;


        activityList.appendChild(item);

    });

}


/* ==========================================
   17. TABLE BUTTON INTERACTIONS
========================================== */

document.addEventListener("click", function (event) {

    const viewButton = event.target.closest("[data-report-id]");


    if (!viewButton) {
        return;
    }


    const reportId = viewButton.dataset.reportId;


    if (reportId) {

        openReport(reportId);

    }

});


/* ==========================================
   18. SEARCH AND FILTER
========================================== */

searchInput.addEventListener("input", renderReports);

statusFilter.addEventListener("change", renderReports);

priorityFilter.addEventListener("change", renderReports);


/* ==========================================
   19. SIDEBAR MOBILE MENU
========================================== */

const sidebar = document.getElementById("sidebar");


document.getElementById("menuToggle").addEventListener("click", function () {

    sidebar.classList.toggle("open");

});


document.querySelectorAll(".nav-link").forEach(function (link) {

    link.addEventListener("click", function () {

        document.querySelectorAll(".nav-link").forEach(function (item) {

            item.classList.remove("active");

        });


        link.classList.add("active");


        sidebar.classList.remove("open");

    });

});


/* ==========================================
   20. CURRENT DATE
========================================== */

document.getElementById("currentDate").textContent =

    new Date().toLocaleDateString("en-BD", {

        day: "numeric",

        month: "short",

        year: "numeric"

    });


/* ==========================================
   21. REFRESH DASHBOARD
========================================== */

function refreshDashboard() {

    updateStatistics();

    renderReports();

    renderRecentReports();

    renderSuspiciousReports();

    renderActivities();

}


/* ==========================================
   22. INITIALIZE ADMIN DASHBOARD
========================================== */

async function initializeDashboard() {

    await loadReports();

    console.log("Civic Fix Admin Dashboard connected.");

}


initializeDashboard();