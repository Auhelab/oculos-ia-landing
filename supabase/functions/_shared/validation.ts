// Revalidação server-side do payload do checkout.
// Reimplementa as MESMAS regras de src/lib/ (cpf, phone, cep) — o servidor
// nunca confia na validação do cliente. Nada aqui lê ou aceita preço.

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** CPF válido pelos dígitos verificadores oficiais (espelha src/lib/cpf.ts). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10]);
}

/** Celular BR: 11 dígitos, DDD não inicia com 0, nono dígito = 9. */
export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 11 && digits[0] !== "0" && digits[2] === "9";
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

function isValidEmail(value: string): boolean {
  // Validação pragmática, alinhada ao z.string().email() do frontend.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export interface CheckoutCustomer {
  fullName: string;
  cpf: string;
  email: string;
  whatsapp: string;
}

export interface CheckoutAddress {
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
}

export interface CheckoutPayload {
  productId: string;
  customer: CheckoutCustomer;
  address: CheckoutAddress;
}

export type ParseResult =
  | { ok: true; value: CheckoutPayload }
  | { ok: false; error: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Valida e normaliza o payload recebido do frontend.
 * IMPORTANTE: qualquer campo de preço/valor no corpo é ignorado — só usamos
 * productId, customer e address. O valor é buscado no banco a partir do productId.
 */
export function parseCheckoutPayload(input: unknown): ParseResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Corpo da requisição inválido." };
  }

  const body = input as Record<string, unknown>;
  const productId = asString(body.productId);
  if (!productId) return { ok: false, error: "productId é obrigatório." };

  const customerRaw = (body.customer ?? {}) as Record<string, unknown>;
  const addressRaw = (body.address ?? {}) as Record<string, unknown>;

  const fullName = asString(customerRaw.fullName);
  const cpf = onlyDigits(asString(customerRaw.cpf));
  const email = asString(customerRaw.email);
  const whatsapp = onlyDigits(asString(customerRaw.whatsapp));

  // Exige nome + sobrenome: pelo menos 2 partes, cada uma com >= 2 letras
  // (rejeita "Henrique", "H B", "Henrique 1"). Espelha a regra do frontend.
  const namedParts = fullName
    .split(/\s+/)
    .filter((part) => (part.match(/\p{L}/gu) ?? []).length >= 2);
  if (namedParts.length < 2) {
    return { ok: false, error: "Informe nome e sobrenome." };
  }
  if (cpf && !isValidCpf(cpf)) return { ok: false, error: "CPF inválido." };
  if (!isValidEmail(email)) return { ok: false, error: "E-mail inválido." };
  if (!isValidPhone(whatsapp)) return { ok: false, error: "WhatsApp inválido." };

  const cep = onlyDigits(asString(addressRaw.cep));
  const street = asString(addressRaw.street);
  const number = asString(addressRaw.number);
  const complementRaw = asString(addressRaw.complement);
  const neighborhood = asString(addressRaw.neighborhood);
  const city = asString(addressRaw.city);
  const state = asString(addressRaw.state).toUpperCase();

  if (!isValidCep(cep)) return { ok: false, error: "CEP inválido." };
  if (!street) return { ok: false, error: "Rua obrigatória." };
  if (!number) return { ok: false, error: "Número obrigatório." };
  if (!neighborhood) return { ok: false, error: "Bairro obrigatório." };
  if (!city) return { ok: false, error: "Cidade obrigatória." };
  if (!/^[A-Z]{2}$/.test(state)) return { ok: false, error: "UF inválida." };

  return {
    ok: true,
    value: {
      productId,
      customer: { fullName, cpf, email, whatsapp },
      address: {
        cep,
        street,
        number,
        complement: complementRaw === "" ? null : complementRaw,
        neighborhood,
        city,
        state,
      },
    },
  };
}
