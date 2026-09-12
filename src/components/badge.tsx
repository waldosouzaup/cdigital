import type { ReactNode } from "react";

/**
 * Selo / Badge de status institucional (§4.1, §4.2 e §7.3 do DESIGN-SYSTEM.md).
 * Formato pill (rounded-full), ícone obrigatório + rótulo textual legível.
 */
export type StatusTipo =
  | "rascunho"
  | "emitido"
  | "enviado"
  | "assinado"
  | "distratado"
  | "distrato_assinado"
  | "encerrado"
  | "cancelado"
  | "pendente"
  | "aprovado"
  | "rejeitado"
  | "apta"
  | "neutro"
  | "projeto"
  | "campanha";

interface ConfiguracaoStatus {
  rotulo: string;
  icone: string;
  classes: string;
  pulsar?: boolean;
}

const configuracoes: Record<StatusTipo, ConfiguracaoStatus> = {
  rascunho: {
    rotulo: "Rascunho",
    icone: "○",
    classes: "bg-surface-sunken text-ink-muted ring-1 ring-line",
  },
  emitido: {
    rotulo: "Emitido",
    icone: "▸",
    classes: "bg-primary-tint text-primary ring-1 ring-primary/30",
  },
  enviado: {
    rotulo: "Enviado",
    icone: "➤",
    classes: "bg-primary-tint text-primary font-semibold ring-1 ring-primary/40",
  },
  assinado: {
    rotulo: "Assinado",
    icone: "✓",
    classes: "bg-primary text-white font-semibold ring-1 ring-primary/40",
  },
  encerrado: {
    rotulo: "Encerrado",
    icone: "✓✓",
    classes: "bg-surface-sunken text-ink-muted font-semibold ring-1 ring-line",
  },
  distratado: {
    rotulo: "Distratado",
    icone: "✕",
    classes: "bg-danger-tint text-danger ring-1 ring-danger/30",
  },
  distrato_assinado: {
    rotulo: "Distrato assinado",
    icone: "✕",
    classes: "bg-danger-tint text-danger font-medium ring-1 ring-danger/40",
  },
  cancelado: {
    rotulo: "Cancelado",
    icone: "✕",
    classes: "bg-surface-sunken text-ink-muted line-through ring-1 ring-line",
  },
  pendente: {
    rotulo: "Pendente",
    icone: "⧗",
    classes: "bg-warning-tint text-warning ring-1 ring-warning/30",
    pulsar: true,
  },
  aprovado: {
    rotulo: "Aprovado",
    icone: "✓",
    classes: "bg-success-tint text-success ring-1 ring-success/30",
  },
  rejeitado: {
    rotulo: "Rejeitado",
    icone: "✕",
    classes: "bg-danger-tint text-danger ring-1 ring-danger/30",
  },
  apta: {
    rotulo: "Apta",
    icone: "✓",
    classes: "bg-success-tint text-success ring-1 ring-success/30",
  },
  projeto: {
    rotulo: "Projeto",
    icone: "§",
    classes: "bg-primary-tint text-primary font-semibold ring-1 ring-primary/30",
  },
  campanha: {
    rotulo: "Eleições 2026",
    icone: "•",
    classes: "bg-surface-tint text-primary font-bold ring-1 ring-primary/20",
  },
  neutro: {
    rotulo: "Neutro",
    icone: "○",
    classes: "bg-surface-sunken text-ink-muted ring-1 ring-line",
  },
};

export function Badge({
  status,
  rotuloPersonalizado,
  className = "",
  children,
}: {
  status: StatusTipo;
  rotuloPersonalizado?: string;
  className?: string;
  children?: ReactNode;
}) {
  const conf = configuracoes[status] ?? configuracoes.neutro;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.72rem] font-medium tracking-wide shadow-2xs ${conf.classes} ${className}`}
    >
      <span className="shrink-0 text-[0.7rem] leading-none select-none font-bold">
        {conf.icone}
      </span>
      <span>{children ?? rotuloPersonalizado ?? conf.rotulo}</span>
    </span>
  );
}
