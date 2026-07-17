-- Etapa 5 — rastreio automático via provedor universal (17TRACK).
-- Acrescenta a orders o estado vindo do 17TRACK: transportadora detectada,
-- status cru (InTransit/Delivered/...), a linha do tempo de eventos e o
-- carimbo da última sincronização. O `tracking_code` (número) e o
-- `tracking_url` continuam vindo da migration 0002.

-- Id numérico da transportadora detectada pelo 17TRACK (ex.: Cainiao/AliExpress).
alter table public.orders add column if not exists carrier integer;

-- Status cru devolvido pelo 17TRACK (InfoReceived, InTransit, OutForDelivery,
-- Delivered, Exception...). O status "de negócio" continua em orders.status.
alter table public.orders add column if not exists tracking_status text;

-- Linha do tempo de eventos normalizada: [{ time, description, location, stage }].
alter table public.orders add column if not exists tracking_events jsonb;

-- Instante da última atualização recebida do 17TRACK.
alter table public.orders add column if not exists tracking_synced_at timestamptz;
