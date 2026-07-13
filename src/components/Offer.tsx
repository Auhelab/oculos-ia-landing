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
    <section id="oferta" className="py-24 sm:py-32">
      <div className="mx-auto grid max-w-page items-center gap-12 px-6 lg:grid-cols-2">
        <div data-reveal>
          <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-5xl">
            Oferta de lançamento.
          </h2>
          <p className="mt-3 max-w-md text-lg text-ink-soft">
            Preço promocional válido enquanto durar o estoque desta remessa.
          </p>

          <ul className="mt-8 space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-ink">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0 text-accent"
                  aria-hidden="true"
                >
                  <path d="M4.5 12.5l5 5L19.5 7" />
                </svg>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div
          data-reveal
          style={{ transitionDelay: "120ms" }}
          className="card-white p-8 shadow-[0_12px_48px_rgba(0,0,0,0.08)] sm:p-10"
        >
          {product.stockLeft !== null && (
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
              <span aria-hidden="true">⚡</span>
              Restam apenas {product.stockLeft} unidades
            </p>
          )}

          <p className="eyebrow mt-6">{product.name}</p>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {product.compareAtPriceCents !== null && (
              <span className="text-lg text-ink-soft line-through">
                {formatBRL(product.compareAtPriceCents)}
              </span>
            )}
            <span className="text-5xl font-bold tracking-[-0.02em] sm:text-6xl">
              {formatBRL(product.priceCents)}
            </span>
          </div>

          <p className="mt-2 text-ink-soft">
            ou{" "}
            <strong className="font-semibold text-ink">
              {product.maxInstallments}x de {installment}
            </strong>{" "}
            sem juros no cartão
          </p>

          <a href="#checkout" className="btn-primary mt-8 w-full px-8 py-4 text-base">
            Garantir o meu
          </a>

          <p className="mt-4 text-center text-xs text-ink-soft">
            Você não será cobrado agora — o pagamento é confirmado na próxima etapa.
          </p>
        </div>
      </div>
    </section>
  );
}
