import { product } from "../config/product";
import { formatBRL, installmentCents } from "../lib/money";

const perks = [
  "Frete grátis para todo o Brasil",
  "Envio com código de rastreio",
  "Garantia de 90 dias contra defeitos",
  "Troca ou devolução em até 7 dias",
];

export default function Offer() {
  const installment = formatBRL(installmentCents(product.priceCents, product.maxInstallments));

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-page items-center gap-12 px-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Oferta de lançamento.
          </h2>
          <p className="mt-3 max-w-md text-lg text-white/60">
            Preço promocional válido enquanto durar o estoque desta remessa.
          </p>

          <ul className="mt-8 space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-white/85">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0 text-cyan-300"
                  aria-hidden="true"
                >
                  <path d="M4.5 12.5l5 5L19.5 7" />
                </svg>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass relative overflow-hidden p-8 sm:p-10">
          {/* reflexo diagonal no vidro */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-400/25 to-violet-500/20 blur-3xl"
          />

          {product.stockLeft !== null && (
            <p className="relative inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/15 px-4 py-1.5 text-sm font-semibold text-amber-300 backdrop-blur-md">
              <span aria-hidden="true">⚡</span>
              Restam apenas {product.stockLeft} unidades
            </p>
          )}

          <p className="relative mt-6 text-sm uppercase tracking-[0.25em] text-white/50">
            {product.name}
          </p>

          <div className="relative mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {product.compareAtPriceCents !== null && (
              <span className="text-lg text-white/40 line-through">
                {formatBRL(product.compareAtPriceCents)}
              </span>
            )}
            <span className="font-display text-5xl font-black tracking-tight sm:text-6xl">
              {formatBRL(product.priceCents)}
            </span>
          </div>

          <p className="relative mt-2 text-white/70">
            ou <strong className="text-white">{product.maxInstallments}x de {installment}</strong>{" "}
            sem juros no cartão
          </p>

          <a href="#checkout" className="btn-gradient relative mt-8 block px-8 py-4 text-center text-base">
            Garantir o meu
          </a>

          <p className="relative mt-4 text-center text-xs text-white/45">
            Você não será cobrado agora — o pagamento é confirmado na próxima etapa.
          </p>
        </div>
      </div>
    </section>
  );
}
