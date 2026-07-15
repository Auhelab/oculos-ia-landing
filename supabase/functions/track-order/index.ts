// track-order
// Consulta pública de status/rastreio de um pedido. Para evitar enumeração de
// pedidos, exige o par { orderId, email }: só retorna dados se o e-mail bater
// com o do pedido. Nunca expõe CPF, endereço completo ou dados de pagamento.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface TrackBody {
  orderId?: unknown;
  email?: unknown;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!orderId || !email) {
    return jsonResponse({ error: "Informe o número do pedido e o e-mail." }, 400);
  }

  // Aceita o número legível (#318798 / 318798) ou o UUID legado. Só-dígitos após
  // remover "#" e espaços → busca por order_number; senão → busca pelo id (UUID).
  const cleaned = orderId.replace(/[#\s]/g, "");
  const byNumber = /^\d+$/.test(cleaned);

  try {
    const supabase = createAdminClient();
    const baseQuery = supabase
      .from("orders")
      .select(
        "id, order_number, status, amount_cents, created_at, shipped_at, tracking_code, tracking_url, customer_email",
      );
    const { data, error } = await (byNumber
      ? baseQuery.eq("order_number", Number(cleaned))
      : baseQuery.eq("id", orderId)
    ).maybeSingle();

    if (error) throw error;

    // Mensagem única para pedido inexistente OU e-mail divergente — não revela
    // qual dos dois falhou.
    if (!data || String(data.customer_email).toLowerCase() !== email) {
      return jsonResponse(
        { error: "Não encontramos um pedido com esses dados. Confira e tente de novo." },
        404,
      );
    }

    return jsonResponse({
      orderId: data.id,
      orderNumber: data.order_number,
      status: data.status,
      amountCents: data.amount_cents,
      createdAt: data.created_at,
      shippedAt: data.shipped_at,
      trackingCode: data.tracking_code,
      trackingUrl: data.tracking_url,
    });
  } catch (error) {
    console.error("track-order falhou:", error);
    return jsonResponse({ error: "Não foi possível consultar o pedido agora." }, 500);
  }
});
