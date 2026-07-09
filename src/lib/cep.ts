import { onlyDigits } from "./digits";

/** Aplica a máscara 00000-000 progressivamente enquanto o usuário digita. */
export function maskCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  /** ViaCEP devolve { erro: true } (ou "true") para CEP com formato válido mas inexistente. */
  erro?: boolean | string;
}

export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type CepLookupResult =
  | { ok: true; address: CepAddress }
  | { ok: false; reason: "not_found" | "network" };

/**
 * Busca o endereço de um CEP na API pública ViaCEP.
 * Lança AbortError se o `signal` for abortado (caller decide ignorar);
 * qualquer outra falha vira `{ ok: false }` com o motivo.
 */
export async function fetchAddressByCep(
  cep: string,
  signal?: AbortSignal,
): Promise<CepLookupResult> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return { ok: false, reason: "not_found" };

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    if (!response.ok) return { ok: false, reason: "network" };

    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) return { ok: false, reason: "not_found" };

    return {
      ok: true,
      address: {
        street: data.logradouro ?? "",
        neighborhood: data.bairro ?? "",
        city: data.localidade ?? "",
        state: data.uf ?? "",
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, reason: "network" };
  }
}
