import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import SpinShowcase from "./components/SpinShowcase";
import Stats from "./components/Stats";
import Benefits from "./components/Benefits";
import SocialProof from "./components/SocialProof";
import Offer from "./components/Offer";
import Faq from "./components/Faq";
import CheckoutForm from "./components/CheckoutForm";
import Footer from "./components/Footer";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ThankYou from "./pages/ThankYou";
import TrackOrder from "./pages/TrackOrder";
import AdminDashboard from "./pages/AdminDashboard";

/**
 * Roteamento mínimo por hash (#/termos, #/privacidade, #/obrigado, #/rastreio,
 * #/admin) para as páginas fora da landing, sem adicionar react-router. Âncoras
 * de seção (#checkout, #beneficios) continuam funcionando na rota padrão.
 */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return hash;
}

const LEGAL_ROUTES = ["#/termos", "#/privacidade", "#/obrigado"];
const DEFAULT_TITLE = "Smart Glasses | Câmera, tradução e música";

export default function App() {
  const route = useHashRoute();
  const isLanding =
    !LEGAL_ROUTES.includes(route) &&
    !route.startsWith("#/rastreio") &&
    !route.startsWith("#/admin");
  const lenisRef = useRef<Lenis | null>(null);

  // Restaura o título da aba ao voltar das páginas legais/obrigado
  useEffect(() => {
    if (isLanding) document.title = DEFAULT_TITLE;
  }, [isLanding]);

  // Smooth-scroll estilo Apple (momentum na rolagem da página inteira) via Lenis.
  // Lenis rola o documento nativo — position:sticky e getBoundingClientRect
  // continuam válidos. Desligado sob prefers-reduced-motion (a11y).
  useEffect(() => {
    if (!isLanding) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenisRef.current = lenis;

    let rafId = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [isLanding]);

  // Âncoras de seção saltam instantâneas: o smooth scroll nativo percorreria
  // as 4 estações do voo animando tudo no caminho do CTA → checkout
  useEffect(() => {
    if (!isLanding) return;
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.('a[href^="#"]');
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#/") || href === "#") return; // rotas por hash seguem normal
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", href);
      // Salto instantâneo (não percorre o giro no caminho). Via Lenis quando
      // ativo — pra não dessincronizar a posição interna dele. O Lenis já honra
      // o scroll-margin-top:5rem das seções, então não passamos offset extra.
      const lenis = lenisRef.current;
      if (lenis) {
        lenis.scrollTo(target as HTMLElement, { immediate: true });
      } else {
        target.scrollIntoView({ behavior: "instant", block: "start" });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [isLanding]);

  // Reveal on scroll: observa as seções marcadas com data-reveal uma única vez cada.
  useEffect(() => {
    if (!isLanding) return;

    document.documentElement.classList.add("js");
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    // Sem IO ou com a página oculta (aba em background/prerender), os callbacks do
    // IntersectionObserver não são entregues — nesse caso revela tudo de imediato:
    // a animação é um extra; conteúdo visível é o requisito.
    if (!("IntersectionObserver" in window) || document.visibilityState === "hidden") {
      elements.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -48px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isLanding]);

  if (route === "#/termos") return <TermsOfUse />;
  if (route === "#/privacidade") return <PrivacyPolicy />;
  if (route === "#/obrigado") return <ThankYou />;
  if (route.startsWith("#/rastreio")) return <TrackOrder />;
  if (route.startsWith("#/admin")) return <AdminDashboard />;

  return (
    <>
      <Nav />
      <main className="pt-14">
        <Hero />
        <SpinShowcase />
        <Stats />
        <Benefits />
        <SocialProof />
        <Offer />
        <Faq />
        <CheckoutForm />
      </main>
      <Footer />
    </>
  );
}
