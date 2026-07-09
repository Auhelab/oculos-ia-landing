interface Testimonial {
  quote: string;
  name: string;
  location: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Usei na viagem pro Chile e a tradução por voz salvou demais. Aponto, falo e ele traduz na hora — parece coisa de filme.",
    name: "Mariana S.",
    location: "São Paulo, SP",
  },
  {
    quote:
      "A câmera surpreende pra um óculos: fotos nítidas e vídeo estabilizado. Gravo os passeios de bike inteiros em primeira pessoa.",
    name: "Rafael T.",
    location: "Belo Horizonte, MG",
  },
  {
    quote:
      "Leve e confortável, uso o dia todo. Atendo chamadas e ouço música sem fone no ouvido — e ninguém percebe.",
    name: "Juliana M.",
    location: "Recife, PE",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 text-amber-300" role="img" aria-label="Avaliação: 5 de 5 estrelas">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

export default function SocialProof() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
              Quem comprou, recomenda.
            </h2>
            <p className="mt-3 text-lg text-white/60">
              Nota média <strong className="text-white">4,6 de 5</strong> — mais de 2.000 unidades
              vendidas.
            </p>
          </div>
          <div
            className="glass-pill inline-flex items-center gap-3 px-5 py-3"
            aria-label="Selo de compra segura"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-emerald-400"
              aria-hidden="true"
            >
              <path d="M12 2l8 3.5v5.1c0 5-3.4 9.6-8 11.4-4.6-1.8-8-6.4-8-11.4V5.5L12 2Z" />
              <path d="M8.5 12l2.4 2.4L15.5 9.8" />
            </svg>
            <div className="text-sm leading-tight">
              <p className="font-semibold text-white">Compra 100% segura</p>
              <p className="text-white/50">Dados protegidos com SSL</p>
            </div>
          </div>
        </div>

        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <li key={t.name} className="glass flex flex-col p-8">
              <Stars />
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-white/70">
                “{t.quote}”
              </blockquote>
              <footer className="mt-6 text-sm">
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-white/50">{t.location}</p>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
