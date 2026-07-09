import { useEffect, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { env } from "../config/env";
import { ApiError, processPayment, type PixData } from "../lib/api";
import { formatBRL } from "../lib/money";

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
  onApproved,
  onBack,
}: PaymentStepProps) {
  const [result, setResult] = useState<PaymentResult>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ensureMpInitialized();
  }, []);

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
        <h3 className="font-display text-2xl font-extrabold tracking-tight">
          Quase lá! Pague com Pix
        </h3>
        <p className="mt-2 text-sm text-white/60">
          Escaneie o QR code ou use o copia-e-cola. A confirmação é automática.
        </p>
        {result.pix.qrCodeBase64 && (
          <img
            src={`data:image/png;base64,${result.pix.qrCodeBase64}`}
            alt="QR code do Pix"
            className="mx-auto mt-6 w-56 rounded-2xl border border-white/15 bg-white p-3"
          />
        )}
        <div className="mt-6 text-left">
          <label className="mb-1.5 block text-sm font-semibold text-white">
            Pix copia-e-cola
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={result.pix.qrCode}
              className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-xs text-white/70"
            />
            <button
              type="button"
              onClick={() => void copyPixCode(result.pix.qrCode)}
              className="btn-gradient shrink-0 px-5 text-sm"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
        <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-xs text-white/55">
          Assim que o pagamento for confirmado, você receberá a atualização do pedido por e-mail.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-bold tracking-tight">Pagamento</h3>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-white/55 transition hover:text-white"
        >
          ← Editar dados
        </button>
      </div>
      <p className="mt-1 text-sm text-white/60">
        Total a pagar:{" "}
        <span className="font-semibold text-white">{formatBRL(amountCents)}</span>
      </p>

      {result.kind === "rejected" && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-medium text-rose-200"
        >
          {result.detail} Você pode tentar novamente abaixo.
        </p>
      )}
      {result.kind === "pending" && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm font-medium text-amber-200"
        >
          Seu pagamento está em análise. Avisaremos por e-mail assim que for confirmado.
        </p>
      )}

      <div className="mt-5">
        <Payment
          initialization={{ amount: amountCents / 100 }}
          customization={{
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              bankTransfer: "all",
            },
            visual: { style: { theme: "dark" } },
          }}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
