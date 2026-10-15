type Props = {
  /** Días del mes que se resaltan (1–31). */
  marcas: number[];
  /** Mes 1–12. Por defecto octubre, el mes de la prematrícula de la muestra. */
  mes?: number;
  anio?: number;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function Calendario({ marcas, mes = 10, anio = 2026 }: Props) {
  const primero = new Date(anio, mes - 1, 1);
  const totalDias = new Date(anio, mes, 0).getDate();
  const desfase = (primero.getDay() + 6) % 7; // lunes = 0
  const marcadas = new Set(marcas);
  const celdas: (number | null)[] = [...Array(desfase).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);

  return (
    <figure className="rounded-card border border-line bg-white p-4">
      <figcaption className="mb-3 text-sm font-medium capitalize">
        {MESES[mes - 1]} {anio}
      </figcaption>
      <div className="grid grid-cols-7 gap-1 text-center text-xs" role="grid" aria-label={`Calendario de ${MESES[mes - 1]} ${anio}`}>
        {DIAS.map((d) => (
          <span key={d} className="pb-1 text-muted" role="columnheader">
            {d}
          </span>
        ))}
        {celdas.map((dia, i) =>
          dia === null ? (
            <span key={`v${i}`} />
          ) : (
            <span
              key={dia}
              role="gridcell"
              aria-label={marcadas.has(dia) ? `${dia}, con actividad` : String(dia)}
              className={`flex h-8 items-center justify-center rounded-md ${
                marcadas.has(dia) ? "bg-accent font-medium text-white" : "text-ink"
              }`}
            >
              {dia}
            </span>
          ),
        )}
      </div>
    </figure>
  );
}
