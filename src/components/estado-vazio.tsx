import type { ReactNode } from "react";

/**
 * Estado vazio (Empty State) institucional (§7.6 do DESIGN-SYSTEM.md).
 * Ícone em ink-subtle dentro de círculo surface-tint, título ink e ação opcional.
 */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
  className = "",
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center border border-dashed border-line bg-surface/40 rounded-xl p-10 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-tint font-mono text-sm text-ink-subtle">
        ∅
      </div>
      <h3 className="mt-4 text-small font-semibold text-ink">{titulo}</h3>
      <p className="mt-1.5 max-w-md text-small text-ink-muted leading-relaxed">{descricao}</p>
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}
