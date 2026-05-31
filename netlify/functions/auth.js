import crypto from "crypto";

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

export default async function handler(request) {
    if (request.method.toUpperCase() !== "POST") {
        return jsonResponse(405, { success: false, message: "Method not allowed" });
    }

    const password = request.headers.get("x-admin-password");
    const expected = process.env.ADMIN_PASSWORD;

    if (!expected) {
        return jsonResponse(500, { success: false, message: "Admin password not configured on server" });
    }

    if (!password) {
        return jsonResponse(401, { success: false, message: "Password required" });
    }

    const a = Buffer.from(password);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return jsonResponse(401, { success: false, message: "Wrong password" });
    }

    return jsonResponse(200, { success: true });
}
