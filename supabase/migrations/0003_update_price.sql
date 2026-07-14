-- Atualiza o preço de venda do produto único para R$ 397,00 (39700 centavos).
-- O preço vive na tabela products (fonte de verdade da cobrança). Pedidos já
-- criados mantêm o amount_cents congelado no momento da criação; apenas novos
-- pedidos passam a usar o novo valor.
update public.products
set price_cents = 39700
where id = 'oculos-inteligentes-ia-2026';
