const OWNER_PATHS = new Set([
  "/royal-owner-panel",
  "/royal-owner-panel.html"
]);

const OLD_ADMIN_PATHS = new Set([
  "/admin",
  "/admin.html"
]);

const MAX_LOGIN_ATTEMPTS = 6;
const LOGIN_WINDOW_SECONDS = 10 * 60;

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function getClientIp(request) {
  return request.headers.get("cf-connecting-ip") ||
         request.headers.get("x-forwarded-for") ||
         "unknown";
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const parts = cookie.split(";").map(part => part.trim());
  const found = parts.find(part => part.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sessionToken(env) {
  const password = env.ADMIN_PASSWORD || "royal";
  const secret = env.ADMIN_SESSION_SECRET || "change-this-session-secret";
  return sha256(password + ":" + secret);
}

async function checkRateLimit(request, env) {
  if (!env.ROYAL_KV) return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS };

  const ip = getClientIp(request);
  const bucket = Math.floor(Date.now() / (LOGIN_WINDOW_SECONDS * 1000));
  const key = `rate:owner-login:${ip}:${bucket}`;

  const current = Number(await env.ROYAL_KV.get(key) || "0");
  if (current >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  await env.ROYAL_KV.put(key, String(current + 1), {
    expirationTtl: LOGIN_WINDOW_SECONDS + 60
  });

  return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - current - 1 };
}

async function verifyTurnstile(request, token, env) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { success: false, message: "Turnstile secret key missing in Cloudflare variables." };
  }

  if (!token) {
    return { success: false, message: "Complete the security check first." };
  }

  const formData = new FormData();
  formData.append("secret", env.TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  formData.append("remoteip", getClientIp(request));

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData
  });

  const data = await response.json().catch(() => ({}));

  if (!data.success) {
    return { success: false, message: "Security check failed. Refresh and try again." };
  }

  return { success: true };
}

function loginPage(env, error = "") {
  const siteKey = env.TURNSTILE_SITE_KEY || "";
  const turnstileHtml = siteKey
    ? `<div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="dark"></div>`
    : `<div class="err">Turnstile site key missing in Cloudflare variables.</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Royal Owner Login</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, Arial, sans-serif; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: radial-gradient(circle at 70% 10%, rgba(124,92,255,.25), transparent 35%), #07070d;
      color: #f4f4fb;
    }
    .box {
      width: min(92vw, 420px); padding: 32px; border-radius: 22px;
      background: rgba(20,20,31,.92); border: 1px solid rgba(255,255,255,.1);
      box-shadow: 0 24px 70px rgba(0,0,0,.55);
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0 0 22px; color: #9aa0b4; line-height: 1.5; }
    input {
      width: 100%; box-sizing: border-box; padding: 13px 14px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.05);
      color: #fff; outline: none; font-size: 15px; margin-bottom: 12px;
    }
    .turnstile-wrap { display: flex; justify-content: center; margin: 10px 0 16px; min-height: 65px; }
    button {
      width: 100%; padding: 13px 16px; border: 0; border-radius: 12px;
      background: linear-gradient(120deg,#7c5cff,#6741e0); color: white;
      font-weight: 800; cursor: pointer; font-size: 15px;
    }
    .err { color: #fca5a5; min-height: 22px; margin-top: 12px; text-align: center; font-size: 14px; }
  </style>
</head>
<body>
  <form class="box" method="POST" action="/royal-owner-panel">
    <h1>Royal Owner Login</h1>
    <p>Owner-only admin. Complete the security check, then enter the owner password.</p>
    <input name="password" type="password" placeholder="Owner password" autocomplete="current-password" autofocus>
    <div class="turnstile-wrap">${turnstileHtml}</div>
    <button type="submit">Open Admin Panel</button>
    <div class="err">${error}</div>
  </form>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (OLD_ADMIN_PATHS.has(path)) {
    return html("Not found", 404);
  }

  if (!OWNER_PATHS.has(path)) {
    return next();
  }

  if (request.method === "POST") {
    const limited = await checkRateLimit(request, env);
    if (!limited.allowed) {
      return html(loginPage(env, "Too many attempts. Wait 10 minutes and try again."), 429);
    }

    const form = await request.formData();
    const turnstileToken = String(form.get("cf-turnstile-response") || "");
    const turnstile = await verifyTurnstile(request, turnstileToken, env);

    if (!turnstile.success) {
      return html(loginPage(env, turnstile.message), 403);
    }

    const provided = String(form.get("password") || "");
    const realPassword = env.ADMIN_PASSWORD || "royal";

    if (provided !== realPassword) {
      return html(loginPage(env, "Wrong password."), 401);
    }

    const token = await sessionToken(env);
    return new Response(null, {
      status: 303,
      headers: {
        "location": "/royal-owner-panel",
        "set-cookie": `royal_owner_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
      }
    });
  }

  const expected = await sessionToken(env);
  const current = getCookie(request, "royal_owner_session");

  if (current !== expected) {
    return html(loginPage(env, ""));
  }

  return next();
}