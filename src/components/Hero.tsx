import { product } from "../config/product";
import { formatBRL, installmentCents } from "../lib/money";

const highlights = ["Frete grátis", "12x sem juros", "Envio rastreado"];

export default function Hero() {
  const heroImage = product.images[0];
  const installment = formatBRL(installmentCents(product.priceCents, product.maxInstallments));

  return (
    <section className="relative overflow-hidden">
      <div className="relative mx-auto flex min-h-[92svh] max-w-page flex-col items-center px-6 pb-16 pt-24 text-center sm:pt-28">
        <p
          className="glass-pill animate-fade-up px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300"
          style={{ animationDelay: "0ms" }}
        >
          Lançamento 2026
        </p>

        <h1
          className="animate-fade-up mt-6 font-display text-4xl font-black leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "120ms" }}
        >
          {product.name}
        </h1>

        <p
          className="animate-fade-up mt-5 max-w-xl text-lg text-white/65 sm:text-2xl"
          style={{ animationDelay: "240ms" }}
        >
          {product.tagline}
        </p>

        <div
          className="animate-fade-up mt-8 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: "360ms" }}
        >
          <a href="#checkout" className="btn-gradient px-9 py-4 text-base">
            Comprar agora
          </a>
          <p className="text-sm text-white/60">
            {formatBRL(product.priceCents)} ou {product.maxInstallments}x de {installment}
          </p>
        </div>

        <ul
          className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "480ms" }}
        >
          {highlights.map((item) => (
            <li key={item} className="glass-pill px-4 py-1.5 text-sm text-white/75">
              {item}
            </li>
          ))}
        </ul>

        <div
          className="animate-fade-up relative mt-10 w-full max-w-2xl"
          style={{ animationDelay: "600ms" }}
        >
          <img
            src={heroImage.src}
            alt={heroImage.alt}
            width={800}
            height={480}
            className="w-full drop-shadow-[0_40px_60px_rgba(0,0,0,0.55)]"
          />
        </div>

        <a
          href="#beneficios"
          className="animate-fade-up mt-6 text-sm font-medium text-cyan-300 hover:underline"
          style={{ animationDelay: "720ms" }}
        >
          Saiba mais ↓
        </a>
      </div>
    </section>
  );
}
