# Rastreio automático via 17TRACK

Acompanha automaticamente os pedidos enviados (AliExpress/Cainiao e outras
transportadoras). Ao despachar um pedido no painel, o número é registrado no
17TRACK; ele então empurra as atualizações para esta função, que grava a linha
do tempo de eventos em `orders` e marca o pedido como **entregue** quando for o
caso.

## Peças

- `_shared/track17.ts` — registra número, mapeia status, normaliza eventos.
- `admin-orders` (ação `ship`) — registra o número ao despachar.
- `tracking-webhook` — recebe o push, **valida a assinatura** e grava o estado.
- `track-order` — devolve os eventos ao cliente.
- Migration `0005_tracking_provider.sql` — colunas `carrier`, `tracking_status`,
  `tracking_events` (jsonb), `tracking_synced_at`.

## Assinatura do webhook (segurança)

O 17TRACK envia o header `sign` = `SHA-256( corpo_cru + "/" + TRACK17_API_KEY )`
em hex. A função recalcula e compara em tempo constante. Corpo **cru** — não
reserializar o JSON antes de verificar.

## Setup (uma vez)

1. Crie a conta e assine a **Tracking API** em <https://api.17track.net> e copie
   a **Security API Key**.
2. Configure o secret (projeto real = `uxzgtlkznkfrcvakihru`):
   ```bash
   supabase secrets set TRACK17_API_KEY=xxxxxxxx --project-ref uxzgtlkznkfrcvakihru
   ```
3. Aplique a migration e faça deploy das funções:
   ```bash
   supabase db push --project-ref uxzgtlkznkfrcvakihru
   supabase functions deploy tracking-webhook admin-orders track-order --project-ref uxzgtlkznkfrcvakihru
   ```
4. No painel do 17TRACK → **Settings → Webhook**, aponte a URL para:
   ```
   https://uxzgtlkznkfrcvakihru.functions.supabase.co/tracking-webhook
   ```
   e ative o push. Pronto — os próximos despachos passam a atualizar sozinhos.

## Opcional

- `TRACK17_BASE` — sobrescreve a versão da API (padrão `.../track/v2.2`).
- Se preferir não expor o webhook, dá para trocar por um poller agendado
  chamando `gettrackinfo` — a base em `track17.ts` já está pronta para isso.
