// Rótulos e estilos dos status de pedido, compartilhados entre a página de
// rastreio (cliente) e o painel admin. Mantém a nomenclatura em um só lugar.

export interface StatusMeta {
  label: string;
  /** Classes Tailwind para um "chip" (borda + fundo + texto). */
  chip: string;
}

const META: Record<string, StatusMeta> = {
  pending: { label: "Aguardando pagamento", chip: "border-line bg-haze text-ink-soft" },
  processing: { label: "Processando", chip: "border-amber-200 bg-amber-50 text-amber-700" },
  paid: { label: "Pagamento aprovado", chip: "border-green-200 bg-green-50 text-green-700" },
  shipped: { label: "Enviado", chip: "border-blue-200 bg-blue-50 text-blue-700" },
  delivered: { label: "Entregue", chip: "border-green-200 bg-green-50 text-green-700" },
  rejected: { label: "Não aprovado", chip: "border-red-200 bg-red-50 text-red-700" },
  cancelled: { label: "Cancelado", chip: "border-red-200 bg-red-50 text-red-700" },
  refunded: { label: "Reembolsado", chip: "border-line bg-haze text-ink-soft" },
};

export function statusMeta(status: string): StatusMeta {
  return META[status] ?? { label: status, chip: "border-line bg-haze text-ink-soft" };
}

/** Etapas visíveis da jornada de entrega, na ordem. */
export const JOURNEY: { key: string; label: string }[] = [
  { key: "paid", label: "Pagamento aprovado" },
  { key: "shipped", label: "Enviado" },
  { key: "delivered", label: "Entregue" },
];

/** Índice da etapa atual na jornada (−1 se antes de "paid"). */
export function journeyIndex(status: string): number {
  if (status === "delivered") return 2;
  if (status === "shipped") return 1;
  if (status === "paid") return 0;
  return -1;
}
