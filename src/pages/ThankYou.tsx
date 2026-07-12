import { useEffect, useState } from "react";
import { product } from "../config/product";

const ORDER_STORAGE_KEY = "lp:lastPaidOrder";

/** Guarda o pedido aprovado para exibição na página de obrigado. */
export function rememberPaidOrder(orderId: string): void {
  try {
    sessionStorage.setItem(ORDER_STORAGE_KEY, orderId);
  } catch {
    // sessionStorage indisponível (modo privado) — a página ainda funciona sem o id.
  }
}

export default function ThankYou() {
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Pedido confirmado | ${product.name}`;
    window.scrollTo(0, 0);
    try {
      setOrderId(sessionStorage.getItem(ORDER_STORAGE_KEY));
    } catch {
      setOrderId(null);
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass w-full max-w-lg p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-3xl">
          ✅
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Pagamento aprovado!
        </h1>
        <p className="mt-3 text-white/65">
          Recebemos o seu pedido de <strong className="text-white">{product.name}</strong>.
          Enviamos a confirmação para o seu e-mail e você receberá o código de rastreio assim
          que o produto for despachado.
        </p>
        {orderId && (
          <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-sm text-white/60">
            Número do pedido:{" "}
            <span className="font-mono font-semibold text-white">{orderId}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href={orderId ? `#/rastreio?pedido=${encodeURIComponent(orderId)}` : "#/rastreio"}
            className="btn-gradient inline-block px-8 py-3.5 text-base"
          >
            Rastrear meu pedido
          </a>
          <a href="#/" className="text-sm text-white/55 transition hover:text-white">
            Voltar à loja
          </a>
        </div>
      </div>
    </main>
  );
}
