// Variáveis de ambiente públicas (todas prefixadas VITE_, chegam ao navegador).
// Nenhuma cobra dinheiro: o access token secreto do MP vive só no Supabase.

interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  mpPublicKey: string;
}

function readEnv(): AppEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
  const mpPublicKey = import.meta.env.VITE_MP_PUBLIC_KEY ?? "";

  return { supabaseUrl, supabaseAnonKey, mpPublicKey };
}

export const env: AppEnv = readEnv();

/**
 * true quando as 3 chaves estão presentes. Enquanto for false, o checkout
 * mostra um aviso amigável em vez de quebrar — útil antes de preencher o .env.
 */
export const isPaymentConfigured: boolean = Boolean(
  env.supabaseUrl && env.supabaseAnonKey && env.mpPublicKey,
);

/** Base das Edge Functions do Supabase. */
export function functionsUrl(name: string): string {
  return `${env.supabaseUrl}/functions/v1/${name}`;
}
