import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof window === "undefined") return null;
  if (key.startsWith("sb_secret_")) throw new Error("Folosește numai cheia publică Supabase.");
  client ??= createClient(url, key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
  return client;
}

export async function projectAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {data, error} = await supabase.auth.getSession();
  if (error) throw new Error("Sesiunea a expirat. Autentifică-te din nou.");
  return data.session?.access_token || null;
}
