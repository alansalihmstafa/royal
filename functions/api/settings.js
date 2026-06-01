const DEFAULT_SETTINGS = {
  title: "Royal",
  tagline: "Premium desktop applications, tools, and software downloads.",
  accent: "#7c5cff",
  carouselInterval: 5,
  footer: "© 2026 Royal. All rights reserved.",
  discord: "https://discord.gg/QpmxAKQrD"
};
const SETTINGS_KEY = "royal:settings";
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,PUT,OPTIONS",
      "access-control-allow-headers": "content-type,x-admin-password"
    }
  });
function getPassword(env) { return env.ADMIN_PASSWORD || "royal"; }
function isAdmin(request, env) { return request.headers.get("x-admin-password") === getPassword(env); }
function cleanSettings(payload = {}) {
  return {
    title: String(payload.title || DEFAULT_SETTINGS.title).trim() || DEFAULT_SETTINGS.title,
    tagline: String(payload.tagline || DEFAULT_SETTINGS.tagline).trim(),
    accent: /^#[0-9a-fA-F]{6}$/.test(String(payload.accent || "")) ? payload.accent : DEFAULT_SETTINGS.accent,
    carouselInterval: Math.max(2, Number(payload.carouselInterval) || DEFAULT_SETTINGS.carouselInterval),
    footer: String(payload.footer || DEFAULT_SETTINGS.footer).trim() || DEFAULT_SETTINGS.footer,
    discord: String(payload.discord || DEFAULT_SETTINGS.discord).trim() || DEFAULT_SETTINGS.discord
  };
}
async function readSettings(env) {
  if (!env.ROYAL_KV) throw new Error("Missing Cloudflare KV binding named ROYAL_KV");
  const raw = await env.ROYAL_KV.get(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)); } catch { return DEFAULT_SETTINGS; }
}
async function writeSettings(env, settings) {
  if (!env.ROYAL_KV) throw new Error("Missing Cloudflare KV binding named ROYAL_KV");
  await env.ROYAL_KV.put(SETTINGS_KEY, JSON.stringify(settings));
}
export async function onRequestOptions() { return json({ success: true }); }
export async function onRequestGet({ env }) {
  try { return json({ success: true, settings: await readSettings(env) }); }
  catch (error) { return json({ success: false, message: error.message }, 500); }
}
export async function onRequestPut({ request, env }) {
  try {
    if (!isAdmin(request, env)) return json({ success: false, message: "Wrong admin password" }, 401);
    const payload = await request.json();
    const settings = cleanSettings(payload);
    await writeSettings(env, settings);
    return json({ success: true, settings });
  } catch (error) { return json({ success: false, message: error.message }, 500); }
}