const searchBar = document.getElementById("searchBar");
const appsGrid = document.getElementById("appsGrid");
const updatesBox = document.getElementById("updatesBox");
const contactForm = document.getElementById("contactForm");
const slidesEl = document.getElementById("slides");
const dotsEl = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const carouselEl = document.getElementById("carousel");

const STORAGE_KEY = "royalApps";
const SETTINGS_KEY = "royalSettings";

const DEFAULT_SETTINGS = {
    title: "Royal",
    tagline: "Premium desktop applications, tools, and software downloads.",
    accent: "#7c5cff",
    carouselInterval: 5,
    footer: "© 2026 Royal. All rights reserved."
};

let allApps = [];
let settings = Object.assign({}, DEFAULT_SETTINGS);
let slideIndex = 0;
let slideTimer = null;
let slideApps = [];

/* ---------- helpers ---------- */
function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function hexToRgb(hex) {
    const m = String(hex || "").replace("#", "");
    const full = m.length === 3 ? m.split("").map(c => c + c).join("") : m;
    const int = parseInt(full, 16);
    if (Number.isNaN(int) || full.length !== 6) return "124, 92, 255";
    return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

/* ---------- settings + theme ---------- */
function applySettings() {
    const root = document.documentElement.style;
    root.setProperty("--accent", settings.accent || DEFAULT_SETTINGS.accent);
    root.setProperty("--accent-rgb", hexToRgb(settings.accent));

    const logo = document.getElementById("siteLogo");
    if (logo) logo.textContent = (settings.title || "Royal").toUpperCase();
    document.title = settings.title || "Royal";

    const subtitle = document.getElementById("appsSubtitle");
    if (subtitle && settings.tagline) subtitle.textContent = settings.tagline;

    const footer = document.getElementById("footerText");
    if (footer) footer.textContent = settings.footer || DEFAULT_SETTINGS.footer;
}

async function loadSettings() {
    const local = readJson(SETTINGS_KEY);
    if (local && typeof local === "object") {
        settings = Object.assign({}, DEFAULT_SETTINGS, local);
    } else {
        try {
            const response = await fetch("settings.json", { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
            }
        } catch (error) {
            settings = Object.assign({}, DEFAULT_SETTINGS);
        }
    }
    applySettings();
}

/* ---------- data loading ---------- */
async function loadApps() {
    const local = readJson(STORAGE_KEY);

    try {
        const response = await fetch("/api/apps");
        if (response.ok) {
            const data = await response.json();
            if (data && data.success && Array.isArray(data.apps)) {
                allApps = data.apps;
                renderAll();
                return;
            }
        }
    } catch (error) {
        // No backend available, fall through to static sources.
    }

    if (Array.isArray(local) && local.length > 0) {
        allApps = local;
        renderAll();
        return;
    }

    try {
        const response = await fetch("apps.json", { cache: "no-store" });
        const data = await response.json();
        allApps = (data && data.apps) || [];
    } catch (error) {
        allApps = [];
    }

    renderAll();
}

function renderAll() {
    renderCarousel(allApps);
    renderApps(allApps);
    renderUpdates(allApps);
}

/* ---------- carousel ---------- */
function renderCarousel(apps) {
    const featured = apps.filter(a => a.featured);
    slideApps = featured.length > 0 ? featured : apps.slice(0, 5);

    if (!slideApps.length) {
        carouselEl.style.display = "none";
        return;
    }
    carouselEl.style.display = "";

    slidesEl.innerHTML = "";
    dotsEl.innerHTML = "";

    slideApps.forEach((app, i) => {
        const slide = document.createElement("div");
        slide.className = "slide" + (i === 0 ? " active" : "");

        const bgImg = app.banner || app.image;
        const bg = bgImg
            ? `<div class="slide-bg" style="background-image:url('${escapeHtml(bgImg)}')"></div>`
            : `<div class="slide-bg" style="background:radial-gradient(700px 400px at 75% 30%, rgba(var(--accent-rgb),0.5), transparent 60%), linear-gradient(135deg, #1a1a28, #0a0a0f)"></div>`;

        slide.innerHTML = `
            ${bg}
            <div class="slide-overlay"></div>
            <div class="slide-content">
                <span class="slide-chip"><span class="slide-emoji">${escapeHtml(app.icon || "★")}</span> Featured App</span>
                <h2>${escapeHtml(app.name)}</h2>
                <p>${escapeHtml(app.description)}</p>
                <div class="slide-meta">
                    <a class="btn-primary" href="${escapeHtml(app.downloadUrl)}" target="_blank">⬇ Download</a>
                    <span class="slide-version">Version ${escapeHtml(app.version)}</span>
                </div>
            </div>
        `;
        slidesEl.appendChild(slide);

        const dot = document.createElement("div");
        dot.className = "dot" + (i === 0 ? " active" : "");
        dot.addEventListener("click", () => goToSlide(i));
        dotsEl.appendChild(dot);
    });

    slideIndex = 0;
    const showArrows = slideApps.length > 1;
    prevBtn.style.display = showArrows ? "" : "none";
    nextBtn.style.display = showArrows ? "" : "none";
    dotsEl.style.display = showArrows ? "" : "none";

    startAutoplay();
}

function goToSlide(i) {
    const slides = slidesEl.querySelectorAll(".slide");
    const dots = dotsEl.querySelectorAll(".dot");
    if (!slides.length) return;
    slideIndex = (i + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle("active", idx === slideIndex));
    dots.forEach((d, idx) => d.classList.toggle("active", idx === slideIndex));
    startAutoplay();
}

function startAutoplay() {
    if (slideTimer) clearInterval(slideTimer);
    if (slideApps.length < 2) return;
    const seconds = Math.max(2, Number(settings.carouselInterval) || 5);
    slideTimer = setInterval(() => goToSlide(slideIndex + 1), seconds * 1000);
}

if (prevBtn) prevBtn.addEventListener("click", () => goToSlide(slideIndex - 1));
if (nextBtn) nextBtn.addEventListener("click", () => goToSlide(slideIndex + 1));
if (carouselEl) {
    carouselEl.addEventListener("mouseenter", () => { if (slideTimer) clearInterval(slideTimer); });
    carouselEl.addEventListener("mouseleave", startAutoplay);
}

/* ---------- app grid ---------- */
function renderApps(apps) {
    appsGrid.innerHTML = "";

    if (!apps || apps.length === 0) {
        appsGrid.innerHTML = `<div class="empty-box">No apps published yet.</div>`;
        return;
    }

    apps.forEach(app => {
        const card = document.createElement("div");
        card.className = "app-card";

        const icon = app.image
            ? `<img src="${escapeHtml(app.image)}" alt="${escapeHtml(app.name)}" class="app-image">`
            : `<div class="app-icon">${escapeHtml(app.icon || "★")}</div>`;

        card.innerHTML = `
            <div class="app-head">
                ${icon}
                <div>
                    <h3>${escapeHtml(app.name)}</h3>
                    <span class="ver">Version ${escapeHtml(app.version)}</span>
                </div>
            </div>
            <p class="desc">${escapeHtml(app.description)}</p>
            <div class="release-notes">${escapeHtml(app.releaseNotes || "No release notes.")}</div>
            <a class="download-btn" href="${escapeHtml(app.downloadUrl)}" target="_blank">⬇ Download</a>
        `;
        appsGrid.appendChild(card);
    });
}

function renderUpdates(apps) {
    updatesBox.innerHTML = "";

    if (!apps || apps.length === 0) {
        updatesBox.innerHTML = `<div class="update-card"><h3>No updates yet</h3><p>Published apps will appear here.</p></div>`;
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

/* ---------- search ---------- */
searchBar.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && searchBar.value.trim().toLowerCase() === "@admin") {
        window.location.href = "admin.html";
    }
});

searchBar.addEventListener("input", function () {
    const value = searchBar.value.toLowerCase();
    const filtered = allApps.filter(app =>
        String(app.name).toLowerCase().includes(value) ||
        String(app.description).toLowerCase().includes(value) ||
        String(app.version).toLowerCase().includes(value)
    );
    renderApps(filtered);
});

contactForm.addEventListener("submit", function (event) {
    event.preventDefault();
    alert("Message sent! This demo form does not store messages yet.");
    contactForm.reset();
});

/* ---------- init ---------- */
(async function init() {
    await loadSettings();
    await loadApps();
})();
