// Disparo dos e-mails transacionais do pedido, com idempotência garantida por
// claim atômico. Cada e-mail (pago / despachado) só é enviado uma vez: fazemos
// um UPDATE condicional na coluna *_email_sent_at (só quando ainda é NULL) e
// só enviamos se ESSE update retornou a linha — assim, se process-payment e o
// mp-webhook confirmarem o mesmo pedido, apenas o primeiro dispara o e-mail.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  ctaButton,
  emailLayout,
  escapeHtml,
  formatBRL,
  sendEmail,
  STORE_URL,
} from "./email.ts";

/** Colunas do pedido usadas na montagem dos e-mails. */
const ORDER_COLUMNS =
  "id, customer_name, customer_email, amount_cents, status, tracking_code, tracking_url," +
  " address_street, address_number, address_neighborhood, address_city, address_state, address_cep";

interface OrderRow {
  id: string;
  customer_name: string;
  customer_email: string;
  amount_cents: number;
  status: string;
  tracking_code: string | null;
  tracking_url: string | null;
  address_street: string;
  address_number: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_cep: string;
}

const STORE_NAME = "Óculos Inteligentes IA";

/** Link para a página de rastreio, já com o pedido pré-preenchido. */
function trackUrl(orderId: string): string {
  if (!STORE_URL) return "";
  return `${STORE_URL}/#/rastreio?pedido=${encodeURIComponent(orderId)}`;
}

/** Primeiro nome do cliente, para uma saudação mais pessoal. */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/**
 * Envia o e-mail de "pagamento aprovado" no máximo uma vez por pedido.
 * Deve ser chamado somente quando o pedido está efetivamente pago.
 */
export async function sendPaidEmailOnce(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  // Claim atômico: só vence quem transformar o NULL em timestamp.
  const { data, error } = await supabase
    .from("orders")
    .update({ paid_email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("paid_email_sent_at", null)
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Falha ao reivindicar e-mail de pagamento:", error);
    return;
  }
  if (!data) return; // já enviado por outro caminho.

  const order = data as OrderRow;
  const ok = await sendEmail({
    to: order.customer_email,
    subject: `Pagamento aprovado — pedido ${shortId(order.id)}`,
    html: paidEmailHtml(order),
  });

  // Se o envio falhar, libera o claim para uma nova tentativa (ex.: webhook).
  if (!ok) {
    await supabase
      .from("orders")
      .update({ paid_email_sent_at: null })
      .eq("id", order.id);
  }
}

/**
 * Envia o e-mail de "pedido despachado" (com rastreio) no máximo uma vez.
 * Chamado quando o admin registra o código de rastreio.
 */
export async function sendShippedEmailOnce(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("orders")
    .update({ shipped_email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("shipped_email_sent_at", null)
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Falha ao reivindicar e-mail de despacho:", error);
    return;
  }
  if (!data) return;

  const order = data as OrderRow;
  const ok = await sendEmail({
    to: order.customer_email,
    subject: `Seu pedido ${shortId(order.id)} foi enviado 📦`,
    html: shippedEmailHtml(order),
  });

  if (!ok) {
    await supabase
      .from("orders")
      .update({ shipped_email_sent_at: null })
      .eq("id", order.id);
  }
}

/** Id curto e legível para assuntos de e-mail (primeiro bloco do UUID). */
function shortId(id: string): string {
  return id.split("-")[0].toUpperCase();
}

function addressLine(o: OrderRow): string {
  return escapeHtml(
    `${o.address_street}, ${o.address_number} — ${o.address_neighborhood}, ` +
      `${o.address_city}/${o.address_state} — CEP ${o.address_cep}`,
  );
}

function paidEmailHtml(o: OrderRow): string {
  const body = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#c9d3ea;">
      Olá, ${escapeHtml(firstName(o.customer_name))}! Recebemos a confirmação do seu pagamento.
      Já estamos preparando o envio do seu <strong style="color:#fff;">${STORE_NAME}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #22305c;border-radius:12px;">
      <tr><td style="padding:16px 18px;font-size:14px;line-height:1.7;color:#c9d3ea;">
        <div style="color:#7f8db3;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Pedido</div>
        <div style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#fff;">${escapeHtml(o.id)}</div>
        <div style="margin-top:10px;color:#7f8db3;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Valor pago</div>
        <div style="color:#fff;font-weight:700;font-size:16px;">${formatBRL(o.amount_cents)}</div>
        <div style="margin-top:10px;color:#7f8db3;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Entrega</div>
        <div>${addressLine(o)}</div>
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#c9d3ea;">
      Assim que o produto for despachado, enviaremos o código de rastreio por aqui.
    </p>
    ${ctaButton("Acompanhar meu pedido", trackUrl(o.id))}
  `;
  return emailLayout({ title: "Pagamento aprovado! 🎉", body });
}

function shippedEmailHtml(o: OrderRow): string {
  const code = o.tracking_code ? escapeHtml(o.tracking_code) : "";
  const codeBlock = code
    ? `<div style="margin:16px 0;padding:14px 18px;border:1px dashed #39b6ff;border-radius:12px;text-align:center;">
         <div style="color:#7f8db3;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Código de rastreio</div>
         <div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:20px;font-weight:700;color:#fff;letter-spacing:.05em;">${code}</div>
       </div>`
    : "";
  const body = `
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#c9d3ea;">
      Boas notícias, ${escapeHtml(firstName(o.customer_name))}! Seu
      <strong style="color:#fff;">${STORE_NAME}</strong> saiu para entrega.
    </p>
    ${codeBlock}
    ${ctaButton("Rastrear entrega", o.tracking_url ?? trackUrl(o.id))}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#7f8db3;">
      O código pode levar algumas horas para aparecer no site do transportador.
    </p>
  `;
  return emailLayout({ title: "Seu pedido está a caminho 📦", body });
}
