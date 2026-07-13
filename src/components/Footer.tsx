import { product } from "../config/product";

export default function Footer() {
  return (
    <footer className="border-t border-line-soft bg-haze py-14 text-ink-soft">
      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight text-ink">{product.name}</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed">
              Loja especializada em um único produto, com curadoria e suporte dedicado.
              Entrega em todo o Brasil em 15 a 40 dias úteis.
            </p>
          </div>

          <nav aria-label="Links legais">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
              Institucional
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#/termos" className="transition hover:text-ink">
                  Termos de Uso
                </a>
              </li>
              <li>
                <a href="#/privacidade" className="transition hover:text-ink">
                  Política de Privacidade (LGPD)
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 border-t border-line-soft pt-6 text-xs leading-relaxed">
          <p>Razão Social Placeholder LTDA · CNPJ 00.000.000/0001-00</p>
          <p className="mt-1">
            © {new Date().getFullYear()} Todos os direitos reservados. Preços e condições
            exclusivos para compras neste site.
          </p>
        </div>
      </div>
    </footer>
  );
}
