// admin-orders
// Painel administrativo dos pedidos. Protegida por uma chave estática
// (ADMIN_API_KEY) enviada no header `x-admin-key` — NÃO usa o JWT do Supabase
// (verify_jwt=false), então a autenticação é feita aqui, com comparação em
// tempo constante. Como as tabelas têm RLS sem policy pública, só a service
// role (dentro desta função) enxerga os pedidos.
//
// Ações (POST { action, ... }):
//   { action: "list", status? }              → lista os pedidos (mais recentes).
//   { action: "ship", orderId, trackingCode, trackingUrl? }
//                                            → grava rastreio, marca 'shipped'
//                                              e dispara o e-mail de despacho.
//   { action: "deliver", orderId }           → marca 'delivered'.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { sendShippedEmailOnce } from "../_shared/order-mailer.ts";
import {
  register17Track,
  track17Configured,
  track17PublicUrl,
} from "../_shared/track17.ts";

const ADMIN_API_KEY = Deno.env.get("ADMIN_API_KEY");

const LIST_COLUMNS =
  "id, order_number, status, mp_status_detail, payment_method, amount_cents, created_at, updated_at," +
  " customer_name, customer_email, customer_whatsapp, customer_cpf," +
  " address_street, address_number, address_complement, address_neighborhood," +
  " address_city, address_state, address_cep, tracking_code, tracking_url, shipped_at";

/** Comparação em tempo constante para não vazar a chave por timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }
  if (!ADMIN_API_KEY) {
    console.error("ADMIN_API_KEY ausente. Configure via `supabase secrets set`.");
    return jsonResponse({ error: "Painel indisponível." }, 500);
  }

  // Autenticação do admin.
  const provided = req.headers.get("x-admin-key") ?? "";
  if (!safeEqual(provided, ADMIN_API_KEY)) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const supabase = createAdminClient();

  try {
    if (action === "list") {
      let query = supabase
        .from("orders")
        .select(LIST_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(200);

      if (typeof body.status === "string" && body.status) {
        query = query.eq("status", body.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ orders: data ?? [] });
    }

    if (action === "ship") {
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      const trackingCode =
        typeof body.trackingCode === "string" ? body.trackingCode.trim() : "";
      const trackingUrl =
        typeof body.trackingUrl === "string" ? body.trackingUrl.trim() : "";
      if (!orderId || !trackingCode) {
        return jsonResponse({ error: "orderId e trackingCode são obrigatórios." }, 400);
      }

      // URL de rastreio: usa a informada ou, se o 17TRACK estiver ativo, cai
      // na página pública dele (o cliente acompanha mesmo antes do 1º push).
      const publicUrl =
        trackingUrl || (track17Configured() ? track17PublicUrl(trackingCode) : "");

      // Só permite despachar pedidos pagos (ou já despachados, p/ corrigir código).
      const { data: updated, error } = await supabase
        .from("orders")
        .update({
          tracking_code: trackingCode,
          tracking_url: publicUrl || null,
          status: "shipped",
          shipped_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .in("status", ["paid", "shipped"])
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!updated) {
        return jsonResponse(
          { error: "Pedido não encontrado ou ainda não pago." },
          409,
        );
      }

      // Registra o número no 17TRACK para acompanhamento automático via webhook.
      // Best-effort: nunca falha o despacho se o 17TRACK estiver indisponível.
      if (track17Configured()) {
        const reg = await register17Track(trackingCode, orderId);
        if (reg.ok && reg.carrier) {
          await supabase
            .from("orders")
            .update({ carrier: reg.carrier })
            .eq("id", orderId);
        } else if (!reg.ok) {
          console.warn("register 17TRACK falhou:", reg.error);
        }
      }

      // E-mail de despacho (idempotente).
      await sendShippedEmailOnce(supabase, orderId);
      return jsonResponse({ ok: true });
    }

    if (action === "deliver") {
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      if (!orderId) return jsonResponse({ error: "orderId é obrigatório." }, 400);

      const { data: updated, error } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", orderId)
        .eq("status", "shipped")
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!updated) {
        return jsonResponse({ error: "Pedido não encontrado ou não despachado." }, 409);
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Ação desconhecida." }, 400);
  } catch (error) {
    console.error("admin-orders falhou:", error);
    return jsonResponse({ error: "Erro interno." }, 500);
  }
});
