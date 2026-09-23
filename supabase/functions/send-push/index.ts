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

// A plain `a !== b` string comparison on a secret returns as soon as it
// finds the first differing character — in principle, that means a wrong
// guess that happens to share more of its prefix with the real secret takes
// marginally longer to reject than one that doesn't, which is the classic
// timing side-channel for secret comparisons. This walks the full length of
// both strings unconditionally (via XOR-accumulation) instead of bailing
// early, so the comparison takes the same time regardless of where (or
// whether) the strings first differ. Pads to equal length first so the
// length itself doesn't leak through early loop termination either.
function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLen, "\0");
  const paddedB = b.padEnd(maxLen, "\0");
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    mismatch |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  try {
    const providedSecret = req.headers.get("x-push-secret");
    if (
      !PUSH_FUNCTION_SECRET ||
      !providedSecret ||
      !timingSafeEqual(providedSecret, PUSH_FUNCTION_SECRET)
    ) {
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
