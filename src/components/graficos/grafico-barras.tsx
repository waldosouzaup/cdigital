"use client";

import { useState } from "react";

/**
 * Gráfico de barras horizontais em SVG/CSS puro para comparativos analíticos.
 *
 * Características de design:
 * - Régua de margem alinhada ao design "papel oficial".
 * - Valores com fonte mono tabular (`tabular-nums`).
 * - Barras proporcionais com cor indicativa de status (verde para meta batida, selo para padrão, tijolo para atenção).
 */

export type BarraItem = {
  rotulo: string;
  valor: number;
  maximoReferencia?: number;
  rotuloValor?: string;
  destaque?: boolean;
  corBarra?: string;
  subtexto?: string;
};

export function GraficoBarras({
  itens,
  titulo,
  subtitulo,
  className = "",
}: {
  itens: BarraItem[];
  titulo?: string;
  subtitulo?: string;
  className?: string;
}) {
  const [itemHover, setItemHover] = useState<number | null>(null);

  const valorMaximo = Math.max(...itens.map((it) => it.maximoReferencia ?? it.valor), 1);

  return (
    <div className={`space-y-4 border border-line bg-surface p-5 ${className}`}>
      {(titulo || subtitulo) && (
        <div className="border-b border-line pb-3">
          {titulo && <h3 className="text-small font-semibold text-ink">{titulo}</h3>}
          {subtitulo && <p className="text-xs text-ink-muted mt-0.5">{subtitulo}</p>}
        </div>
      )}

      <div className="space-y-3.5 pt-1">
        {itens.map((item, idx) => {
          const percentual = Math.min(Math.round((item.valor / valorMaximo) * 100), 100);
          const cor =
            item.corBarra ?? (item.destaque ? "var(--color-seal)" : "var(--color-ink-muted)");

          return (
            <div
              key={item.rotulo}
              onMouseEnter={() => setItemHover(idx)}
              onMouseLeave={() => setItemHover(null)}
              className="space-y-1 group"
            >
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-ink truncate pr-2 group-hover:text-seal transition-colors">
                  {item.rotulo}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono tabular-nums text-ink font-semibold">
                    {item.rotuloValor ?? item.valor}
                  </span>
                  <span className="font-mono text-[0.7rem] text-ink-muted w-10 text-right">
                    {percentual}%
                  </span>
                </div>
              </div>

              {/* Trilho da Barra */}
              <div className="h-2 w-full bg-line/60 rounded-none overflow-hidden relative">
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percentual}%`,
                    backgroundColor: cor,
                    filter: itemHover === idx ? "brightness(1.15)" : undefined,
                  }}
                />
              </div>

              {item.subtexto && (
                <div className="text-[0.7rem] text-ink-muted/80">{item.subtexto}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
