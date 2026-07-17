// _shared/track17.ts
// Integração com a API do 17TRACK (rastreio universal de encomendas), usada
// para acompanhar automaticamente pedidos enviados via AliExpress/Cainiao e
// outras transportadoras. A API key fica em TRACK17_API_KEY (Supabase secret)
// e NUNCA vai ao frontend — todas as chamadas são server-side.
//
// Fluxo: ao despachar um pedido, registramos o número (register). O 17TRACK
// então empurra as atualizações para a função `tracking-webhook`, que grava os
// eventos e promove o pedido a "entregue" quando for o caso.
//
// Doc: https://api.17track.net/en/doc  (register + push/webhook + status enums)

const TRACK17_BASE =
  Deno.env.get("TRACK17_BASE") ?? "https://api.17track.net/track/v2.2";
const TRACK17_API_KEY = Deno.env.get("TRACK17_API_KEY");

/** Há API key configurada? Usado para tornar a integração opcional. */
export function track17Configured(): boolean {
  return Boolean(TRACK17_API_KEY);
}

/** Página pública de rastreio no 17TRACK, para o cliente abrir no navegador. */
export function track17PublicUrl(trackingNumber: string): string {
  return `https://t.17track.net/pt#nums=${encodeURIComponent(trackingNumber)}`;
}

// ---------------------------------------------------------------------------
// Registro do número
// ---------------------------------------------------------------------------

interface Track17RegisterResponse {
  code?: number;
  data?: {
    accepted?: { number: string; carrier?: number }[];
    rejected?: { number: string; error?: { code?: number; message?: string } }[];
  };
}

export interface Register17Result {
  ok: boolean;
  carrier: number | null;
  error?: string;
}

/**
 * Registra um número de rastreio no 17TRACK para acompanhamento.
 * Best-effort: o chamador NÃO deve falhar o despacho se isto der erro.
 */
export async function register17Track(
  trackingNumber: string,
  orderNo?: string,
  carrier?: number,
): Promise<Register17Result> {
  if (!TRACK17_API_KEY) {
    return { ok: false, carrier: null, error: "TRACK17_API_KEY ausente." };
  }

  const item: Record<string, unknown> = { number: trackingNumber, lang: "pt" };
  if (orderNo) item.order_no = orderNo;
  if (carrier) item.carrier = carrier;

  try {
    const res = await fetch(`${TRACK17_BASE}/register`, {
      method: "POST",
      headers: { "17token": TRACK17_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify([item]),
    });
    const body = (await res.json()) as Track17RegisterResponse;
    const accepted = body?.data?.accepted?.[0];
    if (accepted) {
      return { ok: true, carrier: accepted.carrier ?? carrier ?? null };
    }
    const rejected = body?.data?.rejected?.[0];
    return {
      ok: false,
      carrier: null,
      error: rejected?.error?.message ?? `register falhou (code ${body?.code ?? "?"})`,
    };
  } catch (e) {
    return { ok: false, carrier: null, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Parsing do track_info (usado pelo webhook e por um futuro poller)
// ---------------------------------------------------------------------------

export interface TrackEvent {
  time: string | null; // ISO 8601
  description: string;
  location: string | null;
  stage: string | null;
}

export interface Track17Parsed {
  status: string | null; // status cru do 17TRACK (InTransit, Delivered, ...)
  internalStatus: string | null; // 'delivered' | 'shipped' | null (não altera)
  events: TrackEvent[];
}

/** Estrutura parcial do objeto track_info devolvido pelo 17TRACK. */
export interface TrackInfo {
  latest_status?: { status?: string; sub_status?: string };
  tracking?: {
    providers?: {
      events?: {
        time_iso?: string;
        time_utc?: string;
        description?: string;
        location?: string;
        stage?: string;
      }[];
    }[];
  };
}

/**
 * Mapeia o status do 17TRACK para o status "de negócio" do pedido.
 * Só "Delivered" promove o pedido; os demais mantêm "shipped" (a jornada
 * detalhada aparece na linha do tempo de eventos). NotFound/desconhecido → null
 * (não mexe no status).
 */
export function map17Status(status: string | null | undefined): string | null {
  switch (status) {
    case "Delivered":
      return "delivered";
    case "InfoReceived":
    case "InTransit":
    case "OutForDelivery":
    case "AvailableForPickup":
    case "DeliveryFailure":
    case "Exception":
    case "Expired":
      return "shipped";
    default:
      return null;
  }
}

/** Extrai status + eventos normalizados (mais recentes primeiro) do track_info. */
export function parseTrackInfo(trackInfo: TrackInfo): Track17Parsed {
  const status = trackInfo?.latest_status?.status ?? null;
  const events: TrackEvent[] = [];
  for (const provider of trackInfo?.tracking?.providers ?? []) {
    for (const ev of provider?.events ?? []) {
      events.push({
        time: ev?.time_iso ?? ev?.time_utc ?? null,
        description: String(ev?.description ?? ""),
        location: ev?.location ?? null,
        stage: ev?.stage ?? null,
      });
    }
  }
  events.sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));
  return { status, internalStatus: map17Status(status), events };
}
