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
    // "instant" para não herdar o scroll-behavior:smooth do html
    window.scrollTo({ top: 0, behavior: "instant" });
    try {
      setOrderId(sessionStorage.getItem(ORDER_STORAGE_KEY));
    } catch {
      setOrderId(null);
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-haze px-6 py-16">
      <div className="card-white w-full max-w-lg p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8"
            aria-hidden="true"
          >
            <path d="M4.5 12.5l5 5L19.5 7" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
          Pagamento aprovado!
        </h1>
        <p className="mt-3 text-ink-soft">
          Recebemos o seu pedido de <strong className="font-semibold text-ink">{product.name}</strong>.
          Enviamos a confirmação para o seu e-mail e você receberá o código de rastreio assim
          que o produto for despachado.
        </p>
        {orderId && (
          <p className="mt-6 rounded-xl bg-haze p-3 text-sm text-ink-soft">
            Número do pedido:{" "}
            <span className="font-mono font-semibold text-ink">{orderId}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href={orderId ? `#/rastreio?pedido=${encodeURIComponent(orderId)}` : "#/rastreio"}
            className="btn-primary px-8 py-3.5 text-base"
          >
            Rastrear meu pedido
          </a>
          <a href="#/" className="btn-quiet">
            Voltar à loja
          </a>
        </div>
      </div>
    </main>
  );
}
