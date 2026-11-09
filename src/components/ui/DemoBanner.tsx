/** Demo rejim ogohlantirishi. Matnni chaqiruvchi joriy tilda beradi (standart — o‘zbekcha). */
export function DemoBanner({ text = "Demo rejim: narxlar va manzillar shartli" }: { text?: string }) {
  return (
    <div role="note" className="border-b border-amber/40 bg-amber-soft px-4 py-1.5 text-center text-sm font-semibold text-amber">
      <span aria-hidden="true">◷ </span>
      {text}
    </div>
  );
}
