// Permanently deletes the CALLER's account: their data first (via the
// existing delete_my_account_data() SQL function, run as the user so it's
// scoped by auth.uid()), then the auth.users row itself (needs the
// service-role key, which only ever exists here on the server).
//
// Deploy (JWT verification stays ON — this is called by a signed-in user):
//   supabase login
//   supabase link --project-ref <your-project-ref>
//   supabase functions deploy delete-account
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into every Edge Function — no `secrets set` needed.
//
// Prerequisite: run supabase/phase1_restore_and_delete.sql once (it lets
// auth-user deletion succeed for people who appear in the household log).
//
// The send-push function lives in supabase/functions/send-push/ — an earlier
// copy of its code was sitting in this file by mistake and is replaced here.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // safe: every call still needs a valid user JWT
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Reads the `aal` claim from the JWT payload (the token itself was already
// verified by getUser() below, so this is only reading, not trusting).
function aalFromToken(token: string): string {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    return JSON.parse(atob(padded)).aal || "aal1";
  } catch {
    return "aal1";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verifies the token with Supabase Auth and tells us who this really is.
    const { data: userData, error: userError } =
      await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Not signed in" }, 401);
    }
    const user = userData.user;

    // Server-side guard, independent of the app's own confirmation UI.
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "DELETE") {
      return json({ error: "Missing confirmation" }, 400);
    }

    // If the account has 2FA, this session must have completed it.
    const { data: factorData } = await admin.auth.admin.mfa.listFactors({
      userId: user.id,
    });
    const hasVerifiedFactor = (factorData?.factors || []).some(
      (f: { status: string }) => f.status === "verified",
    );
    if (hasVerifiedFactor && aalFromToken(token) !== "aal2") {
      return json(
        { error: "Confirm with your authenticator code first." },
        403,
      );
    }

    // 1. Their data, as the user (delete_my_account_data uses auth.uid()).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: dataError } = await userClient.rpc("delete_my_account_data");
    if (dataError) throw dataError;

    // Best-effort cleanup of rows that aren't covered above (no-op if absent).
    await admin
      .from("kwenta_push_subscriptions")
      .delete()
      .eq("user_id", user.id);

    // 2. The sign-in record itself.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (e) {
    console.error("delete-account failed", e);
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
