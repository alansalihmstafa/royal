import { getStore } from "@netlify/blobs";
import crypto from "crypto";

const APPS_KEY = "apps";

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function verifyAdmin(request) {
    const password = request.headers.get("x-admin-password");
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
        return false;
    }

    if (!password) {
        return false;
    }

    const a = Buffer.from(password);
    const b = Buffer.from(expected);

    if (a.length !== b.length) {
        return false;
    }

    return crypto.timingSafeEqual(a, b);
}

function validateAppPayload(payload) {
    const errors = [];

    if (!payload.name || typeof payload.name !== "string" || payload.name.length > 200) {
        errors.push("name is required (max 200 chars)");
    }

    if (!payload.version || typeof payload.version !== "string" || payload.version.length > 50) {
        errors.push("version is required (max 50 chars)");
    }

    if (!payload.description || typeof payload.description !== "string" || payload.description.length > 2000) {
        errors.push("description is required (max 2000 chars)");
    }

    if (!payload.downloadUrl || typeof payload.downloadUrl !== "string") {
        errors.push("downloadUrl is required");
    } else if (!/^https?:\/\//i.test(payload.downloadUrl)) {
        errors.push("downloadUrl must use http or https protocol");
    } else if (payload.downloadUrl.length > 2000) {
        errors.push("downloadUrl is too long (max 2000 chars)");
    }

    if (payload.icon && (typeof payload.icon !== "string" || payload.icon.length > 10)) {
        errors.push("icon must be a short string (max 10 chars)");
    }

    if (payload.image && typeof payload.image === "string") {
        if (!/^https?:\/\//i.test(payload.image)) {
            errors.push("image URL must use http or https protocol");
        } else if (payload.image.length > 2000) {
            errors.push("image URL is too long (max 2000 chars)");
        }
    }

    if (payload.releaseNotes && (typeof payload.releaseNotes !== "string" || payload.releaseNotes.length > 5000)) {
        errors.push("releaseNotes must be a string (max 5000 chars)");
    }

    return errors;
}

export default async function handler(request) {
    const method = request.method.toUpperCase();
    const store = getStore("royal-apps");

    // GET — public, no auth required
    if (method === "GET") {
        try {
            const raw = await store.get(APPS_KEY);
            const apps = raw ? JSON.parse(raw) : [];
            return jsonResponse(200, { success: true, apps });
        } catch {
            return jsonResponse(200, { success: true, apps: [] });
        }
    }

    // All write operations require admin auth
    if (!verifyAdmin(request)) {
        return jsonResponse(401, { success: false, message: "Unauthorized" });
    }

    if (method === "POST") {
        try {
            const payload = await request.json();
            const errors = validateAppPayload(payload);

            if (errors.length > 0) {
                return jsonResponse(400, { success: false, message: errors.join("; ") });
            }

            const raw = await store.get(APPS_KEY);
            const apps = raw ? JSON.parse(raw) : [];

            const newApp = {
                id: crypto.randomUUID(),
                name: payload.name.trim(),
                version: payload.version.trim(),
                icon: (payload.icon || "").trim(),
                image: (payload.image || "").trim(),
                description: payload.description.trim(),
                releaseNotes: (payload.releaseNotes || "").trim(),
                downloadUrl: payload.downloadUrl.trim(),
                createdAt: new Date().toISOString(),
            };

            apps.push(newApp);
            await store.set(APPS_KEY, JSON.stringify(apps));

            return jsonResponse(200, { success: true, apps });
        } catch {
            return jsonResponse(500, { success: false, message: "Failed to create app" });
        }
    }

    if (method === "PUT") {
        try {
            const payload = await request.json();

            if (!payload.id || typeof payload.id !== "string") {
                return jsonResponse(400, { success: false, message: "id is required" });
            }

            const errors = validateAppPayload(payload);

            if (errors.length > 0) {
                return jsonResponse(400, { success: false, message: errors.join("; ") });
            }

            const raw = await store.get(APPS_KEY);
            const apps = raw ? JSON.parse(raw) : [];
            const index = apps.findIndex((a) => a.id === payload.id);

            if (index === -1) {
                return jsonResponse(404, { success: false, message: "App not found" });
            }

            apps[index] = {
                ...apps[index],
                name: payload.name.trim(),
                version: payload.version.trim(),
                icon: (payload.icon || "").trim(),
                image: (payload.image || "").trim(),
                description: payload.description.trim(),
                releaseNotes: (payload.releaseNotes || "").trim(),
                downloadUrl: payload.downloadUrl.trim(),
                updatedAt: new Date().toISOString(),
            };

            await store.set(APPS_KEY, JSON.stringify(apps));

            return jsonResponse(200, { success: true, apps });
        } catch {
            return jsonResponse(500, { success: false, message: "Failed to update app" });
        }
    }

    if (method === "DELETE") {
        try {
            const payload = await request.json();

            if (!payload.id || typeof payload.id !== "string") {
                return jsonResponse(400, { success: false, message: "id is required" });
            }

            const raw = await store.get(APPS_KEY);
            const apps = raw ? JSON.parse(raw) : [];
            const filtered = apps.filter((a) => a.id !== payload.id);

            if (filtered.length === apps.length) {
                return jsonResponse(404, { success: false, message: "App not found" });
            }

            await store.set(APPS_KEY, JSON.stringify(filtered));

            return jsonResponse(200, { success: true, apps: filtered });
        } catch {
            return jsonResponse(500, { success: false, message: "Failed to delete app" });
        }
    }

    return jsonResponse(405, { success: false, message: "Method not allowed" });
}
