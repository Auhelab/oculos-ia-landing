import { useEffect, useState } from "react";
import Hero from "./components/Hero";
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
 * Roteamento mínimo por hash (#/termos, #/privacidade, #/rastreio, #/admin)
 * para as páginas fora da landing, sem adicionar react-router. Âncoras de
 * seção (#checkout, #beneficios) continuam funcionando na rota padrão.
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

/** Blobs de gradiente desfocados fixos ao fundo — a "luz" atrás dos painéis de vidro. */
function GlowBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-violet-600/30 blur-[120px]" />
      <div className="absolute -right-48 top-1/3 h-[40rem] w-[40rem] rounded-full bg-cyan-500/20 blur-[130px]" />
      <div className="absolute -bottom-32 left-1/4 h-[32rem] w-[32rem] rounded-full bg-blue-600/25 blur-[120px]" />
    </div>
  );
}

export default function App() {
  const route = useHashRoute();

  return (
    <div className="relative min-h-screen">
      <GlowBackground />
      {route === "#/termos" ? (
        <TermsOfUse />
      ) : route === "#/privacidade" ? (
        <PrivacyPolicy />
      ) : route === "#/obrigado" ? (
        <ThankYou />
      ) : route.startsWith("#/rastreio") ? (
        <TrackOrder />
      ) : route.startsWith("#/admin") ? (
        <AdminDashboard />
      ) : (
        <main>
          <Hero />
          <Benefits />
          <SocialProof />
          <Offer />
          <Faq />
          <CheckoutForm />
          <Footer />
        </main>
      )}
    </div>
  );
}
