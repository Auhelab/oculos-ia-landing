// Cliente das Edge Functions do Supabase. Envia a anon key no header e devolve
// erros amigáveis. NUNCA envia preço — o valor é fixado no servidor.

import { env, functionsUrl } from "../config/env";

/** Payload do checkout enviado ao servidor. Sem preço, por design. */
export interface CheckoutPayload {
  productId: string;
  customer: {
    fullName: string;
    cpf: string;
    email: string;
    whatsapp: string;
  };
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
  };
}

export interface CreateOrderResult {
  orderId: string;
  amountCents: number;
  orderNumber: number;
}

export interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
}

export interface ProcessPaymentResult {
  orderId: string;
  paymentId: string;
  status: string;
  statusDetail: string;
  pix: PixData | null;
}

/** Erro com mensagem já pronta para exibição ao usuário. */
export class ApiError extends Error {}

async function postFunction<T>(
  name: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(functionsUrl(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.supabaseAnonKey}`,
        apikey: env.supabaseAnonKey,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Não foi possível conectar. Verifique sua internet e tente de novo.");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Resposta sem corpo JSON.
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : "Algo deu errado. Tente novamente em instantes.";
    throw new ApiError(message);
  }

  return data as T;
}

export function createOrder(payload: CheckoutPayload): Promise<CreateOrderResult> {
  return postFunction<CreateOrderResult>("create-order", payload);
}

export function processPayment(
  orderId: string,
  formData: unknown,
): Promise<ProcessPaymentResult> {
  return postFunction<ProcessPaymentResult>("process-payment", { orderId, formData });
}

// ---------------------------------------------------------------------------
// Rastreio do pedido (cliente) — função track-order.
// ---------------------------------------------------------------------------

export interface TrackingEvent {
  time: string | null;
  description: string;
  location: string | null;
  stage: string | null;
}

export interface TrackResult {
  orderId: string;
  orderNumber: number | null;
  status: string;
  amountCents: number;
  createdAt: string;
  shippedAt: string | null;
  trackingCode: string | null;
  trackingUrl: string | null;
  trackingStatus: string | null;
  trackingEvents: TrackingEvent[] | null;
}

export function trackOrder(orderId: string, email: string): Promise<TrackResult> {
  return postFunction<TrackResult>("track-order", { orderId, email });
}

// ---------------------------------------------------------------------------
// Painel administrativo — função admin-orders (autenticada por x-admin-key).
// ---------------------------------------------------------------------------

export interface AdminOrder {
  id: string;
  order_number: number | null;
  status: string;
  mp_status_detail: string | null;
  payment_method: string | null;
  amount_cents: number;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  customer_whatsapp: string;
  customer_cpf: string;
  address_street: string;
  address_number: string;
  address_complement: string | null;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_cep: string;
  tracking_code: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
}

function adminHeaders(adminKey: string): Record<string, string> {
  return { "x-admin-key": adminKey };
}

export function adminListOrders(
  adminKey: string,
  status?: string,
): Promise<{ orders: AdminOrder[] }> {
  return postFunction<{ orders: AdminOrder[] }>(
    "admin-orders",
    { action: "list", status },
    adminHeaders(adminKey),
  );
}

export function adminShipOrder(
  adminKey: string,
  orderId: string,
  trackingCode: string,
  trackingUrl?: string,
): Promise<{ ok: true }> {
  return postFunction<{ ok: true }>(
    "admin-orders",
    { action: "ship", orderId, trackingCode, trackingUrl },
    adminHeaders(adminKey),
  );
}

export function adminDeliverOrder(
  adminKey: string,
  orderId: string,
): Promise<{ ok: true }> {
  return postFunction<{ ok: true }>(
    "admin-orders",
    { action: "deliver", orderId },
    adminHeaders(adminKey),
  );
}
