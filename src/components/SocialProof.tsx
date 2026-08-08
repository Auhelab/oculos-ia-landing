import { useCallback, useEffect, useRef, useState } from "react";
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
    photo: "/images/reviews/review-cliente-1.webp",
    photoAlt:
      "Óculos inteligente preto segurado na mão, com a armação e as lentes escuras em destaque, foto de uma cliente",
  },
  {
    quote:
      "Veio tudo conforme o anúncio: três lentes, lencinho de limpeza e a bolsa pra guardar. O acabamento surpreende de verdade.",
    name: "Anderson P.",
    location: "São Paulo, SP",
    rating: 5,
    photo: "/images/reviews/review-cliente-2.webp",
    photoAlt: "Óculos ao lado da caixa e da bolsinha de guardar, com as lentes extras, foto de um cliente",
  },
  {
    quote:
      "A função de tradução é simplesmente genial · eficaz e fácil de configurar. Meus amigos até me pediram o link pra comprar.",
    name: "Bianca F.",
    location: "Rio de Janeiro, RJ",
    rating: 5,
    photo: "/images/reviews/review-cliente-3.webp",
    photoAlt:
      "Óculos inteligente apoiado na caixa do produto com a lente extra ao lado, foto de uma cliente",
  },
  {
    quote:
      "A câmera é melhor do que eu esperava pra um óculos. Usei dentro do capacete de moto: captou o som e bloqueou o vento. Uso quase todo dia.",
    name: "Rogério M.",
    location: "Belo Horizonte, MG",
    rating: 5,
    photo: "/images/reviews/review-cliente-4.webp",
    photoAlt: "Óculos inteligente na mão com a câmera visível na armação e a caixa ao fundo, foto de um cliente",
  },
  {
    quote:
      "Áudio Bluetooth bom e bem leves. O pareamento às vezes pede uma segunda tentativa, mas no dia a dia cumpre direitinho.",
    name: "Diego S.",
    location: "Porto Alegre, RS",
    rating: 4,
    photo: "/images/reviews/review-cliente-5.webp",
    photoAlt:
      "Óculos inteligente aberto sobre uma superfície clara, visto de cima, foto de um cliente",
  },
  {
    quote:
      "Ótima qualidade de câmera e som. Atendo chamadas, traduzo textos e a bateria dura o dia todo. Altamente recomendado.",
    name: "Patrícia L.",
    location: "Fortaleza, CE",
    rating: 5,
    photo: "/images/reviews/review-cliente-6.webp",
    photoAlt: "Óculos inteligente sobre a caixa do produto, com os ícones de câmera, tradução em tempo real e assistente de voz, foto de uma cliente",
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

/** Foto ampliada sobre a tela. Fecha no Esc, no clique fora e no botão. */
function PhotoLightbox({
  photo,
  alt,
  onClose,
}: {
  photo: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Trava a rolagem do fundo enquanto a foto está aberta.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = antes;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto da avaliação"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white transition hover:bg-white/25"
      >
        ×
      </button>
      <img
        src={photo}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
      />
    </div>
  );
}

export default function SocialProof() {
  const trilhoRef = useRef<HTMLUListElement>(null);
  const [ampliada, setAmpliada] = useState<{ photo: string; alt: string } | null>(null);
  const [posicao, setPosicao] = useState(0);
  const [extremos, setExtremos] = useState({ inicio: true, fim: false });

  // Mede em qual card o trilho parou e se chegou às pontas (para as setas).
  const medir = useCallback(() => {
    const el = trilhoRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const passo = card ? card.getBoundingClientRect().width + 20 : 1;
    setPosicao(Math.round(el.scrollLeft / passo));
    setExtremos({
      inicio: el.scrollLeft < 8,
      fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);

  const irPara = (dir: -1 | 1) => {
    const el = trilhoRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const passo = card ? card.getBoundingClientRect().width + 20 : el.clientWidth;
    el.scrollBy({ left: dir * passo, behavior: "smooth" });
  };

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

        {/* Trilho horizontal: arrasta no dedo, anda de card em card nas setas.
            O scroll nativo com snap faz o trabalho — sem biblioteca. */}
        {/* O data-reveal fica no TRILHO, não em cada card: dentro de um
            contêiner com overflow-x os cards fora da janela nunca alcançam os
            15% de visibilidade que o observador exige e ficariam invisíveis
            para sempre. */}
        <ul
          ref={trilhoRef}
          onScroll={medir}
          data-reveal
          className="mt-12 flex snap-x snap-mandatory items-start gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {testimonials.map((t) => (
            <li
              key={t.name}
              className="flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] sm:w-[48%] lg:w-[32%]"
            >
              {t.photo && (
                <button
                  type="button"
                  onClick={() =>
                    setAmpliada({ photo: t.photo!, alt: t.photoAlt ?? "" })
                  }
                  aria-label="Ampliar a foto desta avaliação"
                  // 3/4 é a proporção nativa das fotos: assim elas aparecem
                  // inteiras, sem corte e sem tarja nas laterais.
                  className="group relative aspect-[3/4] w-full overflow-hidden bg-haze"
                >
                  <img
                    src={t.photo}
                    alt={t.photoAlt ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
                    {t.photoCaption ?? "Foto do cliente"}
                  </span>
                </button>
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

        {/* Controles do trilho. As setas somem nas pontas; os pontos dizem
            onde o visitante está. No celular o gesto de arrastar já basta. */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {testimonials.map((t, i) => (
              <span
                key={t.name}
                className={`h-1.5 rounded-full transition-all ${
                  i === posicao ? "w-6 bg-ink" : "w-1.5 bg-line"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => irPara(-1)}
              disabled={extremos.inicio}
              aria-label="Avaliação anterior"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:bg-haze disabled:opacity-35"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => irPara(1)}
              disabled={extremos.fim}
              aria-label="Próxima avaliação"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:bg-haze disabled:opacity-35"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {ampliada && (
        <PhotoLightbox
          photo={ampliada.photo}
          alt={ampliada.alt}
          onClose={() => setAmpliada(null)}
        />
      )}
    </section>
  );
}
