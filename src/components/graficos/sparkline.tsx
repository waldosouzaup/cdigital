/**
 * Mini-gráfico de tendência temporal em SVG nativo.
 *
 * Utiliza hairlines da paleta institucional e coordenadas proporcionais
 * para exibir tendências com leveza e sem impacto no peso do bundle.
 */

export function Sparkline({
  dados,
  cor = "var(--color-seal)",
  altura = 24,
  largura = 80,
  className = "",
}: {
  dados: number[];
  cor?: string;
  altura?: number;
  largura?: number;
  className?: string;
}) {
  if (!dados || dados.length < 2) return null;

  const min = Math.min(...dados);
  const max = Math.max(...dados);
  const amplitude = max - min || 1;

  // Mapeamento de coordenadas (com margem de 2px para a linha não cortar)
  const padding = 2;
  const hUtil = altura - padding * 2;
  const passoX = (largura - padding * 2) / (dados.length - 1);

  const pontos = dados.map((valor, i) => {
    const x = padding + i * passoX;
    const y = altura - padding - ((valor - min) / amplitude) * hUtil;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${pontos.join(" L ")}`;

  // Área preenchida sutil sob a curva
  const areaD = `${pathD} L ${largura - padding},${altura} L ${padding},${altura} Z`;

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className={`overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`grad-${largura}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={cor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${largura})`} />
      <path
        d={pathD}
        fill="none"
        stroke={cor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ponto de valor atual */}
      <circle
        cx={largura - padding}
        cy={altura - padding - ((dados[dados.length - 1] - min) / amplitude) * hUtil}
        r="2"
        fill={cor}
      />
    </svg>
  );
}
