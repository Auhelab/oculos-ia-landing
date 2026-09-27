// Envio de e-mail transacional via Resend (https://resend.com).
// Uma única dependência de rede (fetch), sem SDK. Configuração por secrets:
//   RESEND_API_KEY  — chave da API do Resend (obrigatória p/ enviar).
//   EMAIL_FROM      — remetente verificado, ex.: "Óculos IA <pedidos@sualoja.com.br>".
//   STORE_URL       — base pública da loja, usada nos links dos e-mails (opcional).
// Se RESEND_API_KEY estiver ausente, o envio é ignorado silenciosamente (log
// de aviso) para NUNCA quebrar o fluxo de pagamento por causa de e-mail.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Óculos IA <onboarding@resend.dev>";
export const STORE_URL = (Deno.env.get("STORE_URL") ?? "").replace(/\/+$/, "");

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envia um e-mail. Devolve true em sucesso, false caso contrário — nunca lança,
 * para que uma falha de e-mail não derrube a confirmação do pedido.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY ausente — e-mail transacional NÃO enviado:", subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("Resend recusou o envio:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Falha ao chamar o Resend:", error);
    return false;
  }
}

/** Formata centavos como moeda BR (ex.: 39990 → "R$ 399,90"). */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Escapa texto para interpolação segura em HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Paleta do design system da loja (tailwind.config.ts), repetida aqui porque
 * e-mail não lê o CSS do site: tudo precisa ir inline. Mudou um token lá,
 * muda aqui também.
 */
export const EMAIL_COLORS = {
  ink: "#1d1d1f", // texto primário
  inkSoft: "#6e6e73", // texto secundário
  haze: "#f5f5f7", // fundo da página e superfícies
  line: "#d2d2d7", // bordas mais marcadas
  lineSoft: "#e8e8ed", // divisores sutis
  accent: "#15803d", // única cor de ação (verde da marca)
  accentSoft: "#f0fdf4", // fundo de destaque positivo
  warn: "#b45309", // aviso (âmbar do selo de estoque)
  warnSoft: "#fffbeb",
} as const;

const C = EMAIL_COLORS;

/** Mesma pilha de fontes do site; clientes sem web font caem na do sistema. */
export const EMAIL_FONT =
  "'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Layout base dos e-mails (tabelas + estilos inline, compatível com a maioria
 * dos clientes). Recebe o conteúdo interno já montado. Visual espelha o site:
 * fundo cinza-claro, card branco de cantos largos, logo "ab" no topo e o verde
 * da marca como única cor de ação.
 */
export function emailLayout(opts: { title: string; body: string; preheader?: string; footer?: string }): string {
  // Pré-cabeçalho: texto de prévia exibido na caixa de entrada, invisível no corpo.
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>`
    : "";
  const storeHost = STORE_URL.replace(/^https?:\/\//, "");
  const storeLink = STORE_URL
    ? `<br/><a href="${escapeHtml(STORE_URL)}" style="color:${C.accent};text-decoration:none;">${escapeHtml(storeHost)}</a>`
    : "";
  // Logo "ab" da Auhelab, o mesmo da barra do site. Sem STORE_URL não há de
  // onde servir a imagem, então cai para o nome em texto.
  const brand = STORE_URL
    ? `<img src="${escapeHtml(STORE_URL)}/images/logo-ab.png" alt="Smart Glasses" width="39" height="28" style="display:block;height:28px;width:auto;border:0;" />`
    : `<div style="font-size:15px;font-weight:700;color:${C.ink};">Smart Glasses</div>`;
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;padding:0;background:${C.haze};font-family:${EMAIL_FONT};-webkit-font-smoothing:antialiased;">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.haze};padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr><td style="padding:0 8px 18px;">${brand}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.lineSoft};border-radius:24px;overflow:hidden;">
          <tr><td style="padding:36px 36px 8px;">
            <div style="font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${C.inkSoft};">Smart Glasses</div>
          </td></tr>
          <tr><td style="padding:8px 36px 36px;color:${C.ink};">
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${escapeHtml(opts.title)}</h1>
            ${opts.body}
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr><td style="padding:20px 8px;color:${C.inkSoft};font-size:12px;line-height:1.6;">
            ${opts.footer ?? "Você recebeu este e-mail porque fez um pedido em nossa loja. Em caso de dúvida, basta responder a esta mensagem."}<br/>
            Smart Glasses · Auhelab${storeLink}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Botão call-to-action: a mesma pílula verde do site (só renderiza com URL).
 * O verde vai também como background-image: o modo escuro do Gmail no iPhone
 * apaga background-color e o botão sumia, mas não mexe em gradiente.
 */
export function ctaButton(label: string, url: string): string {
  if (!url) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td bgcolor="${C.accent}" style="border-radius:999px;background-color:${C.accent};background-image:linear-gradient(${C.accent},${C.accent});">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 30px;font-family:${EMAIL_FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;background-image:linear-gradient(${C.accent},${C.accent});">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}
