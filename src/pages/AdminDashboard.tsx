import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  adminDeliverOrder,
  adminListOrders,
  adminShipOrder,
  type AdminOrder,
} from "../lib/api";
import { formatBRL } from "../lib/money";
import { statusMeta } from "../lib/orderStatus";

const ADMIN_KEY_STORAGE = "lp:adminKey";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "paid", label: "A enviar (pagos)" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregues" },
  { value: "pending", label: "Aguardando pgto." },
  { value: "processing", label: "Processando" },
  { value: "rejected", label: "Recusados" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cartão de um pedido, com as ações de despacho/entrega. */
function OrderCard({
  order,
  adminKey,
  onChanged,
}: {
  order: AdminOrder;
  adminKey: string;
  onChanged: () => void;
}) {
  const [trackingCode, setTrackingCode] = useState(order.tracking_code ?? "");
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meta = statusMeta(order.status);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }

  const canShip = order.status === "paid" || order.status === "shipped";

  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">{order.customer_name}</div>
          <div className="truncate text-sm text-white/55">{order.customer_email}</div>
          <div className="text-sm text-white/55">{order.customer_whatsapp}</div>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${meta.chip}`}>
          {meta.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">Valor</div>
          <div className="font-semibold text-white">{formatBRL(order.amount_cents)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40">Método</div>
          <div className="text-white/80">{order.payment_method ?? "—"}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs uppercase tracking-wide text-white/40">Entrega</div>
          <div className="text-white/80">
            {order.address_street}, {order.address_number}
            {order.address_complement ? ` (${order.address_complement})` : ""} —{" "}
            {order.address_neighborhood}, {order.address_city}/{order.address_state} — CEP{" "}
            {order.address_cep}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-xs uppercase tracking-wide text-white/40">Pedido</div>
          <div className="font-mono text-xs text-white/60">{order.id}</div>
          <div className="text-xs text-white/45">Criado em {formatDateTime(order.created_at)}</div>
        </div>
      </div>

      {canShip && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="Código de rastreio"
              className="rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/35 focus:border-cyan-300/50 focus:outline-none"
            />
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="URL de rastreio (opcional)"
              className="rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/35 focus:border-cyan-300/50 focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || !trackingCode.trim()}
              onClick={() =>
                run(() =>
                  adminShipOrder(adminKey, order.id, trackingCode.trim(), trackingUrl.trim()),
                )
              }
              className="btn-gradient px-4 py-2 text-sm disabled:opacity-50"
            >
              {order.status === "shipped" ? "Atualizar" : "Marcar enviado"}
            </button>
          </div>
          {order.status === "shipped" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => adminDeliverOrder(adminKey, order.id))}
              className="mt-2 text-sm text-emerald-300 transition hover:text-emerald-200 disabled:opacity-50"
            >
              Marcar como entregue →
            </button>
          )}
        </div>
      )}

      {err && <p className="mt-3 text-sm font-medium text-rose-300">{err}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Painel de pedidos";
    try {
      const saved = sessionStorage.getItem(ADMIN_KEY_STORAGE);
      if (saved) {
        setAdminKey(saved);
        setAuthed(true);
      }
    } catch {
      // sessionStorage indisponível — segue pedindo a chave.
    }
  }, []);

  const load = useCallback(
    async (key: string, statusFilter: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminListOrders(key, statusFilter || undefined);
        setOrders(res.orders);
        setAdminKey(key);
        setAuthed(true);
        try {
          sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
        } catch {
          // ignora falha de storage.
        }
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Falha ao carregar pedidos.";
        setError(message);
        if (e instanceof ApiError && message.includes("autoriz")) {
          setAuthed(false);
          try {
            sessionStorage.removeItem(ADMIN_KEY_STORAGE);
          } catch {
            // ignora.
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Recarrega ao autenticar e sempre que o filtro muda.
  useEffect(() => {
    if (authed && adminKey) void load(adminKey, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, status]);

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-16">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(keyInput.trim(), status);
          }}
          className="glass w-full max-w-sm p-8"
        >
          <a href="#/" className="text-sm text-white/55 transition hover:text-white">
            ← Voltar à loja
          </a>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
            Painel de pedidos
          </h1>
          <p className="mt-2 text-sm text-white/60">Acesso restrito. Informe a chave de administrador.</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Chave de administrador"
            required
            className="mt-5 w-full rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/35 focus:border-cyan-300/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient mt-4 w-full px-6 py-3 text-base disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
          {error && <p className="mt-4 text-sm font-medium text-rose-300">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Pedidos</h1>
          <a href="#/" className="text-sm text-white/50 transition hover:text-white">
            ← Voltar à loja
          </a>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-sm text-white focus:border-cyan-300/50 focus:outline-none [&>option]:bg-slate-900"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load(adminKey, status)}
            className="rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Atualizar
          </button>
        </div>
      </div>

      {error && <p className="mt-5 text-sm font-medium text-rose-300">{error}</p>}

      {loading ? (
        <p className="mt-10 text-center text-white/50">Carregando…</p>
      ) : orders.length === 0 ? (
        <p className="mt-10 text-center text-white/50">Nenhum pedido neste filtro.</p>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-white/45">
            {orders.length} pedido{orders.length === 1 ? "" : "s"}
          </p>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              adminKey={adminKey}
              onChanged={() => void load(adminKey, status)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
