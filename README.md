# Landing Page — Produto Único (Dropshipping)

Landing page de conversão para um único produto, com checkout completo:
coleta + validação dos dados, criação do pedido no Supabase e pagamento
embutido (cartão + Pix) via Mercado Pago. **Etapas 1, 2 e 3 concluídas.**

> ⚠️ O preço é fixado **no servidor** a partir do `productId`. O frontend
> nunca envia valor — veja [Segurança](#segurança-o-preço-nunca-vem-do-frontend).

## Stack

- [Vite](https://vitejs.dev/) + React 18 + TypeScript (modo estrito, sem `any`)
- Tailwind CSS (componentes próprios, sem bibliotecas de UI)
- React Hook Form + Zod (validação do checkout)
- API pública [ViaCEP](https://viacep.com.br/) para autocomplete de endereço
- [Supabase](https://supabase.com/) (Postgres + Edge Functions em Deno) — backend
- [Mercado Pago](https://www.mercadopago.com.br/) Payment Brick (`@mercadopago/sdk-react`) — pagamento

## Como rodar

```bash
npm install
cp .env.example .env   # depois preencha as chaves (veja Etapa 3)
npm run dev      # http://localhost:5173
npm run build    # typecheck (tsc) + build de produção em dist/
npm run preview  # serve o build de produção localmente
```

> Sem o `.env` preenchido a landing roda normalmente; ao tentar pagar, o
> checkout mostra um aviso pedindo para configurar as chaves (não quebra).

## Estrutura

```
src/
├── App.tsx                 # monta a página + rotas hash (#/termos, #/privacidade)
├── config/
│   └── product.ts          # ÚNICA fonte dos dados do produto (id, nome, preço, imagens)
├── components/
│   ├── Hero.tsx            # título, subtítulo, imagem, CTA → #checkout
│   ├── Benefits.tsx        # 4 cards de benefícios
│   ├── SocialProof.tsx     # depoimentos + selo de compra segura
│   ├── Offer.tsx           # preço, parcelamento, gatilho de escassez
│   ├── Faq.tsx             # accordion acessível (entrega, trocas CDC, pagamento)
│   ├── CheckoutForm.tsx    # formulário RHF + Zod + ViaCEP
│   └── Footer.tsx          # links legais, CNPJ placeholder
│   ├── PaymentStep.tsx     # passo 2: Payment Brick (cartão + Pix) + resultado inline
│   └── Footer.tsx
├── config/
│   ├── product.ts          # dados do produto (id, nome, preço de EXIBIÇÃO, imagens)
│   └── env.ts              # lê VITE_* e valida se o pagamento está configurado
├── pages/                  # Termos, Privacidade (LGPD) e ThankYou (#/obrigado)
└── lib/                    # funções puras e testáveis
    ├── cpf.ts              # maskCpf + isValidCpf (dígitos verificadores reais)
    ├── phone.ts            # maskPhone (00) 00000-0000 + isValidPhone
    ├── cep.ts              # maskCep + fetchAddressByCep (ViaCEP, com AbortSignal)
    ├── money.ts            # formatBRL + installmentCents
    ├── api.ts              # createOrder + processPayment (chama as Edge Functions)
    └── digits.ts           # onlyDigits

supabase/
├── config.toml            # verify_jwt=false apenas para mp-webhook
├── migrations/
│   └── 0001_orders.sql    # tabelas products (preço) e orders (RLS sem policy pública)
└── functions/
    ├── _shared/           # cors, cliente admin (service role), validação server-side
    ├── create-order/      # valida payload, busca preço no banco, cria o pedido
    ├── process-payment/   # cria o pagamento no MP com o valor DO BANCO (Pix/cartão)
    └── mp-webhook/        # valida x-signature e atualiza orders.status
```

### Trocar o produto

Edite apenas [`src/config/product.ts`](src/config/product.ts): id, nome, tagline,
preço em centavos, preço "de" (ancoragem), parcelas, estoque (escassez) e imagens.
Coloque as imagens em `public/images/`.

## Comportamento do checkout

- **CPF**: máscara `000.000.000-00` + validação real dos dígitos verificadores.
- **WhatsApp**: máscara `(00) 00000-0000`, exige celular com nono dígito.
- **CEP**: ao completar 8 dígitos consulta o ViaCEP e preenche rua, bairro,
  cidade e UF (ficam `readonly`). CEP inexistente ou falha de rede → mensagem
  amigável e campos liberados para edição manual. Requisições concorrentes são
  canceladas via `AbortController`.
- **Submit (passo 1)**: monta o payload
  `{ productId, customer: { fullName, cpf, email, whatsapp }, address: { cep, street, number, complement, neighborhood, city, state } }`
  (**sem preço**) e chama a Edge Function `create-order`, que devolve `orderId` e
  o `amountCents` fixado no banco.
- **Pagamento (passo 2)**: o Payment Brick abre no mesmo painel com o valor
  vindo do servidor. Cartão aprovado → `#/obrigado`; cartão recusado → motivo +
  nova tentativa; Pix → QR code + copia-e-cola inline.

## Segurança: o preço nunca vem do frontend

- O formulário envia apenas o `productId`. O valor é lido da tabela `products`
  em `create-order` e recalculado em `process-payment` — qualquer valor no corpo
  do cliente é **ignorado**.
- O **access token** do Mercado Pago e o **secret do webhook** ficam só no
  Supabase (`supabase secrets set`), nunca no bundle. O frontend usa apenas a
  *public key* (`VITE_MP_PUBLIC_KEY`) e a *anon key*.
- A tabela `orders` tem **RLS habilitado sem policy pública**: só a service role
  (dentro das Edge Functions) acessa. Os dados de pedido não são legíveis pelo cliente.
- O webhook valida a assinatura `x-signature` (HMAC-SHA256) antes de confiar na
  notificação, e sempre reconsulta o pagamento na API do MP.

## Etapa 3 — Deploy do backend

Pré-requisito: [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e login feito (`supabase login`).

```bash
# 1. Vincular ao seu projeto Supabase (pegue o ref no painel do projeto)
supabase link --project-ref SEU_PROJECT_REF

# 2. Criar as tabelas products + orders (com seed do preço)
supabase db push

# 3. Publicar as Edge Functions
supabase functions deploy create-order
supabase functions deploy process-payment
supabase functions deploy mp-webhook
supabase functions deploy admin-orders
supabase functions deploy track-order
supabase functions deploy tracking-webhook

# 4. Configurar os segredos do Mercado Pago (NUNCA vão para o frontend)
supabase secrets set MP_ACCESS_TOKEN=seu_access_token
supabase secrets set MP_WEBHOOK_SECRET=seu_secret_do_webhook

# 5. Configurar o e-mail transacional (ver seção "E-mail transacional")
supabase secrets set RESEND_API_KEY=sua_chave_do_resend
supabase secrets set EMAIL_FROM="Óculos IA <pedidos@seudominio.com.br>"
supabase secrets set STORE_URL=https://sua-loja.com.br

# 6. Painel admin e rastreio automático (opcionais)
supabase secrets set ADMIN_API_KEY=uma_chave_longa_e_aleatoria
supabase secrets set TRACK17_API_KEY=sua_chave_do_17track
```

7. **Webhook no painel do Mercado Pago** → *Suas integrações › Webhooks*:
   - URL: `https://SEU_PROJECT_REF.supabase.co/functions/v1/mp-webhook`
   - Evento: **Pagamentos**
   - Copie a *chave secreta* gerada e use-a no `MP_WEBHOOK_SECRET` do passo 4.

8. **Frontend** — preencha o `.env` (a partir do `.env.example`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (painel Supabase › Settings › API)
   e `VITE_MP_PUBLIC_KEY` (painel MP › credenciais).

### E-mail transacional

Os e-mails saem pelo [Resend](https://resend.com) via `fetch`, sem SDK
([`_shared/email.ts`](supabase/functions/_shared/email.ts)). São cinco, montados em
[`_shared/order-mailer.ts`](supabase/functions/_shared/order-mailer.ts):

| E-mail | Disparado por | Quando |
| --- | --- | --- |
| **Pagamento aprovado** | `process-payment` (cartão) e `mp-webhook` (Pix) | assim que o pedido vira `paid` |
| **Pedido despachado** | `admin-orders` (ação `ship`) | quando o admin grava o código de rastreio |
| **Pedido entregue** | `tracking-webhook` (17TRACK) e `admin-orders` (ação `deliver`) | quando o pedido vira `delivered` |
| **Pagamento não aprovado** | `process-payment` (cartão) e `mp-webhook` | o Mercado Pago devolve status `rejected` |
| **Pix expirou** | `mp-webhook` | o Mercado Pago devolve `cancelled` com detalhe `expired` |

Os dois últimos dividem a mesma coluna de controle, então o cliente recebe **no
máximo um** aviso de falha por pedido. Outros cancelamentos são ignorados de
propósito: quando o cliente troca o Pix pelo cartão, o `process-payment` cancela o
Pix antigo, e avisar "pagamento recusado" nesse momento seria falso.

Secrets:

| Secret | Obrigatório | Para quê |
| --- | --- | --- |
| `RESEND_API_KEY` | **sim** | sem ela **nenhum e-mail é enviado** (ver aviso abaixo) |
| `EMAIL_FROM` | recomendado | remetente. Default: `onboarding@resend.dev`, que em produção **só entrega no e-mail dono da conta Resend** — use um domínio verificado em *Resend › Domains* |
| `STORE_URL` | recomendado | base dos links. Vazia, os botões "Acompanhar meu pedido" / "Rastrear entrega" **não são renderizados** |

> **Atenção — falha silenciosa.** Se `RESEND_API_KEY` estiver ausente, `sendEmail`
> apenas loga um aviso e devolve `false`, de propósito: e-mail nunca derruba a
> confirmação de um pagamento. O efeito colateral é que a loja pode rodar sem
> enviar nada e nada quebrar visivelmente. Depois de configurar, confirme com um
> pedido de teste (abaixo).

**Idempotência.** Cada e-mail sai no máximo uma vez por pedido. O controle são as
colunas `paid_email_sent_at`, `shipped_email_sent_at` ([`0002_fulfillment.sql`](supabase/migrations/0002_fulfillment.sql)),
`delivered_email_sent_at` e `payment_failed_email_sent_at` ([`0006_delivered_and_failed_emails.sql`](supabase/migrations/0006_delivered_and_failed_emails.sql)):
a função faz um `update ... where <coluna> is null` e só envia se aquele update
devolveu a linha. Assim, se `process-payment` e `mp-webhook` confirmarem o mesmo
pedido, só o primeiro dispara. Se o Resend recusar, o claim volta para `null`
para permitir nova tentativa.

Consequência prática para diagnóstico: **`paid_email_sent_at` preenchido significa
que o Resend aceitou a mensagem** — é a forma mais confiável de auditar envios,
já que os logs têm retenção curta (1 dia nas Edge Functions no plano Free, 30
dias no Resend).

```sql
-- quais pedidos pagos ficaram sem e-mail
select order_number, status, created_at, paid_email_sent_at, shipped_email_sent_at,
       delivered_email_sent_at, payment_failed_email_sent_at
from orders order by created_at desc;
```

Para reenviar um e-mail, zere a coluna correspondente e refaça a ação que o
dispara (`update orders set paid_email_sent_at = null where id = '...';`).

### Ajustar o preço

O preço de cobrança vive na tabela `products` (coluna `price_cents`), definido no
seed de [`0001_orders.sql`](supabase/migrations/0001_orders.sql). Para alterá-lo,
rode um `update public.products set price_cents = ... where id = '...';` no banco.
O preço em [`product.ts`](src/config/product.ts) é só para **exibição** na landing.

### Testar (sandbox do Mercado Pago)

Use as credenciais de **teste** e os
[cartões de teste do MP](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/additional-content/test-cards):
aprovado (nome do titular `APRO`), recusado (`OTHE`) e Pix sandbox. Confira o
pedido mudando de `pending` → `paid`/`rejected` na tabela `orders` após o webhook.

**Conferindo os e-mails.** O de pagamento sai sozinho quando o pedido vira `paid`.
O de despacho exige a ação `ship` do painel (`#/admin`, autenticado com
`ADMIN_API_KEY`) — e ela só aceita pedidos já **pagos**. Para testar sem tocar em
um pedido real, crie um pedido de teste com o **seu** e-mail, marque-o como pago
e despache-o pelo painel:

```sql
insert into orders (
  product_id, customer_name, customer_email, customer_whatsapp, customer_cpf,
  address_cep, address_street, address_number, address_neighborhood,
  address_city, address_state, amount_cents, status
) values (
  (select id from products limit 1), 'Teste E-mail', 'voce@exemplo.com',
  '11999999999', '00000000000', '01001000', 'Rua Teste', '1', 'Centro',
  'São Paulo', 'SP', (select price_cents from products limit 1), 'paid'
) returning id, order_number;
```

Depois confira a entrega em *Resend › Emails* e apague o pedido de teste.

## Fora do escopo

Boleto, testes unitários das libs (`cpf`, `phone`, `cep`), analytics/pixel e
textos jurídicos definitivos.

E-mail transacional, rastreio e painel de pedidos **já foram implementados** —
veja [E-mail transacional](#e-mail-transacional) e as funções `admin-orders`,
`track-order` e `tracking-webhook`.
