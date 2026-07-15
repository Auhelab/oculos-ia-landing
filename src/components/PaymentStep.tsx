import { useEffect, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { env } from "../config/env";
import { product } from "../config/product";
import { ApiError, processPayment, trackOrder, type PixData } from "../lib/api";
import { formatBRL } from "../lib/money";

// Validade do Pix exibida no contador. Manter em sincronia com
// PIX_EXPIRATION_MINUTES do process-payment (o MP cancela no servidor).
const PIX_TTL_SECONDS = 10 * 60;

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Inicializa o SDK uma única vez com a public key (segura para o frontend).
let mpInitialized = false;
function ensureMpInitialized(): void {
  if (!mpInitialized && env.mpPublicKey) {
    initMercadoPago(env.mpPublicKey, { locale: "pt-BR" });
    mpInitialized = true;
  }
}

interface PaymentStepProps {
  orderId: string;
  amountCents: number;
  customerEmail: string;
  onApproved: (orderId: string) => void;
  onBack: () => void;
}

type PaymentResult =
  | { kind: "idle" }
  | { kind: "rejected"; detail: string }
  | { kind: "pix"; pix: PixData }
  | { kind: "pending" };

/** Traduz status_detail comuns do MP em mensagens claras em pt-BR. */
function rejectionMessage(detail: string): string {
  const map: Record<string, string> = {
    cc_rejected_insufficient_amount: "Saldo/limite insuficiente no cartão.",
    cc_rejected_bad_filled_card_number: "Número do cartão incorreto.",
    cc_rejected_bad_filled_date: "Data de validade incorreta.",
    cc_rejected_bad_filled_security_code: "Código de segurança (CVV) incorreto.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão e tente de novo.",
    cc_rejected_high_risk: "Pagamento recusado por segurança. Tente outro meio.",
    cc_rejected_call_for_authorize: "Autorize o pagamento com o seu banco e tente de novo.",
  };
  return map[detail] ?? "Pagamento não aprovado. Tente outro cartão ou meio de pagamento.";
}

export default function PaymentStep({
  orderId,
  amountCents,
  customerEmail,
  onApproved,
  onBack,
}: PaymentStepProps) {
  const [result, setResult] = useState<PaymentResult>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [pixSecondsLeft, setPixSecondsLeft] = useState(PIX_TTL_SECONDS);
  // Enquanto o Brick do Mercado Pago não termina de carregar, mostramos um
  // overlay de "carregando". Sem esse sinal, a área fica em branco e o cliente
  // acha que travou — e abandona a compra.
  const [brickReady, setBrickReady] = useState(false);
  const [brickSlow, setBrickSlow] = useState(false);

  useEffect(() => {
    ensureMpInitialized();
  }, []);

  // Pix é assíncrono: a confirmação chega via webhook do MP no backend, que
  // marca o pedido como pago. Aqui consultamos o status a cada 5s até "paid"
  // e então avançamos — mesmo destino do cartão. Erros de rede são transientes:
  // a rodada seguinte tenta de novo. setTimeout encadeado evita requests sobrepostos.
  useEffect(() => {
    if (result.kind !== "pix") return;
    let cancelled = false;
    let timer: number | undefined;

    async function check(): Promise<void> {
      try {
        const res = await trackOrder(orderId, customerEmail);
        if (cancelled) return;
        if (res.status === "paid") {
          onApproved(orderId);
          return;
        }
        if (res.status === "rejected" || res.status === "refunded") {
          setBrickReady(false);
          setResult({
            kind: "rejected",
            detail: "O Pix foi cancelado ou expirou. Gere um novo para concluir.",
          });
          return;
        }
      } catch {
        // Falha transiente na consulta — mantém o polling.
      }
      if (!cancelled) timer = window.setTimeout(() => void check(), 5000);
    }

    void check();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [result.kind, orderId, customerEmail, onApproved]);

  // Contador regressivo do Pix. Espelha a expiração do lado do MP
  // (date_of_expiration); ao zerar, volta para a escolha de pagamento no
  // Brick — o pagamento antigo morre no MP e o retry gera um código novo.
  useEffect(() => {
    if (result.kind !== "pix") return;
    setPixSecondsLeft(PIX_TTL_SECONDS);
    const deadline = Date.now() + PIX_TTL_SECONDS * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setPixSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(timer);
        setBrickReady(false);
        setResult({
          kind: "rejected",
          detail: "O tempo para pagar o Pix acabou. Escolha a forma de pagamento e gere um novo código.",
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [result.kind]);

  // Se o Brick demorar (a API payment_methods do MP às vezes trava ~15s),
  // trocamos a mensagem para tranquilizar o cliente de que não está travado.
  useEffect(() => {
    if (brickReady) return;
    const timer = window.setTimeout(() => setBrickSlow(true), 6000);
    return () => window.clearTimeout(timer);
  }, [brickReady]);

  async function handleSubmit({ formData }: { formData: unknown }): Promise<void> {
    try {
      const res = await processPayment(orderId, formData);

      if (res.status === "approved") {
        onApproved(orderId);
        return;
      }
      if (res.pix && res.pix.qrCode) {
        setResult({ kind: "pix", pix: res.pix });
        return;
      }
      if (res.status === "rejected" || res.status === "cancelled") {
        setResult({ kind: "rejected", detail: rejectionMessage(res.statusDetail) });
        return;
      }
      // pending / in_process (ex.: análise) sem dados de Pix.
      setResult({ kind: "pending" });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Falha ao processar o pagamento. Tente novamente.";
      setResult({ kind: "rejected", detail: message });
      // Resolve normalmente para exibirmos nossa própria mensagem, não a do Brick.
    }
  }

  async function copyPixCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  if (result.kind === "pix") {
    return (
      <div className="text-center">
        <h3 className="text-2xl font-bold tracking-tight">
          Quase lá! Pague com Pix
        </h3>
        <p className="mt-2 text-sm text-ink-soft">
          Escaneie o QR code ou use o copia-e-cola. A confirmação é automática.
        </p>
        {result.pix.qrCodeBase64 && (
          <img
            src={`data:image/png;base64,${result.pix.qrCodeBase64}`}
            alt="QR code do Pix"
            className="mx-auto mt-6 w-56 rounded-2xl border border-line-soft bg-white p-3"
          />
        )}
        <div className="mt-6 text-left">
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Pix copia-e-cola
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={result.pix.qrCode}
              className="w-full rounded-xl border border-line bg-haze px-4 py-3 text-xs text-ink-soft"
            />
            <button
              type="button"
              onClick={() => void copyPixCode(result.pix.qrCode)}
              className="btn-primary shrink-0 px-5 text-sm"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
        <p
          role="status"
          className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-ink"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink"
          />
          Aguardando o pagamento — esta tela avança sozinha.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          O código expira em{" "}
          <span
            className={`font-semibold tabular-nums ${
              pixSecondsLeft < 60 ? "text-red-600" : "text-ink"
            }`}
          >
            {formatCountdown(pixSecondsLeft)}
          </span>
        </p>
        <p className="mt-3 rounded-xl bg-haze p-3 text-xs text-ink-soft">
          Se preferir fechar a página, tudo bem: você também receberá a confirmação do pedido por e-mail.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-tight">Pagamento</h3>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-ink-soft transition hover:text-ink"
        >
          ← Editar dados
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Total a pagar:{" "}
        <span className="font-semibold text-ink">{formatBRL(amountCents)}</span>
      </p>

      {result.kind === "rejected" && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {result.detail} Você pode tentar novamente abaixo.
        </p>
      )}
      {result.kind === "pending" && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-700"
        >
          Seu pagamento está em análise. Avisaremos por e-mail assim que for confirmado.
        </p>
      )}

      <div className={`relative mt-5 ${brickReady ? "" : "min-h-[380px]"}`}>
        <div
          className={brickReady ? "" : "pointer-events-none opacity-0"}
          aria-hidden={!brickReady}
        >
          <Payment
            initialization={{ amount: amountCents / 100 }}
            customization={{
              paymentMethods: {
                creditCard: "all",
                // Débito removido a pedido — só cartão de crédito e Pix.
                bankTransfer: "all",
                maxInstallments: product.maxInstallments,
              },
              visual: { style: { theme: "default" } },
            }}
            onSubmit={handleSubmit}
            onReady={() => setBrickReady(true)}
            // Se o Brick falhar em carregar, revelamos o container para ele
            // exibir o próprio erro em vez de deixar o cliente num spinner eterno.
            onError={() => setBrickReady(true)}
          />
        </div>
        {!brickReady && <BrickLoading slow={brickSlow} />}
      </div>
    </div>
  );
}

/** Overlay de carregamento exibido sobre a área do Brick enquanto ele monta. */
function BrickLoading({ slow }: { slow: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-2xl bg-white"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink"
      />
      <div className="px-6 text-center">
        <p className="text-sm font-medium text-ink">Carregando formas de pagamento…</p>
        <p className="mt-1.5 text-xs text-ink-soft">
          {slow
            ? "A conexão com o Mercado Pago está um pouco lenta. Já está quase lá — não feche a página."
            : "Cartão, Pix e mais aparecem em instantes."}
        </p>
      </div>
      <div className="mt-1 w-full max-w-xs space-y-2.5 px-2">
        <div className="h-11 animate-pulse rounded-xl bg-haze" />
        <div className="h-11 animate-pulse rounded-xl bg-haze" />
        <div className="h-11 w-2/3 animate-pulse rounded-xl bg-haze" />
      </div>
    </div>
  );
}
