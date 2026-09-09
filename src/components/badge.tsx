import type { ReactNode } from "react";

/**
 * Carimbo / Etiqueta de status institucional.
 *
 * Emprega a fonte de registro (IBM Plex Mono) em tamanho reduzido, com contorno
 * discreto e preenchimento suave — transmite autenticidade e rigor de auditoria,
 * sem parecer uma tag de SaaS genérico.
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

const estilos: Record<
  StatusTipo,
  { texto: string; anel: string; fundo: string; rotulo: string; pulsar?: boolean }
> = {
  rascunho: {
    rotulo: "Rascunho",
    texto: "text-ink-muted",
    anel: "ring-line",
    fundo: "bg-surface/60",
  },
  emitido: {
    rotulo: "Emitido",
    texto: "text-brand-yellow",
    anel: "ring-brand-yellow/40",
    fundo: "bg-brand-yellow/10",
  },
  enviado: {
    rotulo: "Enviado",
    texto: "text-sky-400",
    anel: "ring-sky-500/40",
    fundo: "bg-sky-500/10",
  },
  assinado: {
    rotulo: "Assinado",
    texto: "text-emerald-400",
    anel: "ring-emerald-500/40",
    fundo: "bg-emerald-500/10",
  },
  distratado: {
    rotulo: "Distratado",
    texto: "text-red-400",
    anel: "ring-red-500/40",
    fundo: "bg-red-500/10",
  },
  distrato_assinado: {
    rotulo: "Distrato assinado",
    texto: "text-red-400",
    anel: "ring-red-500/50",
    fundo: "bg-red-500/15",
  },
  encerrado: {
    rotulo: "Encerrado",
    texto: "text-ink-muted",
    anel: "ring-line",
    fundo: "bg-line/30",
  },
  cancelado: {
    rotulo: "Cancelado",
    texto: "text-ink-muted",
    anel: "ring-line",
    fundo: "bg-surface/40",
  },
  pendente: {
    rotulo: "Pendente",
    texto: "text-amber-400",
    anel: "ring-amber-500/40",
    fundo: "bg-amber-500/10",
    pulsar: true,
  },
  aprovado: {
    rotulo: "Aprovado",
    texto: "text-emerald-400",
    anel: "ring-emerald-500/40",
    fundo: "bg-emerald-500/10",
  },
  rejeitado: {
    rotulo: "Rejeitado",
    texto: "text-red-400",
    anel: "ring-red-500/40",
    fundo: "bg-red-500/10",
  },
  apta: {
    rotulo: "Apta",
    texto: "text-emerald-400",
    anel: "ring-emerald-500/40",
    fundo: "bg-emerald-500/10",
  },
  projeto: {
    rotulo: "Projeto de Lei",
    texto: "text-emerald-300 font-bold",
    anel: "ring-emerald-400/50",
    fundo: "bg-emerald-950/80",
  },
  campanha: {
    rotulo: "Eleições 2026",
    texto: "text-brand-yellow font-bold",
    anel: "ring-brand-yellow/50",
    fundo: "bg-brand-yellow/15",
  },
  neutro: {
    rotulo: "Neutro",
    texto: "text-ink-muted",
    anel: "ring-line",
    fundo: "bg-surface/50",
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
  const conf = estilos[status] ?? estilos.neutro;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[0.75rem] font-medium tracking-wide ring-1 ring-inset ${conf.anel} ${conf.fundo} ${conf.texto} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {conf.pulsar && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-90" />
      </span>
      {children ?? rotuloPersonalizado ?? conf.rotulo}
    </span>
  );
}
