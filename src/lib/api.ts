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

async function postFunction<T>(name: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(functionsUrl(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.supabaseAnonKey}`,
        apikey: env.supabaseAnonKey,
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
