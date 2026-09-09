"use client";

import { useEffect, type ReactNode } from "react";
import { Selo } from "./selo";

/**
 * Diálogo modal para confirmação de ações de impacto (emissão em lote,
 * distrato de contrato, rejeição de documento).
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  acaoPrimaria,
  rotuloPrimario = "Confirmar",
  rotuloSecundario = "Cancelar",
  vozPrimaria = "selo",
  desabilitarConfirmacao = false,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children?: ReactNode;
  acaoPrimaria?: () => void;
  rotuloPrimario?: string;
  rotuloSecundario?: string;
  vozPrimaria?: "selo" | "perigo";
  desabilitarConfirmacao?: boolean;
}) {
  useEffect(() => {
    function tratarEsc(evento: KeyboardEvent) {
      if (evento.key === "Escape" && aberto) {
        aoFechar();
      }
    }
    window.addEventListener("keydown", tratarEsc);
    return () => window.removeEventListener("keydown", tratarEsc);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop com escurecimento cívico sutil */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-[2px] transition-opacity"
        onClick={aoFechar}
      />

      <div className="relative w-full max-w-lg border border-line bg-surface p-6 text-ink shadow-lg md:p-8">
        <div className="regua mb-6">
          <h2 className="text-h2 font-semibold tracking-tight">{titulo}</h2>
          {descricao && <p className="mt-1.5 text-small text-ink-muted">{descricao}</p>}
        </div>

        {children && <div className="mb-6">{children}</div>}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Selo voz="linha" onClick={aoFechar}>
            {rotuloSecundario}
          </Selo>
          {acaoPrimaria && (
            <Selo
              voz={vozPrimaria}
              onClick={acaoPrimaria}
              disabled={desabilitarConfirmacao}
              className="sm:w-auto"
            >
              {rotuloPrimario}
            </Selo>
          )}
        </div>
      </div>
    </div>
  );
}
