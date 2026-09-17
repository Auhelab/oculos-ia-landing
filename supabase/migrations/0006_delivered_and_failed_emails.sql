-- Etapa 6 — e-mails de "pedido entregue" e de "pagamento não concluído".
-- Mesmo mecanismo de idempotência de 0002_fulfillment.sql: gravamos o instante
-- do envio e só enviamos quando a coluna ainda é NULL (claim atômico via UPDATE
-- condicional). Apenas colunas novas — nada existente é alterado.

-- Pedido entregue (tracking-webhook ou ação "deliver" do painel admin).
alter table public.orders add column if not exists delivered_email_sent_at timestamptz;

-- Pagamento recusado (cartão) ou Pix expirado. Um por pedido: se o cliente
-- tentar de novo no mesmo pedido e falhar outra vez, não reenviamos.
alter table public.orders add column if not exists payment_failed_email_sent_at timestamptz;
