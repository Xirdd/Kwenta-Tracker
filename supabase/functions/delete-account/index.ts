// Optional: deploy this only if you want "Delete account" to also remove the
// actual sign-in (auth.users row), not just the financial data. The app's
// delete_my_account_data() RPC (see schema.sql) already handles erasing every
// transaction/budget/goal/loan/bill someone owns — that part works today,
// with no deployment needed. This function is the other half: it needs the
// service-role key, which can only ever run on a server, never in the
// browser, so it has to live here instead of in the app itself.
//
// Deploy with the Supabase CLI (https://supabase.com/docs/guides/cli):
//   supabase login
//   supabase link --project-ref <your-project-ref>
//   supabase functions deploy delete-account
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// Supabase into every Edge Function's environment — nothing to configure.
//
// Once deployed, the client can call it with:
//   const { data: { session } } = await supabase.auth.getSession();
//   await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${session.access_token}` },
//   });
// (Not wired into the app by default — deploy this first, then ask to have
// that call added to the Delete Account flow alongside the data-wipe RPC.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Scoped to the caller's own token — used only to confirm who they are,
    // never given the service-role key.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only this admin client — server-side only, never sent to the browser —
    // can actually delete a user. Cascades through every table automatically
    // (see the "on delete cascade" foreign keys in schema.sql), covering
    // anything the data-wipe RPC might have missed.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      user.id,
    );
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
