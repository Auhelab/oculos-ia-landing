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

# 3. Publicar as três Edge Functions
supabase functions deploy create-order
supabase functions deploy process-payment
supabase functions deploy mp-webhook

# 4. Configurar os segredos do Mercado Pago (NUNCA vão para o frontend)
supabase secrets set MP_ACCESS_TOKEN=seu_access_token
supabase secrets set MP_WEBHOOK_SECRET=seu_secret_do_webhook
```

5. **Webhook no painel do Mercado Pago** → *Suas integrações › Webhooks*:
   - URL: `https://SEU_PROJECT_REF.supabase.co/functions/v1/mp-webhook`
   - Evento: **Pagamentos**
   - Copie a *chave secreta* gerada e use-a no `MP_WEBHOOK_SECRET` do passo 4.

6. **Frontend** — preencha o `.env` (a partir do `.env.example`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (painel Supabase › Settings › API)
   e `VITE_MP_PUBLIC_KEY` (painel MP › credenciais).

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

## Fora do escopo (Etapa 4 sugerida)

E-mail transacional, rastreio, painel de pedidos, boleto, testes unitários das
libs (`cpf`, `phone`, `cep`), analytics/pixel e textos jurídicos definitivos.
