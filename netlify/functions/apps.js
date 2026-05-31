import { getStore } from "@netlify/blobs";

// Optional shared/persistent backend for the Royal app list.
// Only used when the site is deployed on Netlify; the static site works
// without it (see app.js fallbacks). Set ADMIN_PASSWORD in the Netlify
// dashboard to change the admin passcode (defaults to "royal").

const STORE_NAME = "royal-apps";
const KEY = "apps";

function json(statusCode, body) {
    return {
        statusCode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

function getAdminPassword() {
    return process.env.ADMIN_PASSWORD || "royal";
}

async function readApps(store) {
    const data = await store.get(KEY, { type: "json" });
    return Array.isArray(data) ? data : [];
}

export default async (request) => {
    const store = getStore(STORE_NAME);
    const method = request.method;

    if (method === "GET") {
        const provided = request.headers.get("x-admin-password");
        // When an admin passcode is provided it must be correct (used for login).
        if (provided !== null && provided !== getAdminPassword()) {
            return json(401, { success: false, message: "Wrong admin password" });
        }
        const apps = await readApps(store);
        return json(200, { success: true, apps });
    }

    const provided = request.headers.get("x-admin-password");
    if (provided !== getAdminPassword()) {
        return json(401, { success: false, message: "Wrong admin password" });
    }

    let payload = {};
    try {
        payload = await request.json();
    } catch (error) {
        payload = {};
    }

    let apps = await readApps(store);

    if (method === "POST") {
        const app = {
            id: "app-" + Date.now().toString(36),
            name: payload.name || "",
            version: payload.version || "",
            icon: payload.icon || "",
            image: payload.image || "",
            description: payload.description || "",
            releaseNotes: payload.releaseNotes || "",
            downloadUrl: payload.downloadUrl || "",
        };
        apps.push(app);
        await store.setJSON(KEY, apps);
        return json(200, { success: true, apps });
    }

    if (method === "PUT") {
        const index = apps.findIndex((item) => item.id === payload.id);
        if (index === -1) {
            return json(404, { success: false, message: "App not found" });
        }
        apps[index] = Object.assign({}, apps[index], payload);
        await store.setJSON(KEY, apps);
        return json(200, { success: true, apps });
    }

    if (method === "DELETE") {
        apps = apps.filter((item) => item.id !== payload.id);
        await store.setJSON(KEY, apps);
        return json(200, { success: true, apps });
    }

    return json(405, { success: false, message: "Method not allowed" });
};
