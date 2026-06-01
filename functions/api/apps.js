const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type,x-admin-password"
    }
  });

const APPS_KEY = "royal:apps";

function getPassword(env) {
  return env.ADMIN_PASSWORD || "royal";
}

function isAdmin(request, env) {
  return request.headers.get("x-admin-password") === getPassword(env);
}

async function readApps(env) {
  if (!env.ROYAL_KV) {
    throw new Error("Missing Cloudflare KV binding named ROYAL_KV");
  }

  const raw = await env.ROYAL_KV.get(APPS_KEY);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeApps(env, apps) {
  if (!env.ROYAL_KV) {
    throw new Error("Missing Cloudflare KV binding named ROYAL_KV");
  }

  await env.ROYAL_KV.put(APPS_KEY, JSON.stringify(apps));
}

export async function onRequestOptions() {
  return json({ success: true });
}

export async function onRequestGet({ env }) {
  try {
    const apps = await readApps(env);
    return json({ success: true, apps });
  } catch (error) {
    return json({ success: false, message: error.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!isAdmin(request, env)) {
      return json({ success: false, message: "Wrong admin password" }, 401);
    }

    const payload = await request.json();
    const apps = await readApps(env);

    const app = {
      id: payload.id || "app-" + Date.now().toString(36),
      name: String(payload.name || "").trim(),
      version: String(payload.version || "").trim(),
      icon: String(payload.icon || "").trim(),
      image: String(payload.image || "").trim(),
      description: String(payload.description || "").trim(),
      releaseNotes: String(payload.releaseNotes || "").trim(),
      downloadUrl: String(payload.downloadUrl || "").trim()
    };

    if (!app.name || !app.version || !app.description || !app.downloadUrl) {
      return json({ success: false, message: "Missing required fields" }, 400);
    }

    apps.push(app);
    await writeApps(env, apps);

    return json({ success: true, apps });
  } catch (error) {
    return json({ success: false, message: error.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    if (!isAdmin(request, env)) {
      return json({ success: false, message: "Wrong admin password" }, 401);
    }

    const payload = await request.json();

    if (!payload.id) {
      return json({ success: false, message: "Missing app id" }, 400);
    }

    const apps = await readApps(env);
    const index = apps.findIndex(app => app.id === payload.id);

    if (index === -1) {
      return json({ success: false, message: "App not found" }, 404);
    }

    apps[index] = {
      ...apps[index],
      name: String(payload.name || "").trim(),
      version: String(payload.version || "").trim(),
      icon: String(payload.icon || "").trim(),
      image: String(payload.image || "").trim(),
      description: String(payload.description || "").trim(),
      releaseNotes: String(payload.releaseNotes || "").trim(),
      downloadUrl: String(payload.downloadUrl || "").trim()
    };

    if (!apps[index].name || !apps[index].version || !apps[index].description || !apps[index].downloadUrl) {
      return json({ success: false, message: "Missing required fields" }, 400);
    }

    await writeApps(env, apps);

    return json({ success: true, apps });
  } catch (error) {
    return json({ success: false, message: error.message }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    if (!isAdmin(request, env)) {
      return json({ success: false, message: "Wrong admin password" }, 401);
    }

    const payload = await request.json();

    if (!payload.id) {
      return json({ success: false, message: "Missing app id" }, 400);
    }

    const apps = await readApps(env);
    const nextApps = apps.filter(app => app.id !== payload.id);

    await writeApps(env, nextApps);

    return json({ success: true, apps: nextApps });
  } catch (error) {
    return json({ success: false, message: error.message }, 500);
  }
}
