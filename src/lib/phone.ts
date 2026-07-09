import { onlyDigits } from "./digits";

/** Aplica a máscara (00) 00000-0000 progressivamente enquanto o usuário digita. */
export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Valida celular brasileiro: 11 dígitos, DDD válido (não começa com 0)
 * e nono dígito 9 — formato exigido pelo WhatsApp.
 */
export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 11 && digits[0] !== "0" && digits[2] === "9";
}
