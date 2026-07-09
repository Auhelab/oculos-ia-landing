import { onlyDigits } from "./digits";

/** Aplica a máscara 000.000.000-00 progressivamente enquanto o usuário digita. */
export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  let out = digits.slice(0, 3);
  if (digits.length > 3) out += "." + digits.slice(3, 6);
  if (digits.length > 6) out += "." + digits.slice(6, 9);
  if (digits.length > 9) out += "-" + digits.slice(9, 11);
  return out;
}

/**
 * Valida CPF pelo algoritmo oficial dos dígitos verificadores:
 * cada um dos 2 últimos dígitos é o resto de (soma ponderada * 10) mod 11,
 * com pesos decrescentes e resto 10 tratado como 0.
 */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  // Sequências como 111.111.111-11 passam na conta, mas são inválidas.
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
