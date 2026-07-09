// process-payment
// Recebe { orderId, formData } vindo do Payment Brick e cria o pagamento na API
// do Mercado Pago. O valor cobrado (transaction_amount) é SEMPRE recalculado a
// partir do amount_cents gravado no pedido — qualquer valor no formData do
// cliente é sobrescrito. Suporta cartão e Pix.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

interface ProcessPaymentBody {
  orderId?: unknown;
  // formData do Payment Brick: shape varia entre cartão e Pix.
  formData?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }
  if (!MP_ACCESS_TOKEN) {
    console.error("MP_ACCESS_TOKEN ausente. Configure via `supabase secrets set`.");
    return jsonResponse({ error: "Pagamento indisponível no momento." }, 500);
  }

  let body: ProcessPaymentBody;
  try {
    body = (await req.json()) as ProcessPaymentBody;
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const formData = body.formData;
  if (!orderId || typeof formData !== "object" || formData === null) {
    return jsonResponse({ error: "Dados de pagamento incompletos." }, 400);
  }

  try {
    const supabase = createAdminClient();

    // Busca o pedido para obter o valor autoritativo e evitar recobrança.
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, amount_cents, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: "Pedido não encontrado." }, 404);
    if (order.status === "paid") {
      return jsonResponse({ error: "Este pedido já foi pago." }, 409);
    }

    // Monta o pagamento MP a partir do formData, mas o valor vem do BANCO.
    const paymentPayload: Record<string, unknown> = {
      ...formData,
      transaction_amount: order.amount_cents / 100,
      description: `Pedido ${order.id}`,
      external_reference: order.id,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
    };

    await supabase.from("orders").update({ status: "processing" }).eq("id", order.id);

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        // Idempotência: reenvios do mesmo pedido não geram cobrança dupla.
        "X-Idempotency-Key": order.id,
      },
      body: JSON.stringify(paymentPayload),
    });

    const payment = (await mpResponse.json()) as Record<string, unknown>;

    if (!mpResponse.ok) {
      console.error("Mercado Pago recusou a criação do pagamento:", payment);
      await supabase.from("orders").update({ status: "pending" }).eq("id", order.id);
      return jsonResponse({ error: "Não foi possível processar o pagamento." }, 502);
    }

    const paymentId = String(payment.id ?? "");
    const status = String(payment.status ?? "");
    const statusDetail = String(payment.status_detail ?? "");
    const paymentMethod = String(payment.payment_method_id ?? "");

    const nextStatus = mapMpStatus(status);
    await supabase
      .from("orders")
      .update({
        mp_payment_id: paymentId,
        mp_status_detail: statusDetail,
        payment_method: paymentMethod,
        status: nextStatus,
      })
      .eq("id", order.id);

    // Dados do Pix (QR code + copia-e-cola), quando aplicável.
    const poi = payment.point_of_interaction as
      | { transaction_data?: Record<string, unknown> }
      | undefined;
    const txData = poi?.transaction_data;

    return jsonResponse({
      orderId: order.id,
      paymentId,
      status,
      statusDetail,
      pix: txData
        ? {
            qrCode: String(txData.qr_code ?? ""),
            qrCodeBase64: String(txData.qr_code_base64 ?? ""),
            ticketUrl: String(txData.ticket_url ?? ""),
          }
        : null,
    });
  } catch (error) {
    console.error("process-payment falhou:", error);
    return jsonResponse({ error: "Falha ao processar o pagamento." }, 500);
  }
});

/** Traduz o status do MP para o enum de orders.status. */
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
    // pending / in_process / authorized (ex.: Pix aguardando pagamento)
    default:
      return "processing";
  }
}
