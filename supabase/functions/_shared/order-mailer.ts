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
  "id, order_number, customer_name, customer_email, amount_cents, status, tracking_code, tracking_url," +
  " address_street, address_number, address_neighborhood, address_city, address_state, address_cep," +
  " address_complement, payment_method, created_at";

interface OrderRow {
  id: string;
  order_number: number | null;
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
  address_complement: string | null;
  payment_method: string | null;
  created_at: string;
}

const STORE_NAME = "Óculos Inteligentes IA";

/** Link para a página de rastreio, já com o pedido pré-preenchido. */
function trackUrl(orderRef: string): string {
  if (!STORE_URL) return "";
  return `${STORE_URL}/#/rastreio?pedido=${encodeURIComponent(orderRef)}`;
}

/** Número legível do pedido (#318798) com fallback pro id curto legado. */
function orderLabel(o: OrderRow): string {
  return o.order_number != null ? `#${o.order_number}` : shortId(o.id);
}

/** Referência usada no rastreio: número quando existir, senão o UUID. */
function orderRef(o: OrderRow): string {
  return o.order_number != null ? String(o.order_number) : o.id;
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
    subject: `Pagamento confirmado — pedido ${orderLabel(order)}`,
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
    subject: `Pedido ${orderLabel(order)} enviado — código de rastreio`,
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
  const complement = o.address_complement?.trim() ? ` (${o.address_complement.trim()})` : "";
  return escapeHtml(
    `${o.address_street}, ${o.address_number}${complement} — ${o.address_neighborhood}, ` +
      `${o.address_city}/${o.address_state} — CEP ${o.address_cep}`,
  );
}

// ---------------------------------------------------------------------------
// Blocos visuais compartilhados pelos modelos de e-mail (estilos inline).
// ---------------------------------------------------------------------------

/** Prazo de entrega divulgado na loja (FAQ, rodapé e Termos de Uso). */
const DELIVERY_WINDOW = "15 a 40 dias úteis";

function paragraph(html: string, muted = false): string {
  const color = muted ? "#7f8db3" : "#c9d3ea";
  const size = muted ? "13px" : "15px";
  return `<p style="margin:0 0 14px;font-size:${size};line-height:1.65;color:${color};">${html}</p>`;
}

function strong(text: string): string {
  return `<strong style="color:#ffffff;">${text}</strong>`;
}

function sectionHeading(text: string): string {
  return `<div style="margin:24px 0 10px;color:#8ab4ff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">${escapeHtml(text)}</div>`;
}

/** Tabela "rótulo → valor" com o resumo do pedido. Valores já em HTML seguro. */
function detailsTable(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value], i) => `
      <tr>
        <td style="padding:10px 16px;${i ? "border-top:1px solid #22305c;" : ""}color:#7f8db3;font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:10px 16px;${i ? "border-top:1px solid #22305c;" : ""}color:#e7ecf7;font-size:14px;line-height:1.5;text-align:right;">${value}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;border:1px solid #22305c;border-radius:12px;border-collapse:separate;">${cells}</table>`;
}

/** Linha do tempo das etapas do pedido. */
function stepsList(steps: Array<{ title: string; text: string; state: "done" | "current" | "next" }>): string {
  const rows = steps
    .map((s, i) => {
      const dot = s.state === "done"
        ? `<div style="width:22px;height:22px;border-radius:11px;background:#39b6ff;color:#0b1020;font-size:13px;font-weight:700;line-height:22px;text-align:center;">✓</div>`
        : s.state === "current"
        ? `<div style="width:20px;height:20px;border-radius:11px;border:1px solid #39b6ff;color:#39b6ff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">${i + 1}</div>`
        : `<div style="width:20px;height:20px;border-radius:11px;border:1px solid #33416b;color:#7f8db3;font-size:12px;line-height:20px;text-align:center;">${i + 1}</div>`;
      const titleColor = s.state === "next" ? "#c9d3ea" : "#ffffff";
      return `
      <tr>
        <td style="width:34px;padding:0 0 14px;vertical-align:top;">${dot}</td>
        <td style="padding:1px 0 14px;vertical-align:top;">
          <div style="color:${titleColor};font-size:14px;font-weight:700;">${escapeHtml(s.title)}</div>
          <div style="color:#9aa8cc;font-size:13px;line-height:1.55;">${s.text}</div>
        </td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 4px;">${rows}</table>`;
}

/** Caixa de destaque para avisos importantes. */
function noticeBox(html: string, tone: "info" | "warning" = "info"): string {
  const border = tone === "warning" ? "#f5b54a" : "#39b6ff";
  return `<div style="margin:18px 0;padding:14px 16px;border-left:3px solid ${border};background:#0d1530;border-radius:8px;font-size:13px;line-height:1.6;color:#c9d3ea;">${html}</div>`;
}

/** Nome amigável da forma de pagamento (payment_method_id do Mercado Pago). */
function paymentMethodLabel(method: string | null): string {
  if (!method) return "—";
  const brands: Record<string, string> = {
    pix: "Pix",
    visa: "Cartão Visa",
    master: "Cartão Mastercard",
    elo: "Cartão Elo",
    amex: "Cartão American Express",
    hipercard: "Cartão Hipercard",
    cabal: "Cartão Cabal",
    debvisa: "Débito Visa",
    debmaster: "Débito Mastercard",
    debelo: "Débito Elo",
  };
  return brands[method] ?? "Cartão";
}

/** Data do pedido no fuso de Brasília (ex.: 17/09/2026). */
function orderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function greeting(o: OrderRow): string {
  const name = firstName(o.customer_name);
  return name ? `Olá, ${escapeHtml(name)}.` : "Olá.";
}

function mono(text: string): string {
  return `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#ffffff;">${escapeHtml(text)}</span>`;
}

// ---------------------------------------------------------------------------
// Modelos de e-mail
// ---------------------------------------------------------------------------

function paidEmailHtml(o: OrderRow): string {
  const label = orderLabel(o);
  const body = `
    ${paragraph(greeting(o))}
    ${paragraph(
      `Confirmamos o pagamento do seu pedido ${strong(escapeHtml(label))}. Obrigado pela confiança.
       A partir de agora cuidamos de todas as etapas e avisaremos você por e-mail a cada
       atualização importante.`,
    )}
    ${sectionHeading("Resumo do pedido")}
    ${detailsTable([
      ["Pedido", mono(label)],
      ["Data", escapeHtml(orderDate(o.created_at))],
      ["Produto", escapeHtml(STORE_NAME)],
      ["Forma de pagamento", escapeHtml(paymentMethodLabel(o.payment_method))],
      ["Total pago", `<strong style="color:#ffffff;font-size:16px;">${formatBRL(o.amount_cents)}</strong>`],
      ["Entrega em", addressLine(o)],
    ])}
    ${noticeBox(
      `${strong("Confira o endereço de entrega.")} Se algo estiver incorreto, responda este e-mail
       o quanto antes: conseguimos corrigir enquanto o pedido ainda não foi postado.`,
      "warning",
    )}
    ${sectionHeading("Próximas etapas")}
    ${stepsList([
      { title: "Pagamento confirmado", text: "Recebemos a confirmação do Mercado Pago.", state: "done" },
      {
        title: "Preparação e envio",
        text: "Separamos e embalamos seu pedido. Ao ser postado, você recebe o código de rastreio por e-mail.",
        state: "current",
      },
      {
        title: "Entrega",
        text: `Prazo estimado de ${DELIVERY_WINDOW}, conforme a sua região.`,
        state: "next",
      },
    ])}
    ${ctaButton("Acompanhar meu pedido", trackUrl(orderRef(o)))}
    ${paragraph(
      `O pagamento foi processado pelo Mercado Pago, e a cobrança pode aparecer com esse nome na
       fatura ou no extrato. Guarde este e-mail como comprovante da sua compra.`,
      true,
    )}
  `;
  return emailLayout({
    title: "Pagamento confirmado",
    preheader: `Recebemos o pagamento de ${formatBRL(o.amount_cents)} do pedido ${label}. Veja o resumo e as próximas etapas.`,
    body,
  });
}

function shippedEmailHtml(o: OrderRow): string {
  const label = orderLabel(o);
  const code = o.tracking_code ? escapeHtml(o.tracking_code) : "";
  const codeBlock = code
    ? `<div style="margin:18px 0;padding:16px 18px;border:1px dashed #39b6ff;border-radius:12px;text-align:center;">
         <div style="color:#7f8db3;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Código de rastreio</div>
         <div style="margin-top:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:20px;font-weight:700;color:#fff;letter-spacing:.05em;">${code}</div>
       </div>`
    : "";
  const body = `
    ${paragraph(greeting(o))}
    ${paragraph(
      `Seu pedido ${strong(escapeHtml(label))} foi postado e já está com a transportadora.
       Use o código abaixo para acompanhar cada movimentação até a entrega.`,
    )}
    ${codeBlock}
    ${ctaButton("Rastrear entrega", o.tracking_url ?? trackUrl(orderRef(o)))}
    ${sectionHeading("Andamento")}
    ${stepsList([
      { title: "Pagamento confirmado", text: "Concluído.", state: "done" },
      { title: "Pedido enviado", text: "Postado e em trânsito com a transportadora.", state: "done" },
      {
        title: "Entrega",
        text: `Prazo estimado de ${DELIVERY_WINDOW}, conforme a sua região. Avisaremos por e-mail quando for entregue.`,
        state: "current",
      },
    ])}
    ${sectionHeading("Endereço de entrega")}
    ${paragraph(addressLine(o))}
    ${noticeBox(
      `${strong("Bom saber:")} o rastreio pode levar alguns dias para exibir as primeiras
       movimentações, e em alguns trechos do transporte as atualizações ficam mais espaçadas.
       Isso é normal. Se notar algo fora do esperado, responda este e-mail que verificamos
       com a transportadora para você.`,
    )}
  `;
  return emailLayout({
    title: "Seu pedido foi enviado",
    preheader: code
      ? `Pedido ${label} a caminho. Código de rastreio: ${o.tracking_code}.`
      : `Pedido ${label} a caminho. Acompanhe a entrega pelo link.`,
    body,
  });
}

/**
 * Envia o e-mail de "pedido entregue" no máximo uma vez.
 * Chamado quando o pedido vira 'delivered' (17TRACK ou painel admin). O claim
 * exige o status 'delivered' para nunca avisar entrega de um pedido que não
 * foi entregue.
 */
export async function sendDeliveredEmailOnce(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("orders")
    .update({ delivered_email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "delivered")
    .is("delivered_email_sent_at", null)
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Falha ao reivindicar e-mail de entrega:", error);
    return;
  }
  if (!data) return;

  const order = data as unknown as OrderRow;
  const ok = await sendEmail({
    to: order.customer_email,
    subject: `Pedido ${orderLabel(order)} entregue`,
    html: deliveredEmailHtml(order),
  });

  if (!ok) {
    await supabase
      .from("orders")
      .update({ delivered_email_sent_at: null })
      .eq("id", order.id);
  }
}

/** Motivo da falha de pagamento que justifica avisar o cliente. */
type PaymentFailure = "rejected" | "pix_expired";

/**
 * Classifica o retorno do MP. Só avisamos o cliente em dois casos:
 *  - status "rejected": o banco/emissor recusou (ex.: cartão);
 *  - status "cancelled" com detalhe "expired": o Pix venceu sem pagamento.
 * Qualquer outro cancelamento é ignorado de propósito — o principal é o
 * cancelamento que o próprio process-payment faz quando o cliente troca o Pix
 * pelo cartão, e avisar "pagamento recusado" nesse momento seria falso.
 */
function classifyPaymentFailure(mpStatus: string, statusDetail: string): PaymentFailure | null {
  if (mpStatus === "rejected") return "rejected";
  if (mpStatus === "cancelled" && statusDetail === "expired") return "pix_expired";
  return null;
}

/**
 * Envia o e-mail de "pagamento não concluído" (recusado ou Pix expirado) no
 * máximo uma vez por pedido. Recebe o status CRU do Mercado Pago, que é o que
 * distingue recusa, Pix expirado e cancelamento interno. O claim exige o
 * pedido ainda em 'rejected': se ele já foi pago por outro caminho, não envia.
 */
export async function sendPaymentFailedEmailOnce(
  supabase: SupabaseClient,
  orderId: string,
  mpStatus: string,
  statusDetail: string,
): Promise<void> {
  const failure = classifyPaymentFailure(mpStatus, statusDetail);
  if (!failure) return;

  const { data, error } = await supabase
    .from("orders")
    .update({ payment_failed_email_sent_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "rejected")
    .is("payment_failed_email_sent_at", null)
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Falha ao reivindicar e-mail de pagamento não concluído:", error);
    return;
  }
  if (!data) return;

  const order = data as unknown as OrderRow;
  const ok = await sendEmail({
    to: order.customer_email,
    subject: failure === "pix_expired"
      ? `Seu Pix expirou — pedido ${orderLabel(order)}`
      : `Pagamento não aprovado — pedido ${orderLabel(order)}`,
    html: paymentFailedEmailHtml(order, failure, statusDetail),
  });

  if (!ok) {
    await supabase
      .from("orders")
      .update({ payment_failed_email_sent_at: null })
      .eq("id", order.id);
  }
}

/** Link de volta ao checkout da landing. */
function checkoutUrl(): string {
  if (!STORE_URL) return "";
  return `${STORE_URL}/#checkout`;
}

function deliveredEmailHtml(o: OrderRow): string {
  const label = orderLabel(o);
  const body = `
    ${paragraph(greeting(o))}
    ${paragraph(
      `A transportadora registrou a entrega do seu pedido ${strong(escapeHtml(label))}.
       Esperamos que aproveite seus ${strong(STORE_NAME)}.`,
    )}
    ${detailsTable([
      ["Pedido", mono(label)],
      ["Endereço", addressLine(o)],
    ])}
    ${noticeBox(
      `${strong("Não recebeu o pacote?")} Às vezes a transportadora marca a entrega antes de ela
       acontecer, ou o pacote fica com um vizinho ou na portaria. Se não encontrar, responda este
       e-mail o quanto antes que abrimos uma verificação com a transportadora.`,
      "warning",
    )}
    ${sectionHeading("Seus direitos como cliente")}
    ${stepsList([
      {
        title: "Arrependimento em até 7 dias",
        text: "Você pode desistir da compra em até 7 dias corridos após o recebimento, com reembolso integral (art. 49 do Código de Defesa do Consumidor).",
        state: "next",
      },
      {
        title: "Garantia de 90 dias",
        text: "Cobertura contra defeitos de fabricação a partir do recebimento.",
        state: "next",
      },
    ])}
    ${paragraph(
      `Para usar qualquer um deles, ou se tiver dúvidas sobre o produto, basta responder este e-mail
       informando o número do pedido.`,
    )}
    ${ctaButton("Ver detalhes do pedido", trackUrl(orderRef(o)))}
  `;
  return emailLayout({
    title: "Pedido entregue",
    preheader: `A entrega do pedido ${label} foi confirmada. Veja como falar com a gente se precisar.`,
    body,
  });
}

/**
 * Motivo legível da recusa a partir do status_detail do Mercado Pago. Só
 * detalhamos quando o motivo é útil ao cliente; nos demais casos, uma
 * explicação genérica.
 */
function rejectionReason(statusDetail: string): { reason: string; action: string } | null {
  switch (statusDetail) {
    case "cc_rejected_insufficient_amount":
      return {
        reason: "o cartão não tinha limite disponível para o valor da compra",
        action: "Tente com outro cartão ou pague com Pix.",
      };
    case "cc_rejected_bad_filled_security_code":
      return {
        reason: "o código de segurança (CVV) informado não confere",
        action: "Confira os 3 ou 4 dígitos no verso do cartão e tente novamente.",
      };
    case "cc_rejected_bad_filled_date":
      return {
        reason: "a data de validade informada não confere",
        action: "Confira a validade impressa no cartão e tente novamente.",
      };
    case "cc_rejected_bad_filled_card_number":
    case "cc_rejected_bad_filled_other":
      return {
        reason: "algum dado do cartão foi informado incorretamente",
        action: "Revise número, nome, validade e CVV e tente novamente.",
      };
    case "cc_rejected_call_for_authorize":
      return {
        reason: "o banco emissor pediu autorização prévia para esta compra",
        action: "Entre em contato com seu banco para autorizar o pagamento e tente novamente, ou pague com Pix.",
      };
    case "cc_rejected_card_disabled":
      return {
        reason: "o cartão está inativo ou bloqueado para compras online",
        action: "Ative o cartão com seu banco, use outro cartão ou pague com Pix.",
      };
    case "cc_rejected_max_attempts":
      return {
        reason: "o limite de tentativas com este cartão foi atingido",
        action: "Aguarde algumas horas, use outro cartão ou pague com Pix.",
      };
    case "cc_rejected_duplicated_payment":
      return {
        reason: "já existia um pagamento idêntico recente",
        action: "Verifique se você já recebeu nossa confirmação de pagamento antes de tentar de novo.",
      };
    case "cc_rejected_high_risk":
    case "cc_rejected_blacklist":
      return {
        reason: "a análise de segurança antifraude não aprovou a transação",
        action: "Recomendamos concluir a compra com Pix, que tem aprovação imediata.",
      };
    default:
      return null;
  }
}

function paymentFailedEmailHtml(o: OrderRow, failure: PaymentFailure, statusDetail = ""): string {
  const label = orderLabel(o);
  const isPix = failure === "pix_expired";
  const detail = isPix ? null : rejectionReason(statusDetail);

  const intro = isPix
    ? `O código Pix gerado para o pedido ${strong(escapeHtml(label))} venceu sem que o pagamento
       fosse identificado. ${strong("Nenhum valor foi cobrado")}, e o pedido não segue para envio
       enquanto o pagamento não for concluído.`
    : `O pagamento do pedido ${strong(escapeHtml(label))} não foi aprovado.
       ${strong("Nenhum valor foi cobrado")}, e o pedido não segue para envio enquanto o
       pagamento não for concluído.`;

  const reasonBlock = isPix
    ? ""
    : detail
    ? `${sectionHeading("Motivo informado pela operadora")}
       ${paragraph(`Segundo o Mercado Pago, ${escapeHtml(detail.reason)}. ${escapeHtml(detail.action)}`)}`
    : `${sectionHeading("Motivos mais comuns")}
       ${stepsList([
         { title: "Limite insuficiente", text: "O valor da compra ultrapassa o limite disponível do cartão.", state: "next" },
         { title: "Dados divergentes", text: "Número, validade ou código de segurança digitados com diferença.", state: "next" },
         {
           title: "Bloqueio preventivo do banco",
           text: "Alguns bancos bloqueiam compras online por segurança. Uma ligação ou notificação no app do banco costuma liberar.",
           state: "next",
         },
       ])}`;

  const body = `
    ${paragraph(greeting(o))}
    ${paragraph(intro)}
    ${detailsTable([
      ["Pedido", mono(label)],
      ["Produto", escapeHtml(STORE_NAME)],
      ["Valor", `<strong style="color:#ffffff;">${formatBRL(o.amount_cents)}</strong>`],
      ["Situação", `<span style="color:#f5b54a;">Aguardando pagamento</span>`],
    ])}
    ${reasonBlock}
    ${sectionHeading("Como concluir sua compra")}
    ${paragraph(
      isPix
        ? `Basta voltar à loja e gerar um novo pagamento. Pelo Pix a confirmação é imediata e o
           pedido segue para preparação logo em seguida. Se preferir, também é possível pagar com cartão.`
        : `Volte à loja e tente novamente com outro cartão ou com Pix, que tem confirmação imediata.`,
    )}
    ${ctaButton(isPix ? "Gerar novo pagamento" : "Tentar novamente", checkoutUrl())}
    ${noticeBox(
      isPix
        ? `${strong("Pagou e o valor saiu da sua conta?")} Responda este e-mail com o comprovante
           que verificamos e resolvemos com prioridade.`
        : `${strong("Segurança:")} não armazenamos os dados do seu cartão. O pagamento é processado
           diretamente pelo Mercado Pago, com criptografia.`,
    )}
    ${paragraph("Se você já concluiu a compra, pode desconsiderar este e-mail.", true)}
  `;
  return emailLayout({
    title: isPix ? "O prazo do seu Pix expirou" : "Pagamento não aprovado",
    preheader: isPix
      ? `O Pix do pedido ${label} venceu e nada foi cobrado. Gere um novo pagamento em poucos segundos.`
      : `Nada foi cobrado no pedido ${label}. Veja o motivo e como concluir sua compra.`,
    body,
  });
}
