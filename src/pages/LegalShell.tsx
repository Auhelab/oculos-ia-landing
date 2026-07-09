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
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-white/[0.04] py-6 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6">
          <a href="#/" className="font-display text-lg font-bold tracking-tight text-white">
            {product.name}
          </a>
          <a href="#/" className="text-sm text-white/60 transition hover:text-white">
            ← Voltar à loja
          </a>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Última atualização: julho de 2026 · Documento placeholder — substituir pelo texto
          jurídico definitivo antes do lançamento.
        </p>
        <div className="glass mt-8 space-y-6 p-6 text-[15px] leading-relaxed text-white/70 sm:p-10">
          {children}
        </div>
      </article>
    </main>
  );
}
