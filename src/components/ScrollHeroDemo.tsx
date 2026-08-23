import { useEffect, useRef, useState } from "react";

/**
 * PROTÓTIPO (rota #/demo) — scroll cinematográfico SEM giro 360°.
 *
 * A ideia: em vez de raspar 120 frames de um turntable (que a IA não consegue
 * gerar sem inventar a câmera do produto), a gente COREOGRAFA duas fotos reais
 * de estúdio — frontal e 3/4 — dirigidas pelo scroll. O crossfade entre elas,
 * com escala e inclinação, dá a sensação de volume sem precisar do giro.
 *
 * Estrutura: seção alta (500vh) com o palco sticky ocupando a viewport.
 * O progresso (0→1) encadeia 3 atos:
 *  - 0.00–0.12  ENTRADA: materializa (blur→nítido, fade-in, escala 0.82→1)
 *  - 0.12–0.78  FEATURES: push-in lento + crossfade frontal→3/4 + as 3 legendas
 *               entrando alternando de lado, com a palavra gigante em parallax
 *  - 0.78–1.00  MERGULHO: acelera na direção do usuário (escala →4), desfoca,
 *               sai da tela e revela o CTA
 *
 * Só transform/opacity/filter (composited, 60fps). Fallback estático sob
 * prefers-reduced-motion.
 */

const IMG_FRONT = "/images/spin/000.webp";
const IMG_ANGLE = "/images/spin/015.webp";

const ACT2_START = 0.12;
const ACT2_END = 0.78;

interface Beat {
  word: string;
  eyebrow: string;
  title: string;
  text: string;
  side: "left" | "right";
  at: number; // centro da janela, em progresso do ato 2 (0..1)
}

const beats: Beat[] = [
  {
    word: "TRADUÇÃO",
    eyebrow: "Tradução por IA",
    title: "Fale qualquer idioma.",
    text: "Mais de 100 idiomas traduzidos em tempo real, com a resposta falada direto no seu ouvido.",
    side: "left",
    at: 0.16,
  },
  {
    word: "CÂMERA",
    eyebrow: "Câmera HD 8MP",
    title: "Registre em primeira pessoa.",
    text: "Fotos nítidas e vídeos em alta definição com um toque na haste · sem tirar o celular do bolso.",
    side: "right",
    at: 0.5,
  },
  {
    word: "MÚSICA",
    eyebrow: "Áudio aberto",
    title: "Sua trilha sonora, sem fones.",
    text: "Música, chamadas e assistente de voz por Bluetooth, com áudio direcionado só para você.",
    side: "left",
    at: 0.84,
  },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Janela triangular suavizada centrada em `center`, com meia-largura `half`. */
function window01(p: number, center: number, half: number) {
  const d = Math.abs(p - center) / half;
  return d >= 1 ? 0 : (1 - d) * (1 - d) * (3 - 2 * (1 - d));
}

export default function ScrollHeroDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const frontRef = useRef<HTMLImageElement>(null);
  const angleRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const finalRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const front = frontRef.current;
    const angle = angleRef.current;
    if (!section || !stage || !front || !angle) return;

    let rafId = 0;

    // Progresso cru (0→1) do scroll dentro do trilho pinado
    const readTarget = () => {
      const total = section.offsetHeight - window.innerHeight;
      const rect = section.getBoundingClientRect();
      return total > 0 ? clamp01(-rect.top / total) : 0;
    };

    const render = (p: number) => {
      // Progresso dentro do ato 2 (features)
      const p2 = clamp01((p - ACT2_START) / (ACT2_END - ACT2_START));

      // ---- Palco: escala / desfoque / opacidade encadeados nos 3 atos ----
      let scale: number;
      let blur: number;
      let fade: number;
      let lift = 0; // deslocamento vertical no mergulho
      if (p < ACT2_START) {
        const pe = clamp01(p / ACT2_START);
        fade = pe;
        blur = (1 - pe) * 14;
        scale = 0.82 + pe * 0.18; // 0.82 → 1.0
      } else if (p <= ACT2_END) {
        fade = 1;
        blur = 0;
        scale = 1 + p2 * 0.22; // push-in lento 1.0 → 1.22
      } else {
        const pd = clamp01((p - ACT2_END) / (1 - ACT2_END));
        // Aceleração quadrática: o produto vem na direção do usuário e SAI da tela
        scale = 1.22 + pd * pd * 2.9; // 1.22 → ~4.1
        blur = pd * pd * 14;
        lift = -pd * pd * 18; // sobe levemente ao passar pelo espectador
        fade = 1 - clamp01((pd - 0.45) / 0.5);
      }

      // Inclinação sutil durante o ato 2 — dá a sensação de volume sem girar
      const tilt = p <= ACT2_END ? (p2 - 0.5) * 7 : 0;
      stage.style.opacity = String(fade);
      stage.style.transform = `translateY(${lift}%) scale(${scale.toFixed(3)}) rotateY(${tilt.toFixed(2)}deg)`;
      stage.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : "none";

      // ---- Crossfade frontal → 3/4 (o "volume" sem giro) ----
      // Troca no miolo do ato 2, com uma curva suave.
      const mix = clamp01((p2 - 0.28) / 0.34);
      const eased = mix * mix * (3 - 2 * mix);
      front.style.opacity = String(1 - eased);
      angle.style.opacity = String(eased);

      // ---- Palavra gigante ao fundo, em parallax (mais lenta que o produto) ----
      let active = -1;
      let best = 0;
      beats.forEach((beat, i) => {
        const vis = p > ACT2_END ? 0 : window01(p2, beat.at, 0.2);
        const cap = capRefs.current[i];
        if (cap) {
          cap.style.opacity = String(vis);
          cap.style.filter = `blur(${(1 - vis) * 6}px)`;
          cap.style.transform = `translateY(${(1 - vis) * 18}px)`;
        }
        if (vis > best) {
          best = vis;
          active = i;
        }
      });

      if (wordRef.current) {
        wordRef.current.style.opacity = String(best * 0.07);
        wordRef.current.style.transform = `translateY(${(0.5 - p2) * 60}px) scale(${(1 + best * 0.06).toFixed(3)})`;
        if (active >= 0) wordRef.current.textContent = beats[active].word;
      }

      // ---- Desfecho ----
      const finalVis = p > ACT2_END ? clamp01((p - 0.9) / 0.07) : 0;
      if (finalRef.current) {
        finalRef.current.style.opacity = String(finalVis);
        finalRef.current.style.transform = `translateY(${(1 - finalVis) * 22}px)`;
        finalRef.current.style.pointerEvents = finalVis > 0.6 ? "auto" : "none";
      }

      dotRefs.current.forEach((dot, i) => {
        if (dot) dot.style.opacity = p <= ACT2_END && i === active ? "1" : "0.25";
      });
    };

    // Inércia estilo Apple: renderP persegue targetP com atraso (scrub amanteigado)
    const SMOOTH = 0.12;
    let targetP = readTarget();
    let renderP = targetP;
    let lastRP = -1;
    let running = false;

    const loop = () => {
      targetP = readTarget();
      renderP += (targetP - renderP) * SMOOTH;
      if (Math.abs(targetP - renderP) < 0.0002) renderP = targetP;
      if (renderP !== lastRP) {
        render(renderP);
        lastRP = renderP;
      }
      if (running) rafId = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      targetP = renderP = readTarget();
      render(renderP);
      lastRP = renderP;
    };

    // Só anima com o palco na viewport (poupa bateria fora dela)
    const io = new IntersectionObserver(
      (entries) => (entries[0].isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(section);

    render(renderP);
    const onResize = () => {
      targetP = renderP = readTarget();
      render(renderP);
      lastRP = renderP;
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      io.disconnect();
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [reduced]);

  // Fallback estático: produto + as 3 features empilhadas
  if (reduced) {
    return (
      <section aria-label="Destaques do produto" className="py-24">
        <div className="mx-auto max-w-page px-6">
          <img
            src={IMG_FRONT}
            alt="Óculos inteligentes pretos com câmera integrada na armação"
            className="mx-auto w-full max-w-2xl"
            loading="lazy"
            decoding="async"
          />
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {beats.map((b) => (
              <div key={b.word}>
                <p className="eyebrow">{b.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-bold tracking-[-0.02em]">{b.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} aria-label="Destaques do produto" className="relative h-[500vh]">
      <div
        className="sticky top-0 flex h-screen items-center justify-center overflow-hidden"
        style={{ perspective: "1200px" }}
      >
        {/* Palavra gigante ao fundo (parallax) */}
        <div
          ref={wordRef}
          aria-hidden="true"
          className="pointer-events-none absolute select-none text-[22vw] font-extrabold leading-none tracking-[-0.04em] text-ink will-change-[opacity,transform]"
          style={{ opacity: 0 }}
        >
          TRADUÇÃO
        </div>

        {/* Palco do produto: duas fotos empilhadas em crossfade */}
        <div
          ref={stageRef}
          className="relative z-10 w-[min(92vw,58rem)] will-change-[transform,filter,opacity]"
        >
          <img
            ref={frontRef}
            src={IMG_FRONT}
            alt="Óculos inteligentes vistos de frente"
            className="w-full"
            decoding="async"
          />
          <img
            ref={angleRef}
            src={IMG_ANGLE}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full"
            style={{ opacity: 0 }}
            decoding="async"
          />
        </div>

        {/* Legendas das 3 features */}
        {beats.map((beat, i) => (
          <div
            key={beat.title}
            className={`absolute inset-x-6 bottom-[8%] z-20 md:inset-x-auto md:bottom-auto md:top-1/2 md:w-[21rem] md:-translate-y-1/2 ${
              beat.side === "left" ? "md:left-[6%]" : "md:right-[6%]"
            }`}
          >
            <div
              ref={(el) => {
                capRefs.current[i] = el;
              }}
              className="rounded-3xl text-center will-change-[opacity,transform] md:bg-white/70 md:p-7 md:text-left md:backdrop-blur-xl"
              style={{ opacity: 0 }}
            >
              <p className="eyebrow">{beat.eyebrow}</p>
              <h3 className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                {beat.title}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base md:mx-0">
                {beat.text}
              </p>
            </div>
          </div>
        ))}

        {/* Desfecho + CTA */}
        <div className="pointer-events-none absolute inset-x-6 bottom-[10%] z-30 text-center">
          <div ref={finalRef} className="will-change-[opacity,transform]" style={{ opacity: 0 }}>
            <h2 className="text-3xl font-extrabold sm:text-5xl">
              Tudo isso, num só óculos.
            </h2>
            <a href="#checkout" className="btn-primary mt-6 px-8">
              Garantir o meu
            </a>
          </div>
        </div>

        {/* Progresso das features */}
        <div className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {beats.map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              className="h-1.5 w-7 rounded-full bg-ink"
              style={{ opacity: i === 0 ? 1 : 0.25 }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
