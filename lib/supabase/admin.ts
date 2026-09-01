import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only used server-side (API routes / middleware).
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Lazily initialized so module evaluation during the build phase doesn't require env vars.
let _instance: SupabaseClient | undefined;

function getInstance(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _instance;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop: string | symbol) {
    const val = Reflect.get(getInstance(), prop, getInstance());
    return typeof val === "function" ? val.bind(getInstance()) : val;
  },
});
