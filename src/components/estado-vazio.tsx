import type { ReactNode } from "react";

/**
 * Estado vazio (Empty State).
 *
 * Princípio da skill front-end-design: uma tela vazia é um convite à ação,
 * não uma ausência melancólica. Deve explicar de forma construtiva o que
 * deve existir ali e como iniciar.
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
      className={`flex flex-col items-center justify-center border border-dashed border-line p-10 text-center ${className}`}
    >
      <div className="flex h-10 w-10 items-center justify-center border border-line font-mono text-xs text-ink-muted">
        ∅
      </div>
      <h3 className="mt-4 text-small font-semibold text-ink">{titulo}</h3>
      <p className="mt-1.5 max-w-md text-small text-ink-muted leading-relaxed">{descricao}</p>
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}
