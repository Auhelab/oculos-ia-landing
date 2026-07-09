import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const faqItems: FaqItem[] = [
  {
    question: "Qual o prazo de entrega?",
    answer:
      "O prazo de entrega é de 15 a 40 dias úteis, dependendo da sua região. Assim que o pedido for postado, você recebe o código de rastreio por e-mail e WhatsApp para acompanhar cada etapa.",
  },
  {
    question: "Posso trocar ou devolver o produto?",
    answer:
      "Sim. Conforme o art. 49 do Código de Defesa do Consumidor, você tem até 7 dias corridos após o recebimento para desistir da compra, com reembolso integral. Além disso, oferecemos 90 dias de garantia contra defeitos de fabricação.",
  },
  {
    question: "Quais são as formas de pagamento?",
    answer:
      "Aceitamos cartão de crédito em até 12x e Pix (com confirmação imediata). O pagamento é processado em ambiente seguro e criptografado — nenhum dado do seu cartão fica salvo em nosso site.",
  },
  {
    question: "Preciso de aplicativo para usar?",
    answer:
      "Sim, o aplicativo gratuito (Android e iOS) é instalado via QR Code do manual. É por ele que você transfere fotos e vídeos, configura a tradução por IA e atualiza os óculos. A música e as chamadas funcionam por Bluetooth, direto com o celular.",
  },
  {
    question: "Como acompanho o meu pedido?",
    answer:
      "Depois da postagem, enviamos o código de rastreio por e-mail e WhatsApp. Com ele, você acompanha a viagem do produto até a sua casa em tempo real.",
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          Perguntas frequentes.
        </h2>

        <div className="glass mt-10 divide-y divide-white/10 px-6 sm:px-8">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question}>
                <h3>
                  <button
                    type="button"
                    id={`faq-trigger-${index}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left font-display text-lg font-bold tracking-tight transition hover:text-cyan-300"
                  >
                    {item.question}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-45 text-cyan-300" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </h3>
                <div
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 text-[15px] leading-relaxed text-white/60">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
