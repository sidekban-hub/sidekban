const SUPABASE_URL =
  ".........................";

const SUPABASE_ANON_KEY = "........................";

const supabaseReady =
  typeof window.supabase !== "undefined" &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("ISI_SUPABASE") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("ISI_SUPABASE");

const supabaseClient = supabaseReady
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.sessionStorage
        }
      }
    )
  : null;
