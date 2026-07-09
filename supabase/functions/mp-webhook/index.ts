// mp-webhook
// Recebe as notificações do Mercado Pago. Valida a assinatura x-signature
// (HMAC-SHA256 com MP_WEBHOOK_SECRET), consulta o pagamento na API do MP e
// atualiza orders.status. Configurada com verify_jwt=false (o MP não envia JWT);
// a autenticidade vem da assinatura.

import { jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }
  if (!MP_ACCESS_TOKEN || !MP_WEBHOOK_SECRET) {
    console.error("MP_ACCESS_TOKEN/MP_WEBHOOK_SECRET ausentes.");
    return jsonResponse({ error: "Configuração incompleta." }, 500);
  }

  const url = new URL(req.url);
  // O id do recurso pode vir na query (?data.id=) ou no corpo (data.id).
  let dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    // Algumas notificações vêm sem corpo JSON — seguimos com a query string.
  }
  if (!dataId && payload.data && typeof payload.data === "object") {
    const inner = payload.data as Record<string, unknown>;
    dataId = String(inner.id ?? "");
  }

  const signatureValid = await verifySignature(req, dataId);
  if (!signatureValid) {
    console.warn("Assinatura x-signature inválida — notificação rejeitada.");
    return jsonResponse({ error: "Assinatura inválida." }, 401);
  }

  // Só tratamos eventos de pagamento.
  const type = String(payload.type ?? url.searchParams.get("type") ?? "");
  if (type && type !== "payment") {
    return jsonResponse({ received: true });
  }
  if (!dataId) return jsonResponse({ received: true });

  try {
    // Consulta a fonte de verdade do MP (nunca confiamos só no corpo do webhook).
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpResponse.ok) {
      console.error("Falha ao consultar pagamento no MP:", mpResponse.status);
      return jsonResponse({ error: "Falha ao consultar pagamento." }, 502);
    }

    const payment = (await mpResponse.json()) as Record<string, unknown>;
    const status = String(payment.status ?? "");
    const statusDetail = String(payment.status_detail ?? "");
    const externalReference = String(payment.external_reference ?? "");

    if (!externalReference) {
      return jsonResponse({ received: true });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("orders")
      .update({
        status: mapMpStatus(status),
        mp_status_detail: statusDetail,
        mp_payment_id: String(payment.id ?? dataId),
      })
      .eq("id", externalReference);

    if (error) throw error;

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("mp-webhook falhou:", error);
    return jsonResponse({ error: "Erro interno." }, 500);
  }
});

/**
 * Valida o header x-signature do MP.
 * Formato: "ts=<timestamp>,v1=<hash>". O manifest assinado é
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` e o hash é HMAC-SHA256
 * do manifest com MP_WEBHOOK_SECRET.
 */
async function verifySignature(req: Request, dataId: string): Promise<boolean> {
  const signature = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id") ?? "";
  if (!signature || !dataId) return false;

  let ts = "";
  let v1 = "";
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  if (!ts || !v1) return false;

  // O MP normaliza o id para minúsculas no manifest.
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const expected = [...new Uint8Array(signed)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, v1);
}

/** Comparação em tempo constante para não vazar informação por timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function mapMpStatus(mpStatus: string): string {
  switch (mpStatus) {
    case "approved":
      return "paid";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      return "processing";
  }
}
