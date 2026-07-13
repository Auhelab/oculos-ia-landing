import LegalShell from "./LegalShell";

export default function PrivacyPolicy() {
  return (
    <LegalShell title="Política de Privacidade">
      <section>
        <h2 className="text-lg font-semibold text-ink">1. Dados coletados</h2>
        <p className="mt-2">
          Coletamos apenas os dados necessários para processar e entregar o seu pedido: nome
          completo, CPF, e-mail, telefone/WhatsApp e endereço de entrega.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">2. Finalidade e base legal (LGPD)</h2>
        <p className="mt-2">
          O tratamento dos dados tem como base legal a execução de contrato (art. 7º, V, da Lei
          nº 13.709/2018 — LGPD): emissão de nota fiscal, envio do produto e comunicação sobre o
          status do pedido. Não vendemos nem compartilhamos seus dados para fins de marketing de
          terceiros.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">3. Compartilhamento</h2>
        <p className="mt-2">
          Os dados podem ser compartilhados apenas com operadores essenciais: transportadoras,
          meios de pagamento e ferramentas de emissão fiscal, sempre limitados à finalidade da
          entrega.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">4. Seus direitos</h2>
        <p className="mt-2">
          Você pode solicitar a qualquer momento a confirmação, correção, anonimização ou exclusão
          dos seus dados pelo e-mail contato@placeholder.com.br, conforme os arts. 18 a 20 da LGPD.
        </p>
      </section>
    </LegalShell>
  );
}
