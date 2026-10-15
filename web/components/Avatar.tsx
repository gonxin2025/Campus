type Props = { nombre: string; size?: number };

const TONOS = ["#0b4a6e", "#166d46", "#7a4b00", "#5b3b8c", "#8a2a2a", "#235c74", "#4b5b1e"];

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = (partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "");
  return letras.toUpperCase() || "?";
}

function tono(nombre: string) {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}

export function Avatar({ nombre, size = 40 }: Props) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white"
      style={{ width: size, height: size, background: tono(nombre), fontSize: Math.round(size * 0.38) }}
    >
      {iniciales(nombre)}
    </span>
  );
}
