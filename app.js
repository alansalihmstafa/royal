const searchBar = document.getElementById("searchBar");
const appsGrid = document.getElementById("appsGrid");
const updatesBox = document.getElementById("updatesBox");
const slidesEl = document.getElementById("slides");
const dotsEl = document.getElementById("dots");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const carouselEl = document.getElementById("carousel");

const heroEl = document.querySelector(".hero");
const appsSection = document.getElementById("apps");
const updatesSection = document.getElementById("updates");
const contactSection = document.getElementById("contact");
const detailSection = document.getElementById("appDetail");
const detailBody = document.getElementById("detailBody");
const backBtn = document.getElementById("backBtn");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");
const discordBtn = document.getElementById("discordBtn");

const STORAGE_KEY = "royalApps";
const SETTINGS_KEY = "royalSettings";

const DEFAULT_SETTINGS = {
    title: "Royal",
    tagline: "Premium desktop applications, tools, and software downloads.",
    accent: "#7c5cff",
    carouselInterval: 5,
    footer: "© 2026 Royal. All rights reserved.",
    discord: "https://discord.gg/QpmxAKQrD"
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

    if (discordBtn) discordBtn.href = settings.discord || DEFAULT_SETTINGS.discord;
}

async function loadSettings() {
    try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (response.ok) {
            const data = await response.json();
            if (data && data.success && data.settings) {
                settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
                applySettings();
                return;
            }
        }
    } catch (error) {
        // No backend settings available, fall through to local/static sources.
    }

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
/* ---------- carousel (full-bleed sliding track) ---------- */
function renderCarousel(apps) {
    const featured = apps.filter(a => a.featured);
    slideApps = featured.length > 0 ? featured : apps.slice(0, 5);
    if (!slideApps.length) {
        if (heroEl) heroEl.style.display = "none";
        return;
    }
    if (heroEl) heroEl.style.display = "";

    slidesEl.innerHTML = "";
    dotsEl.innerHTML = "";

    slideApps.forEach((app, i) => {
        const slide = document.createElement("div");
        slide.className = "slide";

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
                    <a class="download-btn" href="${escapeHtml(app.downloadUrl)}">⬇ Download</a>
                    <button class="btn-ghost" type="button" data-detail="${escapeHtml(app.id || app.name)}">View details</button>
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

    slidesEl.querySelectorAll("[data-detail]").forEach(btn => {
        btn.addEventListener("click", () => openDetail(btn.getAttribute("data-detail")));
    });

    slideIndex = 0;
    updateTrack();

    const showArrows = slideApps.length > 1;
    prevBtn.style.display = showArrows ? "" : "none";
    nextBtn.style.display = showArrows ? "" : "none";
    dotsEl.style.display = showArrows ? "" : "none";

    startAutoplay();
}
function updateTrack() {
    slidesEl.style.transform = `translateX(-${slideIndex * 100}%)`;
    dotsEl.querySelectorAll(".dot").forEach((d, idx) => d.classList.toggle("active", idx === slideIndex));
}

function goToSlide(i) {
    if (!slideApps.length) return;
    slideIndex = (i + slideApps.length) % slideApps.length;
    updateTrack();
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
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        const icon = app.image
            ? `<img src="${escapeHtml(app.image)}" alt="${escapeHtml(app.name)}" class="app-image">`
            : `<div class="app-icon">${escapeHtml(app.icon || "★")}</div>`;

        const shotCount = Array.isArray(app.screenshots) ? app.screenshots.length : 0;
        const extras = [];
        if (app.trailer) extras.push("▶ Trailer");
        if (shotCount) extras.push(`${shotCount} screenshot${shotCount > 1 ? "s" : ""}`);
        const extrasHtml = extras.length ? `<div class="card-extras">${extras.map(e => `<span>${escapeHtml(e)}</span>`).join("")}</div>` : "";
        card.innerHTML = `
            <div class="app-head">
                ${icon}
                <div>
                    <h3>${escapeHtml(app.name)}</h3>
                    <span class="ver">Version ${escapeHtml(app.version)}</span>
                </div>
            </div>
            <p class="desc">${escapeHtml(app.description)}</p>
            ${extrasHtml}
            <div class="card-actions">
                <span class="details-link">View details →</span>
                <a class="download-btn" href="${escapeHtml(app.downloadUrl)}">⬇ Download</a>
            </div>
        `;
        card.addEventListener("click", function (event) {
            if (event.target.closest("a")) return;
            openDetail(app.id || app.name);
        });
        card.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDetail(app.id || app.name);
            }
        });
        appsGrid.appendChild(card);
    });
}
/* ---------- app detail section ---------- */
function videoEmbed(url) {
    const clean = String(url || "").trim();
    if (!clean) return "";
    const yt = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    if (yt) {
        return `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${yt[1]}" title="Trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    const vimeo = clean.match(/vimeo\.com\/(\d+)/);
    if (vimeo) {
        return `<div class="video-wrap"><iframe src="https://player.vimeo.com/video/${vimeo[1]}" title="Trailer" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if (clean.startsWith("data:video") || /\.(mp4|webm|ogg)(\?.*)?$/i.test(clean)) {
        return `<div class="video-wrap"><video src="${escapeHtml(clean)}" controls playsinline></video></div>`;
    }
    return `<a class="btn-primary" href="${escapeHtml(clean)}" target="_blank" rel="noopener">▶ Watch trailer</a>`;
}
function openDetail(key) {
    const app = allApps.find(a => (a.id && a.id === key) || a.name === key);
    if (!app || !detailSection) return;
    const icon = app.image
        ? `<img src="${escapeHtml(app.image)}" alt="${escapeHtml(app.name)}" class="detail-icon">`
        : `<div class="detail-icon emoji">${escapeHtml(app.icon || "★")}</div>`;
    const shots = Array.isArray(app.screenshots) ? app.screenshots : [];
    const shotsHtml = shots.length
        ? `<h3 class="detail-h">Screenshots & demo</h3>
           <div class="shots-grid">${shots.map((s, i) => `<img src="${escapeHtml(s)}" class="shot" alt="${escapeHtml(app.name)} screenshot ${i + 1}" data-src="${escapeHtml(s)}">`).join("")}</div>`
        : "";

    const trailerHtml = app.trailer ? `<h3 class="detail-h">Trailer</h3>${videoEmbed(app.trailer)}` : "";
    const notesHtml = app.releaseNotes
        ? `<div class="detail-notes"><b>What's new:</b> ${escapeHtml(app.releaseNotes)}</div>`
        : "";

    detailBody.innerHTML = `
        <div class="detail-head">
            ${icon}
            <div class="detail-meta">
                <h2>${escapeHtml(app.name)}</h2>
                <span class="detail-ver">Version ${escapeHtml(app.version)}</span>
                <a class="btn-primary detail-dl" href="${escapeHtml(app.downloadUrl)}">⬇ Download</a>
            </div>
        </div>
        <p class="detail-desc">${escapeHtml(app.description)}</p>
        ${notesHtml}
        ${trailerHtml}
        ${shotsHtml}
    `;

    detailBody.querySelectorAll(".shot").forEach(img => {
        img.addEventListener("click", () => openLightbox(img.getAttribute("data-src")));
    });

    if (heroEl) heroEl.style.display = "none";
    if (appsSection) appsSection.style.display = "none";
    if (updatesSection) updatesSection.style.display = "none";
    if (contactSection) contactSection.style.display = "none";
    detailSection.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeDetail() {
    if (!detailSection) return;
    detailSection.style.display = "none";
    if (heroEl) heroEl.style.display = "";
    if (appsSection) appsSection.style.display = "";
    if (updatesSection) updatesSection.style.display = "";
    if (contactSection) contactSection.style.display = "";
}
if (backBtn) backBtn.addEventListener("click", closeDetail);

/* ---------- lightbox ---------- */
function openLightbox(src) {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightbox.classList.add("open");
}
function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    lightboxImg.src = "";
}
if (lightbox) lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox || event.target === lightboxClose) closeLightbox();
});
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeLightbox();
});

/* ---------- updates ---------- */
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
    if (detailSection && detailSection.style.display === "block") closeDetail();
    const value = searchBar.value.toLowerCase();
    const filtered = allApps.filter(app =>
        String(app.name).toLowerCase().includes(value) ||
        String(app.description).toLowerCase().includes(value) ||
        String(app.version).toLowerCase().includes(value)
    );
    renderApps(filtered);
});
/* ---------- init ---------- */
(async function init() {
    await loadSettings();
    await loadApps();
})();
