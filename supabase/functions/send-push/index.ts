// This is the piece that actually sends a push notification — everything in
// push_notifications.sql just calls this over HTTP, using pg_net, whenever a
// budget gets crossed or a bill is coming due. Without this deployed, those
// triggers/cron jobs run but have nothing to actually deliver the message.
//
// Deploy with the Supabase CLI:
//   supabase login
//   supabase link --project-ref <your-project-ref>
//   supabase secrets set VAPID_PUBLIC_KEY=<the public key from setup>
//   supabase secrets set VAPID_PRIVATE_KEY=<the private key from setup>
//   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//   supabase secrets set PUSH_FUNCTION_SECRET=<same random string you set in push_notifications.sql>
//   supabase functions deploy send-push --no-verify-jwt
//
// --no-verify-jwt matters here: this function is called by Postgres (via
// pg_net), not by a signed-in user's browser, so there's no user JWT to
// verify. Instead, it's protected by the shared secret header below —
// anyone calling this without the right x-push-secret gets rejected.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
const PUSH_FUNCTION_SECRET = Deno.env.get("PUSH_FUNCTION_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  try {
    const providedSecret = req.headers.get("x-push-secret");
    if (!PUSH_FUNCTION_SECRET || providedSecret !== PUSH_FUNCTION_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { subscription, title, body, url } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys) {
      return new Response(JSON.stringify({ error: "Missing subscription" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url: url || "/" });

    try {
      await webpush.sendNotification(subscription, payload);
    } catch (pushError) {
      // A 404/410 from the push service means that specific subscription is
      // dead (browser data cleared, uninstalled, etc.) — not a real error,
      // just a stale endpoint. Anything else is worth surfacing.
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        return new Response(
          JSON.stringify({ ok: true, note: "Subscription expired, skipped" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      throw pushError;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
