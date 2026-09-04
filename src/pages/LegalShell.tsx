import { useEffect } from "react";
import type { ReactNode } from "react";
import { product } from "../config/product";

interface LegalShellProps {
  title: string;
  children: ReactNode;
}

/** Layout compartilhado das páginas legais (Termos de Uso e Política de Privacidade). */
export default function LegalShell({ title, children }: LegalShellProps) {
  useEffect(() => {
    document.title = `${title} | ${product.name}`;
    // "instant" para não herdar o scroll-behavior:smooth do html
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [title]);

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-line-soft bg-white/80 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6">
          <a href="#/" className="text-[15px] font-semibold tracking-tight text-ink">
            {product.name}
          </a>
          <a href="#/" className="text-sm text-ink-soft transition hover:text-ink">
            ← Voltar à loja
          </a>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Última atualização: julho de 2026 · Documento placeholder · substituir pelo texto
          jurídico definitivo antes do lançamento.
        </p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink-soft">
          {children}
        </div>
      </article>
    </main>
  );
}
