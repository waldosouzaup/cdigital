import type { ReactNode } from "react";

/**
 * Banner de comunicação e orientação.
 *
 * Segue o princípio de copywriting da skill: tom ativo, explicativo e resolutivo.
 * O erro ou alerta não pede desculpas: explica claramente o que aconteceu e aponta
 * como solucionar o problema.
 */
export type AlertaTom = "informativo" | "sucesso" | "atencao" | "critico";

const estilos: Record<AlertaTom, { borda: string; fundo: string; titulo: string; icone: string }> =
  {
    informativo: {
      borda: "border-info/30",
      fundo: "bg-info/5",
      titulo: "text-info",
      icone: "ℹ",
    },
    sucesso: {
      borda: "border-success/30",
      fundo: "bg-success/5",
      titulo: "text-success",
      icone: "✓",
    },
    atencao: {
      borda: "border-warning/30",
      fundo: "bg-warning/5",
      titulo: "text-warning",
      icone: "▲",
    },
    critico: {
      borda: "border-alert/30",
      fundo: "bg-alert/5",
      titulo: "text-alert",
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
      className={`border-l-2 border-y border-r p-4 text-small transition-colors ${conf.borda} ${conf.fundo} ${className}`}
      style={{
        borderLeftColor: `var(--color-${tom === "critico" ? "alert" : tom === "atencao" ? "warning" : tom === "sucesso" ? "success" : "info"})`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {titulo && (
            <div className={`flex items-center gap-2 font-medium ${conf.titulo}`}>
              <span className="font-mono text-xs opacity-80">{conf.icone}</span>
              <span>{titulo}</span>
            </div>
          )}
          <div className="text-ink-muted leading-relaxed">{children}</div>
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
    </div>
  );
}
