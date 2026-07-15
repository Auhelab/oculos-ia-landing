-- Número de pedido sequencial legível (#318798+), só para exibição/rastreio.
-- O id UUID continua sendo o identificador interno (external_reference do MP);
-- este número nunca toca a camada de pagamento.
create sequence if not exists public.orders_order_number_seq
  start with 318798 increment by 1;

alter table public.orders
  add column if not exists order_number bigint;

-- Default só para linhas NOVAS: linhas legadas ficam NULL, o 1º pedido = 318798.
alter table public.orders
  alter column order_number set default nextval('public.orders_order_number_seq');

alter sequence public.orders_order_number_seq owned by public.orders.order_number;

create unique index if not exists orders_order_number_key
  on public.orders (order_number);
