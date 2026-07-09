const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata centavos como moeda brasileira: 24990 → "R$ 249,90". */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * Valor de cada parcela em centavos, arredondado para cima
 * (exibição apenas — o cálculo real acontecerá no backend).
 */
export function installmentCents(totalCents: number, installments: number): number {
  return Math.ceil(totalCents / installments);
}
