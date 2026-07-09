-- Etapa 3 — esquema de pedidos.
-- O preço vive AQUI (tabela products) e é a única fonte de verdade para cobrança.
-- O frontend nunca envia valor: as Edge Functions leem o preço desta tabela.

-- Extensão para gen_random_uuid() (disponível por padrão no Postgres do Supabase).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- products: catálogo mínimo. O preço de cobrança sai daqui, nunca do cliente.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id          text primary key,
  name        text        not null,
  price_cents integer     not null check (price_cents > 0),
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- Seed do produto único desta loja (R$ 399,90).
insert into public.products (id, name, price_cents, active)
values ('oculos-inteligentes-ia-2026', 'Óculos Inteligentes IA', 39990, true)
on conflict (id) do update
  set name = excluded.name,
      price_cents = excluded.price_cents,
      active = excluded.active;

-- ---------------------------------------------------------------------------
-- orders: um pedido por tentativa de checkout. Guarda cliente + endereço em
-- colunas e o valor congelado (amount_cents) no momento da criação.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                 uuid        primary key default gen_random_uuid(),
  product_id         text        not null references public.products (id),
  amount_cents       integer     not null check (amount_cents > 0),
  status             text        not null default 'pending'
                       check (status in ('pending','processing','paid','rejected','cancelled','refunded')),

  -- Cliente
  customer_name      text        not null,
  customer_cpf       text        not null,
  customer_email     text        not null,
  customer_whatsapp  text        not null,

  -- Endereço de entrega
  address_cep          text      not null,
  address_street       text      not null,
  address_number       text      not null,
  address_complement   text,
  address_neighborhood text      not null,
  address_city         text      not null,
  address_state        text      not null,

  -- Pagamento (Mercado Pago)
  mp_payment_id      text,
  mp_status_detail   text,
  payment_method     text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists orders_mp_payment_id_idx on public.orders (mp_payment_id);
create index if not exists orders_status_idx on public.orders (status);

-- Mantém updated_at coerente em qualquer UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: habilitado nas duas tabelas SEM policies públicas.
-- Sem policy, nenhum acesso via anon/authenticated é permitido; apenas a
-- service role (usada dentro das Edge Functions) ignora o RLS. Assim os dados
-- de pedido nunca ficam legíveis a partir do cliente.
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders   enable row level security;
