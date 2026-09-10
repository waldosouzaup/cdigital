/**
 * Escalas e estilos de visualização de dados para o Dashboard do Comitê Digital.
 *
 * 1. Escala Térmica (Conclusão por Região):
 *    Mapeia percentuais de conclusão em gradiente térmico de temperatura:
 *    - 0% a 25%: Frio (Tons de Azul Glacial / Sky)
 *    - 26% a 50%: Morno (Tons de Âmbar Dourado / Warm Yellow)
 *    - 51% a 75%: Quente (Tons de Laranja Solar)
 *    - 76% a 100%: Muito Quente (Tons de Fogo / Crimson / Rose)
 *    - null: Neutro / Sem dados
 *
 * 2. Estilos do Funil de Conversão:
 *    Mapeia cada uma das 5 etapas cronológicas do funil com cores semânticas distintas.
 */

export type NivelTermico = "sem_dados" | "frio" | "morno" | "quente" | "muito_quente";

export interface EscalaTermica {
  nivel: NivelTermico;
  rotuloCurto: string;
  rotuloFaixa: string;
  icone: string;
  badgeClasse: string;
  cardClasse: string;
  textoClasse: string;
  barraClasse: string;
  glowClasse: string;
}

export function obterEscalaTermica(pct: number | null): EscalaTermica {
  if (pct === null || isNaN(pct)) {
    return {
      nivel: "sem_dados",
      rotuloCurto: "Sem dados",
      rotuloFaixa: "Não informado",
      icone: "—",
      badgeClasse: "bg-surface-sunken text-ink-muted border-line",
      cardClasse: "border-line bg-surface hover:border-ink-muted/40",
      textoClasse: "text-ink-muted",
      barraClasse: "bg-line",
      glowClasse: "",
    };
  }

  if (pct <= 25) {
    return {
      nivel: "frio",
      rotuloCurto: "Frio",
      rotuloFaixa: "0–25%",
      icone: "🧊",
      badgeClasse:
        "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-400/30 dark:border-sky-500/30",
      cardClasse:
        "border-sky-400/30 dark:border-sky-500/30 bg-sky-500/[0.03] dark:bg-sky-950/20 hover:border-sky-500 hover:bg-sky-500/[0.07] dark:hover:bg-sky-950/40",
      textoClasse: "text-sky-600 dark:text-sky-400",
      barraClasse: "bg-sky-500",
      glowClasse: "hover:shadow-[0_0_15px_rgba(14,165,233,0.15)]",
    };
  }

  if (pct <= 50) {
    return {
      nivel: "morno",
      rotuloCurto: "Morno",
      rotuloFaixa: "26–50%",
      icone: "⛅",
      badgeClasse:
        "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/30 dark:border-amber-500/30",
      cardClasse:
        "border-amber-400/30 dark:border-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-950/20 hover:border-amber-500 hover:bg-amber-500/[0.07] dark:hover:bg-amber-950/40",
      textoClasse: "text-amber-600 dark:text-amber-300",
      barraClasse: "bg-gradient-to-r from-amber-500 to-amber-400",
      glowClasse: "hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    };
  }

  if (pct <= 75) {
    return {
      nivel: "quente",
      rotuloCurto: "Quente",
      rotuloFaixa: "51–75%",
      icone: "☀️",
      badgeClasse:
        "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-400/30 dark:border-orange-500/30",
      cardClasse:
        "border-orange-400/35 dark:border-orange-500/35 bg-orange-500/[0.04] dark:bg-orange-950/25 hover:border-orange-500 hover:bg-orange-500/[0.09] dark:hover:bg-orange-950/45",
      textoClasse: "text-orange-600 dark:text-orange-400 font-bold",
      barraClasse: "bg-gradient-to-r from-amber-500 to-orange-500",
      glowClasse: "hover:shadow-[0_0_18px_rgba(249,115,22,0.2)]",
    };
  }

  return {
    nivel: "muito_quente",
    rotuloCurto: "Muito Quente",
    rotuloFaixa: "76–100%",
    icone: "🔥",
    badgeClasse:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/40 dark:border-rose-500/40 font-semibold",
    cardClasse:
      "border-rose-400/45 dark:border-rose-500/45 bg-rose-500/[0.05] dark:bg-rose-950/30 hover:border-rose-500 hover:bg-rose-500/[0.12] dark:hover:bg-rose-950/50",
    textoClasse: "text-rose-600 dark:text-rose-400 font-extrabold",
    barraClasse: "bg-gradient-to-r from-orange-500 via-rose-500 to-red-600",
    glowClasse: "hover:shadow-[0_0_22px_rgba(244,63,94,0.25)]",
  };
}

export interface EtapaFunilConfig {
  chave: "cadastrados" | "aptos" | "emitido" | "enviado" | "assinado";
  rotulo: string;
  fase: string;
  descricaoEtapa: string;
  corTopo: string;
  corBadge: string;
  corCard: string;
  corNumero: string;
  corBarra: string;
}

export const ETAPAS_FUNIL_CONFIG: readonly EtapaFunilConfig[] = [
  {
    chave: "cadastrados",
    rotulo: "Cadastrados",
    fase: "01 · Base",
    descricaoEtapa: "Inscrições ativas",
    corTopo: "bg-sky-500",
    corBadge: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-400/30 dark:border-sky-500/30",
    corCard:
      "border-sky-400/30 dark:border-sky-500/30 bg-surface hover:border-sky-400 hover:bg-sky-500/[0.04] dark:hover:bg-sky-950/30",
    corNumero: "group-hover:text-sky-600 dark:group-hover:text-sky-400",
    corBarra: "bg-sky-500",
  },
  {
    chave: "aptos",
    rotulo: "Aptos",
    fase: "02 · Qualificados",
    descricaoEtapa: "Conferência aprovada",
    corTopo: "bg-indigo-500",
    corBadge:
      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-400/30 dark:border-indigo-500/30",
    corCard:
      "border-indigo-400/30 dark:border-indigo-500/30 bg-surface hover:border-indigo-400 hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-950/30",
    corNumero: "group-hover:text-indigo-600 dark:group-hover:text-indigo-400",
    corBarra: "bg-indigo-500",
  },
  {
    chave: "emitido",
    rotulo: "Emitido",
    fase: "03 · Minutas",
    descricaoEtapa: "Contratos gerados",
    corTopo: "bg-amber-500",
    corBadge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/30 dark:border-amber-500/30",
    corCard:
      "border-amber-400/30 dark:border-amber-500/30 bg-surface hover:border-amber-400 hover:bg-amber-500/[0.04] dark:hover:bg-amber-950/30",
    corNumero: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
    corBarra: "bg-amber-500",
  },
  {
    chave: "enviado",
    rotulo: "Enviado",
    fase: "04 · Em Trânsito",
    descricaoEtapa: "Links disparados",
    corTopo: "bg-cyan-500",
    corBadge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-400/30 dark:border-cyan-500/30",
    corCard:
      "border-cyan-400/30 dark:border-cyan-500/30 bg-surface hover:border-cyan-400 hover:bg-cyan-500/[0.04] dark:hover:bg-cyan-950/30",
    corNumero: "group-hover:text-cyan-600 dark:group-hover:text-cyan-400",
    corBarra: "bg-cyan-500",
  },
  {
    chave: "assinado",
    rotulo: "Assinado",
    fase: "05 · Vigor Efetivo",
    descricaoEtapa: "Meta convertida",
    corTopo: "bg-emerald-500",
    corBadge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 dark:border-emerald-500/30 font-semibold",
    corCard:
      "border-emerald-400/35 dark:border-emerald-500/35 bg-surface hover:border-emerald-400 hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-950/35",
    corNumero: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    corBarra: "bg-emerald-500",
  },
];
