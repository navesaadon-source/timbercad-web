// Supabase Edge Function: sends admin alerts by e-mail (Resend) and Telegram.
// Called by the database trigger public.orders_log() through public.notify().
// Secrets (Edge Functions → Secrets): NOTIFY_SECRET, ADMIN_EMAIL, RESEND_API_KEY, RESEND_FROM,
//                                     TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SITE_URL
// Deploy: supabase functions deploy notify --no-verify-jwt

const env = (k: string) => Deno.env.get(k) ?? "";

const TITLES: Record<string, string> = {
  order_frozen: "⏸ לקוח הקפיא הזמנה",
  order_unfrozen: "▶ לקוח ביקש להמשיך הזמנה",
  order_created: "🆕 הזמנה חדשה",
  retainer_exhausted: "⌛ נגמרו שעות הריטיינר",
};

Deno.serve(async (req) => {
  if (req.headers.get("x-notify-secret") !== env("NOTIFY_SECRET")) return new Response("forbidden", { status: 403 });
  const { type, order = {}, client = {} } = await req.json();
  const title = TITLES[type] ?? type;
  const who = client.company_name || client.full_name || client.email || "לקוח";
  const link = env("SITE_URL") ? `${env("SITE_URL")}/#/admin/order/${order.id}` : "";
  const lines = [
    title,
    `לקוח: ${who}`,
    order.order_no ? `הזמנה #${order.order_no}: ${order.project_name ?? ""}` : "",
    client.phone ? `טלפון: ${client.phone}` : "",
    link,
  ].filter(Boolean);
  const text = lines.join("\n");
  const results: Record<string, unknown> = {};

  if (env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_CHAT_ID")) {
    const r = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env("TELEGRAM_CHAT_ID"), text, disable_web_page_preview: true }),
    });
    results.telegram = r.status;
  }

  if (env("RESEND_API_KEY") && env("ADMIN_EMAIL")) {
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px">
      <h2 style="margin:0 0 10px">${title}</h2>
      ${lines.slice(1, -1).map((l) => `<div>${l}</div>`).join("")}
      ${link ? `<p><a href="${link}">פתיחת ההזמנה במערכת</a></p>` : ""}</div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("RESEND_FROM") || "TimberCad <onboarding@resend.dev>",
        to: env("ADMIN_EMAIL").split(","),
        subject: `${title} – ${who}`,
        html,
      }),
    });
    results.email = r.status;
  }

  return Response.json({ ok: true, results });
});
