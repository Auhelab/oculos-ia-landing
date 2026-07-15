// create-order
// Recebe o payload do checkout (SEM preço), revalida no servidor, busca o preço
// na tabela products a partir do productId e insere um pedido com status=pending.
// Devolve { orderId, amountCents } — o amount vem do BANCO, nunca do cliente.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { parseCheckoutPayload } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const parsed = parseCheckoutPayload(body);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  const { productId, customer, address } = parsed.value;

  try {
    const supabase = createAdminClient();

    // Preço autoritativo: sempre do banco, ignorando qualquer valor do cliente.
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select("price_cents, active")
      .eq("id", productId)
      .maybeSingle();

    if (productError) throw productError;
    if (!productRow || !productRow.active) {
      return jsonResponse({ error: "Produto indisponível." }, 400);
    }

    const amountCents: number = productRow.price_cents;

    const { data: orderRow, error: insertError } = await supabase
      .from("orders")
      .insert({
        product_id: productId,
        amount_cents: amountCents,
        status: "pending",
        customer_name: customer.fullName,
        customer_cpf: customer.cpf,
        customer_email: customer.email,
        customer_whatsapp: customer.whatsapp,
        address_cep: address.cep,
        address_street: address.street,
        address_number: address.number,
        address_complement: address.complement,
        address_neighborhood: address.neighborhood,
        address_city: address.city,
        address_state: address.state,
      })
      .select("id, amount_cents, order_number")
      .single();

    if (insertError) throw insertError;

    return jsonResponse({
      orderId: orderRow.id,
      amountCents: orderRow.amount_cents,
      orderNumber: orderRow.order_number,
    });
  } catch (error) {
    console.error("create-order falhou:", error);
    return jsonResponse({ error: "Não foi possível criar o pedido." }, 500);
  }
});
