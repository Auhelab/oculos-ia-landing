import LegalShell from "./LegalShell";

export default function TermsOfUse() {
  return (
    <LegalShell title="Termos de Uso">
      <section>
        <h2 className="text-lg font-semibold text-ink">1. Sobre a loja</h2>
        <p className="mt-2">
          Este site é operado por Razão Social Placeholder LTDA (CNPJ 00.000.000/0001-00). Ao
          realizar um pedido, você concorda com as condições descritas nestes Termos de Uso.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">2. Prazo de entrega</h2>
        <p className="mt-2">
          Os pedidos são enviados com código de rastreio e o prazo de entrega estimado é de 15 a
          40 dias úteis, variando conforme a região de destino e o processamento logístico.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">3. Trocas e devoluções</h2>
        <p className="mt-2">
          Em conformidade com o art. 49 do Código de Defesa do Consumidor, o cliente pode desistir
          da compra em até 7 dias corridos após o recebimento, com direito a reembolso integral.
          Produtos com defeito de fabricação são cobertos por garantia de 90 dias.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">4. Pagamento</h2>
        <p className="mt-2">
          Os pagamentos são processados por instituições de pagamento parceiras em ambiente
          seguro. Esta loja não armazena dados de cartão de crédito.
        </p>
      </section>
    </LegalShell>
  );
}
