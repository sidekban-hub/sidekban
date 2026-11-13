const SUPABASE_URL =
  "https://cxqxfjtyjflgjfisyxig.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_5jtyKl-7kqPCTU2W3Iysug__uWnr0G0";

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