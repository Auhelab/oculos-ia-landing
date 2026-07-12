-- Etapa 4 — pós-pagamento: rastreio (fulfillment) e controle de e-mails.
-- Acrescenta colunas de despacho/rastreio à tabela orders e flags de
-- idempotência para os e-mails transacionais (garantem envio único mesmo
-- quando process-payment e mp-webhook confirmam o mesmo pedido).

-- ---------------------------------------------------------------------------
-- Novos status do ciclo de vida do pedido: 'shipped' (despachado) e
-- 'delivered' (entregue). Recriamos o CHECK para incluí-los.
-- ---------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending','processing','paid','shipped','delivered','rejected','cancelled','refunded'
  ));

-- ---------------------------------------------------------------------------
-- Rastreio: código do transportador + URL de rastreamento + carimbo de envio.
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists tracking_code text;
alter table public.orders add column if not exists tracking_url  text;
alter table public.orders add column if not exists shipped_at    timestamptz;

-- ---------------------------------------------------------------------------
-- Idempotência dos e-mails: gravamos o instante do envio. O envio só ocorre
-- quando a coluna correspondente ainda é NULL (claim atômico via UPDATE
-- condicional), evitando e-mail duplicado quando o pagamento é confirmado por
-- dois caminhos (retorno síncrono do cartão + webhook).
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists paid_email_sent_at    timestamptz;
alter table public.orders add column if not exists shipped_email_sent_at timestamptz;
