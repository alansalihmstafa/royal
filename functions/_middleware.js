const OWNER_PATHS = new Set(["/royal-owner-panel", "/royal-owner-panel.html"]);
const OLD_ADMIN_PATHS = new Set(["/admin", "/admin.html"]);
const MAX_LOGIN_ATTEMPTS = 6;
const LOGIN_WINDOW_SECONDS = 10 * 60;
const OTP_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 5;

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...extraHeaders }
  });
}
function getClientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
}
function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const found = cookie.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}
function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sessionToken(env) {
  return sha256(`${env.ADMIN_PASSWORD || "royal"}:${env.ADMIN_SESSION_SECRET || "change-this-session-secret"}`);
}
async function otpHash(code, otpId, env) {
  return sha256(`${code}:${otpId}:${env.ADMIN_SESSION_SECRET || "change-this-session-secret"}`);
}
function randomCode() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}
async function checkRateLimit(request, env, type = "owner-login") {
  if (!env.ROYAL_KV) return { allowed: true };
  const ip = getClientIp(request);
  const bucket = Math.floor(Date.now() / (LOGIN_WINDOW_SECONDS * 1000));
  const key = `rate:${type}:${ip}:${bucket}`;
  const current = Number(await env.ROYAL_KV.get(key) || "0");
  if (current >= MAX_LOGIN_ATTEMPTS) return { allowed: false };
  await env.ROYAL_KV.put(key, String(current + 1), { expirationTtl: LOGIN_WINDOW_SECONDS + 60 });
  return { allowed: true };
}
async function verifyTurnstile(request, token, env) {
  if (!env.TURNSTILE_SECRET_KEY) return { success: false, message: "Turnstile secret key missing." };
  if (!token) return { success: false, message: "Complete the security check first." };
  const formData = new FormData();
  formData.append("secret", env.TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  formData.append("remoteip", getClientIp(request));
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: formData });
  const data = await response.json().catch(() => ({}));
  return data.success ? { success: true } : { success: false, message: "Security check failed. Refresh and try again." };
}
async function sendCodeEmail(email, code, env) {
  if (!env.RESEND_API_KEY) return { success: false, message: "RESEND_API_KEY missing." };
  const from = env.RESEND_FROM_EMAIL || "Royal Admin <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Royal admin login code",
      html: `<h2>Royal admin login code</h2><p>Your one-time admin code is:</p><div style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</div><p>This code expires in 10 minutes.</p>`
    })
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { success: true } : { success: false, message: data.message || "Email failed to send." };
}
function css() {
  return `:root{color-scheme:dark;font-family:Inter,system-ui,Arial,sans-serif}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 70% 10%,rgba(124,92,255,.25),transparent 35%),#07070d;color:#f4f4fb}.box{width:min(92vw,430px);padding:32px;border-radius:22px;background:rgba(20,20,31,.92);border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 70px rgba(0,0,0,.55)}h1{margin:0 0 8px;font-size:28px}p{margin:0 0 22px;color:#9aa0b4;line-height:1.5}input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#fff;outline:none;font-size:15px;margin-bottom:12px}.turnstile-wrap{display:flex;justify-content:center;margin:10px 0 16px;min-height:65px}button{width:100%;padding:13px 16px;border:0;border-radius:12px;background:linear-gradient(120deg,#7c5cff,#6741e0);color:white;font-weight:800;cursor:pointer;font-size:15px}.ghost{display:block;text-align:center;margin-top:14px;color:#b59bff;text-decoration:none;font-size:14px}.err{color:#fca5a5;min-height:22px;margin-top:12px;text-align:center;font-size:14px}`;
}
function loginPage(env, error = "") {
  const siteKey = env.TURNSTILE_SITE_KEY || "";
  const allowedEmail = env.ADMIN_EMAIL || "your-owner-email@example.com";
  const turnstileHtml = siteKey ? `<div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="dark"></div>` : `<div class="err">TURNSTILE_SITE_KEY missing.</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Royal Owner Login</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><style>${css()}</style></head><body><form class="box" method="POST" action="/royal-owner-panel"><input type="hidden" name="action" value="send-code"><h1>Royal Owner Login</h1><p>Enter owner email and password. If correct, a code will be sent to <b>${allowedEmail}</b>.</p><input name="email" type="email" placeholder="Owner email" autocomplete="email" required><input name="password" type="password" placeholder="Owner password" autocomplete="current-password" required><div class="turnstile-wrap">${turnstileHtml}</div><button type="submit">Send login code</button><div class="err">${error}</div></form></body></html>`;
}
function codePage(message = "Code sent. Check your email.", error = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Royal Verify Code</title><style>${css()}</style></head><body><form class="box" method="POST" action="/royal-owner-panel"><input type="hidden" name="action" value="verify-code"><h1>Verify email code</h1><p>${message}</p><input name="code" type="text" inputmode="numeric" maxlength="6" placeholder="6-digit code" autocomplete="one-time-code" required><button type="submit">Verify and open admin</button><a class="ghost" href="/royal-owner-panel">Start again</a><div class="err">${error}</div></form></body></html>`;
}
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  if (OLD_ADMIN_PATHS.has(path)) return html("Not found", 404);
  if (!OWNER_PATHS.has(path)) return next();
  if (!env.ROYAL_KV) return html("Missing ROYAL_KV binding.", 500);

  const expectedSession = await sessionToken(env);
  if (request.method === "GET" && getCookie(request, "royal_owner_session") === expectedSession) return next();
  if (request.method === "GET") return html(loginPage(env));
  if (request.method !== "POST") return html("Method not allowed", 405);

  const form = await request.formData();
  const action = String(form.get("action") || "");

  if (action === "send-code") {
    const limited = await checkRateLimit(request, env, "owner-login");
    if (!limited.allowed) return html(loginPage(env, "Too many attempts. Wait 10 minutes and try again."), 429);
    const turnstile = await verifyTurnstile(request, String(form.get("cf-turnstile-response") || ""), env);
    if (!turnstile.success) return html(loginPage(env, turnstile.message), 403);

    const email = String(form.get("email") || "").trim().toLowerCase();
    const ownerEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
    const providedPassword = String(form.get("password") || "");
    if (!ownerEmail) return html(loginPage(env, "ADMIN_EMAIL missing in Cloudflare variables."), 500);
    if (email !== ownerEmail || providedPassword !== (env.ADMIN_PASSWORD || "royal")) return html(loginPage(env, "Wrong email or password."), 401);

    const code = randomCode();
    const otpId = crypto.randomUUID();
    await env.ROYAL_KV.put(`otp:${otpId}`, JSON.stringify({ email, hash: await otpHash(code, otpId, env), attempts: 0 }), { expirationTtl: OTP_TTL_SECONDS });

    const sent = await sendCodeEmail(email, code, env);
    if (!sent.success) return html(loginPage(env, sent.message), 500);

    return html(codePage("Code sent. Check your email. It expires in 10 minutes."), 200, {
      "set-cookie": `royal_otp_id=${encodeURIComponent(otpId)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${OTP_TTL_SECONDS}`
    });
  }

  if (action === "verify-code") {
    const otpId = getCookie(request, "royal_otp_id");
    if (!otpId) return html(loginPage(env, "Code session expired. Start again."), 401);
    const key = `otp:${otpId}`;
    const raw = await env.ROYAL_KV.get(key);
    if (!raw) return html(loginPage(env, "Code expired. Start again."), 401, { "set-cookie": clearCookie("royal_otp_id") });

    const record = JSON.parse(raw);
    if (Number(record.attempts || 0) >= MAX_OTP_ATTEMPTS) {
      await env.ROYAL_KV.delete(key);
      return html(loginPage(env, "Too many wrong codes. Start again."), 401, { "set-cookie": clearCookie("royal_otp_id") });
    }

    const providedCode = String(form.get("code") || "").trim();
    if (await otpHash(providedCode, otpId, env) !== record.hash) {
      record.attempts = Number(record.attempts || 0) + 1;
      await env.ROYAL_KV.put(key, JSON.stringify(record), { expirationTtl: OTP_TTL_SECONDS });
      return html(codePage("Code sent. Check your email. It expires in 10 minutes.", "Wrong code."), 401);
    }

    await env.ROYAL_KV.delete(key);
   const headers = new Headers();
headers.set("location", "/royal-owner-panel");
headers.append(
  "Set-Cookie",
  `royal_owner_session=${encodeURIComponent(expectedSession)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
);
headers.append(
  "Set-Cookie",
  clearCookie("royal_otp_id")
);

return new Response(null, {
  status: 303,
  headers
});

  return html(loginPage(env, "Invalid action."), 400);
}
