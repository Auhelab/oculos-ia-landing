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
 * Layout base dos e-mails (tabelas + estilos inline, compatível com a maioria
 * dos clientes). Recebe o conteúdo interno já montado.
 */
export function emailLayout(opts: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#0b1020;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1020;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111a33;border:1px solid #22305c;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:28px 32px 8px;">
            <div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8ab4ff;">Óculos Inteligentes IA</div>
          </td></tr>
          <tr><td style="padding:8px 32px 32px;color:#e7ecf7;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#ffffff;">${escapeHtml(opts.title)}</h1>
            ${opts.body}
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #22305c;color:#7f8db3;font-size:12px;line-height:1.6;">
            Você recebeu este e-mail porque fez um pedido em nossa loja.<br/>
            Em caso de dúvida, basta responder a esta mensagem.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Botão call-to-action reutilizável (só renderiza quando há URL). */
export function ctaButton(label: string, url: string): string {
  if (!url) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;">
    <tr><td style="border-radius:10px;background:linear-gradient(90deg,#6d5cff,#39b6ff);">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}
