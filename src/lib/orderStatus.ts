// Rótulos e estilos dos status de pedido, compartilhados entre a página de
// rastreio (cliente) e o painel admin. Mantém a nomenclatura em um só lugar.

export interface StatusMeta {
  label: string;
  /** Classes Tailwind para um "chip" (borda + fundo + texto). */
  chip: string;
}

const META: Record<string, StatusMeta> = {
  pending: { label: "Aguardando pagamento", chip: "border-white/15 bg-white/5 text-white/70" },
  processing: { label: "Processando", chip: "border-amber-300/30 bg-amber-300/10 text-amber-200" },
  paid: { label: "Pagamento aprovado", chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  shipped: { label: "Enviado", chip: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" },
  delivered: { label: "Entregue", chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  rejected: { label: "Não aprovado", chip: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
  cancelled: { label: "Cancelado", chip: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
  refunded: { label: "Reembolsado", chip: "border-white/15 bg-white/5 text-white/70" },
};

export function statusMeta(status: string): StatusMeta {
  return META[status] ?? { label: status, chip: "border-white/15 bg-white/5 text-white/70" };
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
