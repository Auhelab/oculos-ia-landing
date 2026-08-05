// process-payment
// Recebe { orderId, formData } vindo do Payment Brick e cria o pagamento na API
// do Mercado Pago. O valor cobrado (transaction_amount) é SEMPRE recalculado a
// partir do amount_cents gravado no pedido — qualquer valor no formData do
// cliente é sobrescrito. Suporta cartão e Pix.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { sendPaidEmailOnce } from "../_shared/order-mailer.ts";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

// Validade do Pix: o MP cancela o pagamento após esse prazo e notifica o
// webhook, que marca o pedido como rejeitado. Manter em sincronia com o
// contador PIX_TTL_SECONDS exibido no PaymentStep do frontend.
//
// NUNCA baixar de 8 minutos. Medido em produção em 05/08/2026: com 5 minutos o
// Mercado Pago aceita a criação (HTTP 201, status pending) e cancela a cobrança
// 3-4 segundos depois com status_detail "expired" — o cliente recebe um QR que
// o banco recusa. De 8 minutos em diante a cobrança se mantém pending.
const PIX_EXPIRATION_MINUTES = 10;

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
      .select("id, amount_cents, status, mp_payment_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: "Pedido não encontrado." }, 404);
    if (order.status === "paid") {
      return jsonResponse({ error: "Este pedido já foi pago." }, 409);
    }

    // Um pedido só pode ter UM pagamento vivo por vez. Se já existe um anterior
    // — o caso real é o Pix gerado antes de o cliente voltar e escolher cartão —
    // ele morre aqui. Sem isso os dois ficam pagáveis ao mesmo tempo e o cliente
    // pode pagar duas vezes sem que nada no sistema perceba.
    const isPix =
      String((formData as Record<string, unknown>).payment_method_id ?? "") === "pix";

    if (order.mp_payment_id) {
      const previous = await fetchPayment(order.mp_payment_id);
      const previousStatus = String(previous?.status ?? "");

      // O anterior já estava pago e o webhook ainda não tinha chegado: não cobra
      // de novo. Devolve como aprovado para o cliente seguir para a confirmação.
      if (previousStatus === "approved") {
        const statusDetail = String(previous?.status_detail ?? "accredited");
        await supabase
          .from("orders")
          .update({ status: "paid", mp_status_detail: statusDetail })
          .eq("id", order.id);
        await sendPaidEmailOnce(supabase, order.id);

        return jsonResponse({
          orderId: order.id,
          paymentId: order.mp_payment_id,
          status: "approved",
          statusDetail,
          pix: null,
        });
      }

      if (previousStatus === "pending" || previousStatus === "in_process") {
        // Pix ainda vivo e o cliente pediu Pix de novo (duplo clique, recarregar
        // a página): devolve o MESMO código. Criar outro mataria este — e quem
        // estivesse com ele aberto no banco levaria recusa.
        if (isPix && String(previous?.payment_method_id ?? "") === "pix") {
          return jsonResponse({
            orderId: order.id,
            paymentId: order.mp_payment_id,
            status: previousStatus,
            statusDetail: String(previous?.status_detail ?? ""),
            pix: extractPix(previous),
          });
        }

        // Trocou de meio de pagamento (ex.: do Pix para o cartão): aí sim o
        // anterior precisa morrer, senão os dois ficam pagáveis.
        await cancelPayment(order.mp_payment_id);
      }
    }

    // Monta o pagamento MP a partir do formData, mas o valor vem do BANCO.
    const paymentPayload: Record<string, unknown> = {
      ...formData,
      transaction_amount: order.amount_cents / 100,
      description: `Pedido ${order.id}`,
      external_reference: order.id,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
    };

    // Pix expira em PIX_EXPIRATION_MINUTES — o MP cancela sozinho e o webhook
    // rejeita o pedido. Cartão não leva o campo (aprovação é síncrona).
    if (isPix) {
      paymentPayload.date_of_expiration = new Date(
        Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000,
      )
        .toISOString()
        .replace("Z", "+00:00");
    }

    await supabase.from("orders").update({ status: "processing" }).eq("id", order.id);

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        // Idempotência: duplo-clique no mesmo pedido não gera cobrança dupla
        // (mesma chave). Após um pagamento cancelado/expirado/rejeitado, a
        // chave muda (inclui o id do pagamento anterior) — sem isso o MP
        // devolveria o mesmo pagamento morto no retry.
        "X-Idempotency-Key": order.mp_payment_id
          ? `${order.id}:${order.mp_payment_id}`
          : order.id,
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

    // Pagamento aprovado de imediato (ex.: cartão): dispara a confirmação por
    // e-mail. É idempotente — o webhook, se chegar depois, não reenvia.
    if (nextStatus === "paid") {
      await sendPaidEmailOnce(supabase, order.id);
    }

    return jsonResponse({
      orderId: order.id,
      paymentId,
      status,
      statusDetail,
      // Dados do Pix (QR code + copia-e-cola), quando aplicável.
      pix: extractPix(payment),
    });
  } catch (error) {
    console.error("process-payment falhou:", error);
    return jsonResponse({ error: "Falha ao processar o pagamento." }, 500);
  }
});

/**
 * Consulta um pagamento no MP. Devolve null quando não foi possível ler — nesse
 * caso o chamador segue o fluxo normal, sem bloquear a venda.
 */
async function fetchPayment(paymentId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      console.warn(`Não foi possível consultar o pagamento ${paymentId}:`, res.status);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (error) {
    console.warn(`Falha ao consultar o pagamento ${paymentId}:`, error);
    return null;
  }
}

/** Cancela um pagamento ainda vivo no MP. Nunca lança. */
async function cancelPayment(paymentId: string): Promise<void> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) {
      console.warn(`Não foi possível cancelar o pagamento ${paymentId}:`, res.status);
    }
  } catch (error) {
    console.warn(`Falha ao cancelar o pagamento ${paymentId}:`, error);
  }
}

/** Extrai QR code e copia-e-cola do Pix, quando o pagamento tiver. */
function extractPix(payment: Record<string, unknown> | null) {
  const poi = payment?.point_of_interaction as
    | { transaction_data?: Record<string, unknown> }
    | undefined;
  const txData = poi?.transaction_data;
  if (!txData) return null;
  return {
    qrCode: String(txData.qr_code ?? ""),
    qrCodeBase64: String(txData.qr_code_base64 ?? ""),
    ticketUrl: String(txData.ticket_url ?? ""),
  };
}

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
