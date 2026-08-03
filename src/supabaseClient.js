import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[Kwenta] Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file " +
      "(see .env.example) to enable sign in and cloud sync. The app will keep working locally until then.",
  );
}

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
