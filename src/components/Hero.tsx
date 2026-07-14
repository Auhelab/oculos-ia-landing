import { product } from "../config/product";
import { formatBRL, installmentCents } from "../lib/money";
import Dot from "./Dot";

const [taglineLead, taglineTail] = product.tagline.split(" · ");

export default function Hero() {
  const installment = formatBRL(installmentCents(product.priceCents, product.maxInstallments));

  return (
    <section className="overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-page flex-col items-center justify-center px-6 py-16 text-center">
        <p className="eyebrow animate-fade-up" style={{ animationDelay: "0ms" }}>
          Novo <Dot /> Lançamento 2026
        </p>

        <h1
          className="animate-fade-up mt-4 max-w-3xl text-[2.75rem] font-bold leading-[1.05] tracking-[0.01em] sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "100ms" }}
        >
          {product.name}
        </h1>

        <p
          className="animate-fade-up mt-5 max-w-2xl text-lg text-ink-soft sm:text-2xl"
          style={{ animationDelay: "200ms" }}
        >
          {taglineLead}
          {taglineTail && (
            <>
              <Dot />
              {taglineTail}
            </>
          )}
        </p>

        <div
          className="animate-fade-up mt-8 flex flex-col items-center gap-5 sm:flex-row"
          style={{ animationDelay: "300ms" }}
        >
          <a href="#checkout" className="btn-primary px-8">
            Comprar
          </a>
          <a href="#recursos" className="btn-quiet">
            Ver recursos
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </a>
        </div>

        <p
          className="animate-fade-up mt-4 text-sm text-ink-soft"
          style={{ animationDelay: "360ms" }}
        >
          {formatBRL(product.priceCents)} ou {product.maxInstallments}x de {installment} sem
          juros <Dot /> Frete grátis
        </p>

        {/* Sem imagem estática aqui: o produto aparece uma única vez, girando,
            quando o scroll entra no SpinShowcase logo abaixo. */}
        <span
          aria-hidden="true"
          className="animate-fade-up mt-10 text-ink-soft"
          style={{ animationDelay: "560ms" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 animate-bounce">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </span>
      </div>
    </section>
  );
}
