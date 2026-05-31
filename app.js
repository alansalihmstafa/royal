const searchBar = document.getElementById("searchBar");
const appsGrid = document.getElementById("appsGrid");
const updatesBox = document.getElementById("updatesBox");
const contactForm = document.getElementById("contactForm");

const STORAGE_KEY = "royalApps";

let allApps = [];

function readLocalApps() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
        return null;
    }
}

// Loads the app list with graceful fallbacks so the site works on any host:
// 1. Optional Netlify function (shared, persistent storage)
// 2. Apps saved locally by the admin panel in this browser
// 3. The static apps.json bundled with the site
async function loadApps() {
    const local = readLocalApps();

    try {
        const response = await fetch("/api/apps");
        if (response.ok) {
            const data = await response.json();
            if (data && data.success && Array.isArray(data.apps)) {
                allApps = data.apps;
                renderApps(allApps);
                renderUpdates(allApps);
                return;
            }
        }
    } catch (error) {
        // No backend available, fall through to static sources.
    }

    if (local && local.length > 0) {
        allApps = local;
        renderApps(allApps);
        renderUpdates(allApps);
        return;
    }

    try {
        const response = await fetch("apps.json", { cache: "no-store" });
        const data = await response.json();
        allApps = (data && data.apps) || [];
    } catch (error) {
        allApps = [];
    }

    renderApps(allApps);
    renderUpdates(allApps);
}

function renderApps(apps) {
    appsGrid.innerHTML = "";

    if (!apps || apps.length === 0) {
        appsGrid.innerHTML = `
            <div class="empty-box">
                No apps published yet.
            </div>
        `;
        return;
    }

    apps.forEach(app => {
        const card = document.createElement("div");
        card.className = "app-card";

        const iconContent = app.image
            ? `<img src="${escapeHtml(app.image)}" alt="${escapeHtml(app.name)}" class="app-image">`
            : `<div class="app-icon">${escapeHtml(app.icon || "⚙")}</div>`;

        card.innerHTML = `
            ${iconContent}

            <h3>${escapeHtml(app.name)}</h3>

            <p>${escapeHtml(app.description)}</p>

            <div class="app-info">
                <span>Version: ${escapeHtml(app.version)}</span>
                <span>Setup: EXE</span>
            </div>

            <div class="release-notes">
                ${escapeHtml(app.releaseNotes || "No release notes.")}
            </div>

            <a
                class="download-btn"
                href="${escapeHtml(app.downloadUrl)}"
                target="_blank"
            >
                Download ${escapeHtml(app.name)}
            </a>
        `;

        appsGrid.appendChild(card);
    });
}

function renderUpdates(apps) {
    updatesBox.innerHTML = "";

    if (!apps || apps.length === 0) {
        updatesBox.innerHTML = `
            <div class="update-card">
                <h3>No updates yet</h3>
                <p>Published apps will appear here.</p>
            </div>
        `;
        return;
    }

    apps.slice().reverse().forEach(app => {
        const update = document.createElement("div");
        update.className = "update-card";

        update.innerHTML = `
            <h3>${escapeHtml(app.name)} v${escapeHtml(app.version)}</h3>
            <p>${escapeHtml(app.releaseNotes || "New release available.")}</p>
        `;

        updatesBox.appendChild(update);
    });
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

searchBar.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        const value = searchBar.value.trim().toLowerCase();

        if (value === "@admin") {
            window.location.href = "admin.html";
        }
    }
});

searchBar.addEventListener("input", function () {
    const value = searchBar.value.toLowerCase();

    const filtered = allApps.filter(app => {
        return (
            String(app.name).toLowerCase().includes(value) ||
            String(app.description).toLowerCase().includes(value) ||
            String(app.version).toLowerCase().includes(value)
        );
    });

    renderApps(filtered);
});

contactForm.addEventListener("submit", function (event) {
    event.preventDefault();
    alert("Message sent! This demo form does not store messages yet.");
    contactForm.reset();
});

loadApps();