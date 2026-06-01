export async function onRequest({ env }) {
  return new Response(JSON.stringify({
    TURNSTILE_SITE_KEY: Boolean(env.TURNSTILE_SITE_KEY),
    TURNSTILE_SECRET_KEY: Boolean(env.TURNSTILE_SECRET_KEY),
    ADMIN_EMAIL: Boolean(env.ADMIN_EMAIL),
    ADMIN_PASSWORD: Boolean(env.ADMIN_PASSWORD),
    ADMIN_SESSION_SECRET: Boolean(env.ADMIN_SESSION_SECRET),
    RESEND_API_KEY: Boolean(env.RESEND_API_KEY),
    RESEND_FROM_EMAIL: Boolean(env.RESEND_FROM_EMAIL),
    ROYAL_KV: Boolean(env.ROYAL_KV),

    // Shows names only, not values
    availableKeys: Object.keys(env).sort()
  }, null, 2), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}
