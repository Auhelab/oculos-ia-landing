import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Cliente admin (service role) para uso EXCLUSIVO dentro das Edge Functions.
 * A service role ignora o RLS — nunca exponha esta chave ao frontend.
 * SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente
 * no ambiente das functions pelo próprio Supabase.
 */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente da função.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
