// tracking-webhook
// Recebe as notificações de push do 17TRACK quando o rastreio de uma encomenda
// é atualizado. Valida a assinatura do header `sign` (SHA-256 do corpo cru
// concatenado com "/" + TRACK17_API_KEY), grava a linha do tempo de eventos em
// orders e promove o pedido a "delivered" quando entregue.
//
// Configurada com verify_jwt=false (o 17TRACK não envia JWT); a autenticidade
// vem exclusivamente da assinatura. Mesmo espírito do mp-webhook.

import { jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { parseTrackInfo, type TrackInfo } from "../_shared/track17.ts";

const TRACK17_API_KEY = Deno.env.get("TRACK17_API_KEY");

interface Track17Push {
  event?: string;
  data?: {
    number?: string;
    carrier?: number;
    track_info?: TrackInfo;
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }
  if (!TRACK17_API_KEY) {
    console.error("TRACK17_API_KEY ausente. Configure via `supabase secrets set`.");
    return jsonResponse({ error: "Configuração incompleta." }, 500);
  }

  // O corpo CRU é obrigatório para a assinatura — não reserialize o JSON.
  const rawBody = await req.text();
  const providedSign = req.headers.get("sign") ?? "";
  const expected = await sha256Hex(`${rawBody}/${TRACK17_API_KEY}`);
  if (!timingSafeEqual(expected, providedSign)) {
    console.warn("Assinatura 17TRACK inválida — push rejeitado.");
    return jsonResponse({ error: "Assinatura inválida." }, 401);
  }

  let push: Track17Push;
  try {
    push = JSON.parse(rawBody) as Track17Push;
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  // Só tratamos atualização de rastreio (ignoramos outros eventos sem erro).
  if (push.event && push.event !== "TRACKING_UPDATED") {
    return jsonResponse({ received: true });
  }

  const number = typeof push.data?.number === "string" ? push.data.number.trim() : "";
  if (!number) return jsonResponse({ received: true });

  const parsed = push.data?.track_info ? parseTrackInfo(push.data.track_info) : null;

  try {
    const supabase = createAdminClient();

    const update: Record<string, unknown> = {
      tracking_synced_at: new Date().toISOString(),
    };
    if (parsed) {
      update.tracking_status = parsed.status;
      update.tracking_events = parsed.events;
    }
    if (push.data?.carrier) update.carrier = push.data.carrier;

    // Localiza o pedido pelo número de rastreio e aplica a atualização.
    const { data: order, error } = await supabase
      .from("orders")
      .update(update)
      .eq("tracking_code", number)
      .select("id, status")
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      console.warn(`Push 17TRACK para número sem pedido correspondente: ${number}`);
      return jsonResponse({ received: true });
    }

    // Entregue: promove o status do pedido (apenas a partir de 'shipped').
    if (parsed?.internalStatus === "delivered" && order.status === "shipped") {
      await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", order.id)
        .eq("status", "shipped");
    }

    return jsonResponse({ received: true });
  } catch (e) {
    console.error("tracking-webhook falhou:", e);
    return jsonResponse({ error: "Erro interno." }, 500);
  }
});

/** SHA-256 em hexadecimal de uma string. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante para não vazar informação por timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
