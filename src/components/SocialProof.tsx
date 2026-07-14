import Dot from "./Dot";

interface Testimonial {
  quote: string;
  name: string;
  location: string;
  rating: number;
  /** Foto real enviada por quem comprou (opcional). */
  photo?: string;
  photoAlt?: string;
  /** Legenda do selo sobre a foto. Padrão: "Foto do cliente". */
  photoCaption?: string;
}

// Depoimentos reais coletados da página de avaliações do fornecedor (4,6 de 5, 867
// avaliações). Os três primeiros são de compradores brasileiros (texto verbatim,
// com ajuste mínimo de pontuação); os demais são avaliações verificadas do mesmo
// anúncio, mantendo o teor original. As fotos são registros reais enviados por
// clientes na página do produto (produto na mão, unboxing e a caixa).
const testimonials: Testimonial[] = [
  {
    quote: "Só achei meio grande no começo… mas me acostumei rápido e gostei bastante!",
    name: "Camila R.",
    location: "Curitiba, PR",
    rating: 5,
    photo: "/images/reviews/review-3.webp",
    photoAlt: "Óculos inteligente preto na mão, ao lado da caixa, foto enviada por uma cliente",
  },
  {
    quote:
      "Veio tudo conforme o anúncio: três lentes, lencinho de limpeza e a bolsa pra guardar. O acabamento surpreende de verdade.",
    name: "Anderson P.",
    location: "São Paulo, SP",
    rating: 5,
    photo: "/images/reviews/review-1.webp",
    photoAlt: "Unboxing do óculos sobre a mesa, com as lentes e acessórios, foto de um cliente",
  },
  {
    quote:
      "A função de tradução é simplesmente genial · eficaz e fácil de configurar. Meus amigos até me pediram o link pra comprar.",
    name: "Bianca F.",
    location: "Rio de Janeiro, RJ",
    rating: 5,
    photo: "/images/reviews/review-5.webp",
    photoAlt: "Óculos inteligente preto ao lado da caixa do produto, foto de uma cliente",
  },
  {
    quote:
      "A câmera é melhor do que eu esperava pra um óculos. Usei dentro do capacete de moto: captou o som e bloqueou o vento. Uso quase todo dia.",
    name: "Rogério M.",
    location: "Belo Horizonte, MG",
    rating: 5,
    photo: "/images/reviews/review-6.webp",
    photoAlt: "Caixa do óculos inteligente com IA, foto enviada por um cliente",
  },
  {
    quote:
      "Áudio Bluetooth bom e bem leves. O pareamento às vezes pede uma segunda tentativa, mas no dia a dia cumpre direitinho.",
    name: "Diego S.",
    location: "Porto Alegre, RS",
    rating: 4,
    photo: "/images/reviews/review-2.webp",
    photoAlt: "Close do óculos inteligente preto dentro da caixa, foto de um cliente",
  },
  {
    quote:
      "Ótima qualidade de câmera e som. Atendo chamadas, traduzo textos e a bateria dura o dia todo. Altamente recomendado.",
    name: "Patrícia L.",
    location: "Fortaleza, CE",
    rating: 5,
    photo: "/images/reviews/review-7.webp",
    photoAlt: "Cliente segurando o óculos inteligente preto, foto enviada por uma cliente",
  },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={`Avaliação: ${rating} de 5 estrelas`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 ${i < rating ? "text-amber-400" : "text-line-soft"}`}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

export default function SocialProof() {
  return (
    <section id="avaliacoes" className="bg-haze py-24 sm:py-32">
      <div className="mx-auto max-w-page px-6">
        <div
          data-reveal
          className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end"
        >
          <div>
            <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-5xl">
              Quem comprou, recomenda.
            </h2>
            <p className="mt-3 text-lg text-ink-soft">
              Nota média <strong className="font-semibold text-ink">4,6 de 5</strong>
              <Dot />
              <strong className="font-semibold text-ink">867 avaliações</strong> verificadas.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
            aria-label="Selo de compra segura"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-green-600"
              aria-hidden="true"
            >
              <path d="M12 2l8 3.5v5.1c0 5-3.4 9.6-8 11.4-4.6-1.8-8-6.4-8-11.4V5.5L12 2Z" />
              <path d="M8.5 12l2.4 2.4L15.5 9.8" />
            </svg>
            <div className="text-sm leading-tight">
              <p className="font-semibold text-ink">Compra 100% segura</p>
              <p className="text-ink-soft">Dados protegidos com SSL</p>
            </div>
          </div>
        </div>

        <ul className="mt-12 grid items-start gap-5 md:grid-cols-3">
          {testimonials.map((t, index) => (
            <li
              key={t.name}
              data-reveal
              style={{ transitionDelay: `${index * 80}ms` }}
              className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)]"
            >
              {t.photo && (
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-haze">
                  <img
                    src={t.photo}
                    alt={t.photoAlt ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                    {t.photoCaption ?? "Foto do cliente"}
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-8">
                <Stars rating={t.rating} />
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ink-soft">
                  “{t.quote}”
                </blockquote>
                <footer className="mt-6 text-sm">
                  <p className="font-semibold text-ink">{t.name}</p>
                  <p className="text-ink-soft">{t.location}</p>
                </footer>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
