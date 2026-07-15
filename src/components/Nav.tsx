import { product } from "../config/product";

const links = [
  { href: "#recursos", label: "Recursos" },
  { href: "#avaliacoes", label: "Avaliações" },
  { href: "#oferta", label: "Oferta" },
  { href: "#faq", label: "Dúvidas" },
];

/** Barra fixa translúcida com blur — referência direta da nav do site da Apple. */
export default function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line-soft bg-white/80 backdrop-blur-xl">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-14 max-w-page items-center justify-between px-6"
      >
        <a href="#/" className="text-[15px] font-semibold tracking-tight">
          {product.name}
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-ink-soft transition hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2.5">
          <a
            href="#/rastreio"
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
          >
            Rastrear<span className="hidden sm:inline"> sua compra</span>
          </a>
          <a
            href="#checkout"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Comprar
          </a>
        </div>
      </nav>
    </header>
  );
}
