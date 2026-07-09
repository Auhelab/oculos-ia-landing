import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { product } from "../config/product";
import { isValidCpf, maskCpf } from "../lib/cpf";
import { isValidPhone, maskPhone } from "../lib/phone";
import { fetchAddressByCep, isValidCep, maskCep } from "../lib/cep";
import { onlyDigits } from "../lib/digits";
import { formatBRL, installmentCents } from "../lib/money";
import { ApiError, createOrder, type CheckoutPayload, type CreateOrderResult } from "../lib/api";
import { isPaymentConfigured } from "../config/env";
import PaymentStep from "./PaymentStep";
import { rememberPaidOrder } from "../pages/ThankYou";

const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Informe seu nome completo")
    .refine((value) => value.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  cpf: z
    .string()
    .min(1, "Informe seu CPF")
    .refine(isValidCpf, "CPF inválido — confira os números digitados"),
  email: z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido"),
  whatsapp: z
    .string()
    .min(1, "Informe seu WhatsApp")
    .refine(isValidPhone, "Número inválido — use o formato (11) 98765-4321"),
  cep: z.string().min(1, "Informe seu CEP").refine(isValidCep, "CEP incompleto"),
  street: z.string().trim().min(1, "Informe a rua"),
  number: z.string().trim().min(1, "Informe o número"),
  complement: z.string().trim(),
  neighborhood: z.string().trim().min(1, "Informe o bairro"),
  city: z.string().trim().min(1, "Informe a cidade"),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, "UF inválida"),
});

type CheckoutData = z.infer<typeof checkoutSchema>;

type AddressField = "street" | "neighborhood" | "city" | "state";

type CepStatus = "idle" | "loading" | "success" | "not_found" | "network_error";

const noneLocked: Record<AddressField, boolean> = {
  street: false,
  neighborhood: false,
  city: false,
  state: false,
};

const cepStatusMessages: Record<Exclude<CepStatus, "idle">, string> = {
  loading: "Buscando endereço…",
  success: "Endereço encontrado! Confirme o número.",
  not_found: "CEP não encontrado. Confira os números ou preencha o endereço manualmente.",
  network_error: "Não foi possível consultar o CEP agora. Preencha o endereço manualmente.",
};

const inputBase =
  "w-full rounded-xl border bg-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/35 backdrop-blur-md transition read-only:bg-white/[0.04] read-only:text-white/50";

function inputClass(hasError: boolean): string {
  return `${inputBase} ${hasError ? "border-rose-400/70" : "border-white/20"}`;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

function Field({ id, label, error, hint, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-white">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-white/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hasError: boolean, hasHint: boolean): string | undefined {
  if (hasError) return `${id}-error`;
  if (hasHint) return `${id}-hint`;
  return undefined;
}

export default function CheckoutForm() {
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    clearErrors,
    formState: { errors },
  } = useForm<CheckoutData>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      cpf: "",
      email: "",
      whatsapp: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
    },
  });

  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");
  const [locked, setLocked] = useState<Record<AddressField, boolean>>(noneLocked);
  const [order, setOrder] = useState<CreateOrderResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cpfField = register("cpf");
  const whatsappField = register("whatsapp");
  const cepField = register("cep");
  const stateField = register("state");

  function handleCpfChange(event: ChangeEvent<HTMLInputElement>) {
    event.target.value = maskCpf(event.target.value);
    void cpfField.onChange(event);
  }

  function handleWhatsappChange(event: ChangeEvent<HTMLInputElement>) {
    event.target.value = maskPhone(event.target.value);
    void whatsappField.onChange(event);
  }

  function handleStateChange(event: ChangeEvent<HTMLInputElement>) {
    event.target.value = event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
    void stateField.onChange(event);
  }

  function handleCepChange(event: ChangeEvent<HTMLInputElement>) {
    event.target.value = maskCep(event.target.value);
    void cepField.onChange(event);

    const digits = onlyDigits(event.target.value);
    if (digits.length === 8) {
      void lookupCep(digits);
    } else {
      abortRef.current?.abort();
      setCepStatus("idle");
      setLocked(noneLocked);
    }
  }

  async function lookupCep(digits: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setCepStatus("loading");

    try {
      const result = await fetchAddressByCep(digits, controller.signal);
      if (controller.signal.aborted) return;

      if (result.ok) {
        const filled: [AddressField, string][] = [
          ["street", result.address.street],
          ["neighborhood", result.address.neighborhood],
          ["city", result.address.city],
          ["state", result.address.state],
        ];
        const nextLocked = { ...noneLocked };
        for (const [field, value] of filled) {
          setValue(field, value, { shouldValidate: value !== "" });
          // CEPs genéricos (de cidade) chegam sem rua/bairro: esses campos continuam editáveis.
          nextLocked[field] = value !== "";
        }
        clearErrors(["street", "neighborhood", "city", "state"]);
        setLocked(nextLocked);
        setCepStatus("success");
        setFocus("number");
      } else {
        setLocked(noneLocked);
        setCepStatus(result.reason === "not_found" ? "not_found" : "network_error");
      }
    } catch {
      // Busca abortada porque o usuário alterou o CEP — o novo lookup assume.
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    // O payload segue SEM preço: o servidor fixa o valor a partir do productId.
    const payload: CheckoutPayload = {
      productId: product.id,
      customer: {
        fullName: data.fullName,
        cpf: onlyDigits(data.cpf),
        email: data.email,
        whatsapp: onlyDigits(data.whatsapp),
      },
      address: {
        cep: onlyDigits(data.cep),
        street: data.street,
        number: data.number,
        complement: data.complement === "" ? null : data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state.toUpperCase(),
      },
    };

    if (!isPaymentConfigured) {
      setSubmitError(
        "Pagamento ainda não configurado. Preencha o arquivo .env com as chaves do Supabase e do Mercado Pago (veja o README).",
      );
      return;
    }

    setSubmitError(null);
    setCreating(true);
    try {
      const created = await createOrder(payload);
      setOrder(created);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível iniciar o pagamento. Tente novamente.",
      );
    } finally {
      setCreating(false);
    }
  });

  function handleApproved(orderId: string) {
    rememberPaidOrder(orderId);
    window.location.hash = "#/obrigado";
  }

  const installment = formatBRL(installmentCents(product.priceCents, product.maxInstallments));
  const heroImage = product.images[0];

  return (
    <section id="checkout" className="py-20 sm:py-28">
      <div className="mx-auto max-w-page px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          Finalize seu pedido.
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-white/60">
          {order
            ? "Escolha a forma de pagamento e finalize com segurança."
            : "Preencha seus dados de entrega e vá direto para o pagamento."}
        </p>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          {/* Resumo do pedido */}
          <aside className="glass relative overflow-hidden p-8 lg:sticky lg:top-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/25 to-cyan-400/20 blur-3xl"
            />
            <img src={heroImage.src} alt={heroImage.alt} className="relative mx-auto w-64" />
            <h3 className="relative mt-4 font-display text-2xl font-extrabold tracking-tight">
              {product.name}
            </h3>
            <p className="relative mt-1 text-sm text-white/55">{product.tagline}</p>

            <dl className="relative mt-6 space-y-2 border-t border-white/10 pt-6 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/55">Subtotal</dt>
                <dd className="font-semibold">{formatBRL(product.priceCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/55">Frete</dt>
                <dd className="font-semibold text-emerald-400">Grátis</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display text-xl font-extrabold">
                  {formatBRL(product.priceCents)}
                </dd>
              </div>
            </dl>
            <p className="relative mt-2 text-xs text-white/45">
              ou {product.maxInstallments}x de {installment} sem juros
            </p>
            <p className="relative mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-xs leading-relaxed text-white/55 backdrop-blur-md">
              🔒 O valor final é confirmado e cobrado com segurança apenas na etapa de pagamento.
            </p>
          </aside>

          {/* Passo 2 — Pagamento (Payment Brick), no mesmo painel de vidro */}
          {order ? (
            <div className="glass p-6 sm:p-10">
              <PaymentStep
                orderId={order.orderId}
                amountCents={order.amountCents}
                onApproved={handleApproved}
                onBack={() => setOrder(null)}
              />
            </div>
          ) : (
            /* Passo 1 — Formulário de dados */
            <form onSubmit={onSubmit} noValidate className="glass p-6 sm:p-10">
              <fieldset>
              <legend className="font-display text-xl font-bold tracking-tight">
                Seus dados
              </legend>

              <div className="mt-5 space-y-5">
                <Field id="fullName" label="Nome completo" error={errors.fullName?.message}>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Maria da Silva"
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={describedBy("fullName", Boolean(errors.fullName), false)}
                    className={inputClass(Boolean(errors.fullName))}
                    {...register("fullName")}
                  />
                </Field>

                <Field id="email" label="E-mail" error={errors.email?.message}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="maria@email.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={describedBy("email", Boolean(errors.email), false)}
                    className={inputClass(Boolean(errors.email))}
                    {...register("email")}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="cpf" label="CPF" error={errors.cpf?.message}>
                    <input
                      id="cpf"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      aria-invalid={Boolean(errors.cpf)}
                      aria-describedby={describedBy("cpf", Boolean(errors.cpf), false)}
                      className={inputClass(Boolean(errors.cpf))}
                      {...cpfField}
                      onChange={handleCpfChange}
                    />
                  </Field>

                  <Field id="whatsapp" label="WhatsApp" error={errors.whatsapp?.message}>
                    <input
                      id="whatsapp"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="(11) 98765-4321"
                      aria-invalid={Boolean(errors.whatsapp)}
                      aria-describedby={describedBy("whatsapp", Boolean(errors.whatsapp), false)}
                      className={inputClass(Boolean(errors.whatsapp))}
                      {...whatsappField}
                      onChange={handleWhatsappChange}
                    />
                  </Field>
                </div>
              </div>
            </fieldset>

            <fieldset className="mt-10">
              <legend className="font-display text-xl font-bold tracking-tight">
                Endereço de entrega
              </legend>

              <div className="mt-5 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="cep"
                    label="CEP"
                    error={errors.cep?.message}
                    hint="Preenchemos o endereço automaticamente"
                  >
                    <div className="relative">
                      <input
                        id="cep"
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        placeholder="00000-000"
                        aria-invalid={Boolean(errors.cep)}
                        aria-describedby={describedBy("cep", Boolean(errors.cep), true)}
                        className={inputClass(Boolean(errors.cep))}
                        {...cepField}
                        onChange={handleCepChange}
                      />
                      {cepStatus === "loading" && (
                        <span
                          aria-hidden="true"
                          className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin rounded-full border-2 border-white/25 border-t-cyan-300"
                        />
                      )}
                    </div>
                  </Field>
                </div>

                {/* Anúncio do resultado da busca de CEP para todos (visual + leitores de tela) */}
                <p
                  aria-live="polite"
                  className={`text-sm font-medium ${
                    cepStatus === "success"
                      ? "text-emerald-400"
                      : cepStatus === "loading"
                        ? "text-white/55"
                        : cepStatus === "idle"
                          ? "hidden"
                          : "text-amber-300"
                  }`}
                >
                  {cepStatus !== "idle" ? cepStatusMessages[cepStatus] : ""}
                </p>

                <Field id="street" label="Rua / Avenida" error={errors.street?.message}>
                  <input
                    id="street"
                    type="text"
                    autoComplete="address-line1"
                    placeholder="Av. Paulista"
                    readOnly={locked.street}
                    aria-invalid={Boolean(errors.street)}
                    aria-describedby={describedBy("street", Boolean(errors.street), false)}
                    className={inputClass(Boolean(errors.street))}
                    {...register("street")}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="number" label="Número" error={errors.number?.message}>
                    <input
                      id="number"
                      type="text"
                      inputMode="numeric"
                      placeholder="1000"
                      aria-invalid={Boolean(errors.number)}
                      aria-describedby={describedBy("number", Boolean(errors.number), false)}
                      className={inputClass(Boolean(errors.number))}
                      {...register("number")}
                    />
                  </Field>

                  <Field
                    id="complement"
                    label="Complemento"
                    error={errors.complement?.message}
                    hint="Opcional"
                  >
                    <input
                      id="complement"
                      type="text"
                      placeholder="Apto 42, bloco B"
                      aria-describedby={describedBy("complement", false, true)}
                      className={inputClass(false)}
                      {...register("complement")}
                    />
                  </Field>
                </div>

                <Field id="neighborhood" label="Bairro" error={errors.neighborhood?.message}>
                  <input
                    id="neighborhood"
                    type="text"
                    placeholder="Bela Vista"
                    readOnly={locked.neighborhood}
                    aria-invalid={Boolean(errors.neighborhood)}
                    aria-describedby={describedBy(
                      "neighborhood",
                      Boolean(errors.neighborhood),
                      false,
                    )}
                    className={inputClass(Boolean(errors.neighborhood))}
                    {...register("neighborhood")}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <Field id="city" label="Cidade" error={errors.city?.message}>
                    <input
                      id="city"
                      type="text"
                      autoComplete="address-level2"
                      placeholder="São Paulo"
                      readOnly={locked.city}
                      aria-invalid={Boolean(errors.city)}
                      aria-describedby={describedBy("city", Boolean(errors.city), false)}
                      className={inputClass(Boolean(errors.city))}
                      {...register("city")}
                    />
                  </Field>

                  <Field id="state" label="UF" error={errors.state?.message}>
                    <input
                      id="state"
                      type="text"
                      autoComplete="address-level1"
                      placeholder="SP"
                      maxLength={2}
                      readOnly={locked.state}
                      aria-invalid={Boolean(errors.state)}
                      aria-describedby={describedBy("state", Boolean(errors.state), false)}
                      className={`${inputClass(Boolean(errors.state))} uppercase`}
                      {...stateField}
                      onChange={handleStateChange}
                    />
                  </Field>
                </div>
              </div>
            </fieldset>

            <button
                type="submit"
                disabled={creating}
                className="btn-gradient mt-10 flex w-full items-center justify-center gap-2 px-8 py-4 text-base disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating && (
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                )}
                {creating ? "Criando pedido…" : "Ir para o pagamento"}
              </button>

              <p className="mt-3 text-center text-xs text-white/45">
                🔒 Seus dados são usados apenas para entrega e emissão da nota fiscal (LGPD).
              </p>

              {submitError && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm font-medium text-rose-200 backdrop-blur-md"
                >
                  {submitError}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
