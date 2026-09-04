/* Banda de números estilo Starlink — specs que resumem o produto */
const stats = [
  { value: "8 MP", label: "câmera HD integrada" },
  { value: "100+", label: "idiomas por IA" },
  { value: "3", label: "lentes inclusas" },
  { value: "6x", label: "sem juros no cartão" },
];

export default function Stats() {
  return (
    <section className="border-y border-line-soft py-16 sm:py-20">
      <div className="mx-auto max-w-page px-6">
        <dl data-reveal className="grid grid-cols-2 gap-y-10 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 sm:border-l sm:border-line-soft sm:first:border-l-0"
            >
              <dd className="order-1 text-4xl font-bold tracking-[-0.02em]">{stat.value}</dd>
              <dt className="order-2 text-sm text-ink-soft">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
