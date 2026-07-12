import { useEffect, useState } from "react";
import { ApiError, trackOrder, type TrackResult } from "../lib/api";
import { formatBRL } from "../lib/money";
import { JOURNEY, journeyIndex, statusMeta } from "../lib/orderStatus";
import { product } from "../config/product";

/** Lê o parâmetro `pedido` da query do hash (#/rastreio?pedido=...). */
function readOrderIdFromHash(): string {
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return "";
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  return params.get("pedido") ?? "";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Linha do tempo da jornada de entrega. */
function Timeline({ status }: { status: string }) {
  const current = journeyIndex(status);
  return (
    <ol className="mt-6 space-y-4">
      {JOURNEY.map((step, i) => {
        const done = current >= i;
        const isCurrent = current === i;
        return (
          <li key={step.key} className="flex items-center gap-4">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                done
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                  : "border-white/15 bg-white/[0.04] text-white/40"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm font-medium ${
                isCurrent ? "text-white" : done ? "text-white/75" : "text-white/45"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  useEffect(() => {
    document.title = `Rastrear pedido | ${product.name}`;
    window.scrollTo(0, 0);
    const prefill = readOrderIdFromHash();
    if (prefill) setOrderId(prefill);
  }, []);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await trackOrder(orderId.trim(), email.trim());
      setResult(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível consultar agora. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass w-full max-w-lg p-8 sm:p-10">
        <a href="#/" className="text-sm text-white/55 transition hover:text-white">
          ← Voltar à loja
        </a>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
          Rastrear pedido
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Informe o número do pedido e o e-mail usado na compra.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="track-order-id" className="mb-1.5 block text-sm font-semibold">
              Número do pedido
            </label>
            <input
              id="track-order-id"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="ex.: 3f2a1b9c-…"
              required
              className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/35 focus:border-cyan-300/50 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="track-email" className="mb-1.5 block text-sm font-semibold">
              E-mail da compra
            </label>
            <input
              id="track-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              required
              className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/35 focus:border-cyan-300/50 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient w-full px-6 py-3.5 text-base disabled:opacity-60"
          >
            {loading ? "Consultando…" : "Rastrear"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-medium text-rose-200"
          >
            {error}
          </p>
        )}

        {result && (
          <div className="mt-7 border-t border-white/10 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/45">Pedido</div>
                <div className="font-mono text-sm text-white/80">{result.orderId}</div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta(result.status).chip}`}
              >
                {statusMeta(result.status).label}
              </span>
            </div>

            <div className="mt-3 text-sm text-white/60">
              Valor: <span className="text-white/85">{formatBRL(result.amountCents)}</span>
              {" · "}Feito em {formatDate(result.createdAt)}
            </div>

            <Timeline status={result.status} />

            {result.trackingCode && (
              <div className="mt-6 rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.06] p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-white/45">
                  Código de rastreio
                </div>
                <div className="mt-1 font-mono text-lg font-bold tracking-wider text-white">
                  {result.trackingCode}
                </div>
                {result.trackingUrl && (
                  <a
                    href={result.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gradient mt-4 inline-block px-6 py-2.5 text-sm"
                  >
                    Rastrear no site do transportador
                  </a>
                )}
              </div>
            )}

            {result.status === "paid" && (
              <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-sm text-white/60">
                Seu pagamento foi aprovado e o pedido está sendo preparado. O código de
                rastreio aparecerá aqui assim que ele for despachado.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
