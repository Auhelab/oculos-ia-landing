-- Etapa 7 — aviso de venda nova para o dono da loja.
-- Trava própria, separada de paid_email_sent_at: o aviso ao dono não pode
-- depender do e-mail do cliente dar certo (endereço digitado errado não pode
-- esconder uma venda), nem repetir quando o e-mail do cliente é reenviado.
alter table public.orders add column if not exists sale_notified_at timestamptz;
