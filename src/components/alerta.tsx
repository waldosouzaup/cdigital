import type { ReactNode } from "react";

/**
 * Banner de comunicação e orientação institucional (§7.4 do DESIGN-SYSTEM.md).
 * Fundo em tinte pálido sem saturação excessiva, ícone obrigatório e borda semântica.
 */
export type AlertaTom = "informativo" | "sucesso" | "atencao" | "critico";

const estilos: Record<
  AlertaTom,
  { borda: string; bordaLateral: string; fundo: string; titulo: string; icone: string }
> = {
  informativo: {
    borda: "border-line",
    bordaLateral: "border-l-info",
    fundo: "bg-info-tint",
    titulo: "text-info font-semibold",
    icone: "ℹ",
  },
  sucesso: {
    borda: "border-line",
    bordaLateral: "border-l-success",
    fundo: "bg-success-tint",
    titulo: "text-success font-semibold",
    icone: "✓",
  },
  atencao: {
    borda: "border-line",
    bordaLateral: "border-l-warning",
    fundo: "bg-warning-tint",
    titulo: "text-warning font-semibold",
    icone: "▲",
  },
  critico: {
    borda: "border-line",
    bordaLateral: "border-l-danger",
    fundo: "bg-danger-tint",
    titulo: "text-danger font-semibold",
    icone: "✕",
  },
};

export function Alerta({
  tom = "informativo",
  titulo,
  children,
  acao,
  className = "",
}: {
  tom?: AlertaTom;
  titulo?: string;
  children: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  const conf = estilos[tom];

  return (
    <div
      role={tom === "critico" ? "alert" : "status"}
      className={`border border-l-4 p-4 text-small transition-colors ${conf.borda} ${conf.bordaLateral} ${conf.fundo} ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {titulo && (
            <div className={`flex items-center gap-2 ${conf.titulo}`}>
              <span className="font-mono text-xs select-none">{conf.icone}</span>
              <span>{titulo}</span>
            </div>
          )}
          <div className="text-ink leading-relaxed">{children}</div>
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
    </div>
  );
}
