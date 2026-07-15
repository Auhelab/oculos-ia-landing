import { useEffect, useState } from "react";
import { ApiError, trackOrder, type TrackResult } from "../lib/api";
import { formatBRL } from "../lib/money";
import { JOURNEY, journeyIndex, statusMeta } from "../lib/orderStatus";
import { product } from "../config/product";
import { readPaidOrder } from "./ThankYou";

/** Lê os parâmetros da query do hash (#/rastreio?pedido=...&auto=1). */
function readHashParams(): URLSearchParams {
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  return new URLSearchParams(qIndex === -1 ? "" : hash.slice(qIndex + 1));
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
                  ? "border-green-500/30 bg-green-50 text-green-600"
                  : "border-line bg-haze text-ink-soft/50"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm font-medium ${
                isCurrent ? "text-ink" : done ? "text-ink" : "text-ink-soft/60"
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

  async function runTrack(oid: string, mail: string): Promise<void> {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await trackOrder(oid.trim(), mail.trim());
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

  useEffect(() => {
    document.title = `Rastrear pedido | ${product.name}`;
    window.scrollTo(0, 0);
    const params = readHashParams();
    if (params.get("auto") === "1") {
      // Fluxo pós-compra ("Rastrear meu pedido"): pré-preenche número + e-mail
      // e já consulta automaticamente.
      const paid = readPaidOrder();
      if (paid) {
        setOrderId(paid.number);
        setEmail(paid.email);
        if (paid.number && paid.email) void runTrack(paid.number, paid.email);
      }
    } else {
      // Acesso manual: link do e-mail traz só o número; pela landing, nada.
      const prefill = params.get("pedido") ?? "";
      if (prefill) setOrderId(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await runTrack(orderId, email);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-haze px-6 py-16">
      <div className="card-white w-full max-w-lg p-8 sm:p-10">
        <a href="#/" className="text-sm text-ink-soft transition hover:text-ink">
          ← Voltar à loja
        </a>
        <h1 className="mt-4 text-center font-display text-3xl font-extrabold tracking-tight text-ink">
          Rastrear pedido
        </h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Informe o número do pedido e o e-mail usado na compra.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="track-order-id" className="mb-1.5 block text-sm font-medium text-ink">
              Número do pedido
            </label>
            <input
              id="track-order-id"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="ex.: 318798"
              required
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </div>
          <div>
            <label htmlFor="track-email" className="mb-1.5 block text-sm font-medium text-ink">
              E-mail da compra
            </label>
            <input
              id="track-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              required
              className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full px-6 py-3.5 text-base"
          >
            {loading ? "Consultando…" : "Rastrear"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}

        {result && (
          <div className="mt-7 border-t border-line-soft pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-soft">Pedido</div>
                <div className="font-mono text-sm font-semibold text-ink">
                  {result.orderNumber != null ? `#${result.orderNumber}` : result.orderId}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta(result.status).chip}`}
              >
                {statusMeta(result.status).label}
              </span>
            </div>

            <div className="mt-3 text-sm text-ink-soft">
              Valor: <span className="font-medium text-ink">{formatBRL(result.amountCents)}</span>
              {" · "}Feito em {formatDate(result.createdAt)}
            </div>

            <Timeline status={result.status} />

            {result.trackingCode && (
              <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/[0.04] p-4 text-center">
                <div className="text-xs uppercase tracking-wide text-ink-soft">
                  Código de rastreio
                </div>
                <div className="mt-1 font-mono text-lg font-bold tracking-wider text-ink">
                  {result.trackingCode}
                </div>
                {result.trackingUrl && (
                  <a
                    href={result.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary mt-4 inline-block px-6 py-2.5 text-sm"
                  >
                    Rastrear no site do transportador
                  </a>
                )}
              </div>
            )}

            {result.status === "paid" && (
              <p className="mt-5 rounded-xl border border-line-soft bg-haze p-3 text-sm text-ink-soft">
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
