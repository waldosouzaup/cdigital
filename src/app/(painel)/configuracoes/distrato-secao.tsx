"use client";

/**
 * Editor do termo de distrato (/configuracoes?aba=modelos).
 *
 * Fica em componente próprio, e não dentro de `configuracoes-cliente.tsx`, pelo
 * mesmo motivo das outras seções: aquele arquivo já concentra oito abas.
 *
 * A pré-visualização roda no cliente com um contrato fictício — o administrador
 * precisa ver o texto com os marcadores resolvidos antes de salvar, porque o
 * próximo lugar onde esse texto aparece é um PDF que vai para assinatura.
 */
import { useActionState, useMemo, useRef, useState } from "react";
import { Alerta } from "@/components/alerta";
import { Badge } from "@/components/badge";
import { salvarTemplateDistrato } from "./acoes";
import { ESTADO_INICIAL_TEMPLATE_DISTRATO } from "./estado";
import type { TemplateDistrato } from "./dados";
import { calcularProporcionalDistrato } from "@/lib/contratos/distrato";
import {
  MARCADORES_DISTRATO,
  TEMPLATE_DISTRATO_PADRAO,
  montarDadosDistrato,
  substituirMarcadoresDistrato,
} from "@/lib/contratos/template-distrato";

/** Contrato fictício da pré-visualização — nenhum dado real de pessoa. */
const EXEMPLO = {
  contratante:
    "CONTRATANTE: (a qualificação configurada em Identificação do Comitê aparece aqui).",
  contratadoNome: "Maria Aparecida da Silva",
  contratadoCpf: "123.456.789-09",
  contratadoEndereco: "Quadra 10, Conjunto B, Casa 5 — Brasília/DF",
  objeto: "Militância e Mobilização de Rua",
  motivo: "acordo entre as partes",
  vigenciaInicio: "2026-08-01",
  vigenciaFim: "2026-08-31",
  dataDistrato: "2026-08-12",
  valor: 1500,
};

export function DistratoSecao({ templateInicial }: { templateInicial: TemplateDistrato }) {
  const [estado, acao, enviando] = useActionState(
    salvarTemplateDistrato,
    ESTADO_INICIAL_TEMPLATE_DISTRATO,
  );
  const [corpo, setCorpo] = useState(templateInicial.corpoHtml);
  const [verPrevia, setVerPrevia] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const previa = useMemo(() => {
    const calculo = calcularProporcionalDistrato({
      vigenciaInicio: EXEMPLO.vigenciaInicio,
      vigenciaFim: EXEMPLO.vigenciaFim,
      dataDistrato: EXEMPLO.dataDistrato,
      valor: EXEMPLO.valor,
    });
    return substituirMarcadoresDistrato(corpo, montarDadosDistrato({ ...EXEMPLO, calculo }));
  }, [corpo]);

  const usados = useMemo(() => new Set(corpo.match(/\{\{[a-z_]+\}\}/g) ?? []), [corpo]);
  const alterado = corpo !== templateInicial.corpoHtml;

  function inserirMarcador(marcador: string) {
    const area = areaRef.current;
    if (!area) {
      setCorpo((atual) => atual + marcador);
      return;
    }
    const { selectionStart, selectionEnd } = area;
    setCorpo((atual) => atual.slice(0, selectionStart) + marcador + atual.slice(selectionEnd));
    // Devolve o cursor logo depois do marcador inserido, senão ele volta para o fim.
    requestAnimationFrame(() => {
      area.focus();
      const posicao = selectionStart + marcador.length;
      area.setSelectionRange(posicao, posicao);
    });
  }

  return (
    <section className="border border-line bg-surface p-6 space-y-6 rounded-lg shadow-xs">
      <div className="regua flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-h2 font-semibold text-ink">Modelo do Termo de Distrato</h2>
          <p className="text-xs text-ink-muted">
            Texto da rescisão contratual. É o que vira PDF quando a coordenação distrata um
            contrato assinado.
          </p>
        </div>
        <Badge
          status={templateInicial.padrao ? "neutro" : "aprovado"}
          rotuloPersonalizado={templateInicial.padrao ? "Termo oficial padrão" : "Modelo do comitê"}
        />
      </div>

      {estado.status === "sucesso" && <Alerta tom="sucesso">{estado.mensagem}</Alerta>}
      {estado.status === "erro" && <Alerta tom="critico">{estado.mensagem}</Alerta>}

      {templateInicial.padrao && (
        <p className="text-xs text-ink-muted border border-dashed border-line rounded-md p-3 leading-relaxed">
          O comitê ainda não salvou um termo próprio — o texto abaixo é o modelo oficial de
          fábrica, o mesmo que a rescisão já usa hoje. Edite e salve para passar a valer o seu.
        </p>
      )}

      <form action={acao} className="space-y-4">
        <input type="hidden" name="corpoHtml" value={corpo} />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-semibold text-ink uppercase tracking-wider">
              Corpo do termo
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setVerPrevia((v) => !v)}
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                {verPrevia ? "Voltar a editar" : "Pré-visualizar com dados de exemplo"}
              </button>
              <button
                type="button"
                onClick={() => setCorpo(TEMPLATE_DISTRATO_PADRAO)}
                className="text-xs text-ink-muted hover:text-ink hover:underline cursor-pointer"
              >
                Restaurar termo oficial
              </button>
            </div>
          </div>

          {verPrevia ? (
            <pre className="max-h-[28rem] overflow-y-auto rounded-md border border-line bg-paper p-4 text-xs leading-6 text-ink whitespace-pre-wrap break-words font-sans">
              {previa}
            </pre>
          ) : (
            <textarea
              ref={areaRef}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full rounded-md border border-line bg-canvas p-4 text-xs leading-6 font-mono text-ink focus:border-primary outline-none resize-y"
              aria-label="Corpo do termo de distrato"
            />
          )}
        </div>

        <div className="p-4 bg-paper border border-line rounded-md space-y-2">
          <span className="text-xs font-mono text-ink font-semibold uppercase">
            Marcadores do termo de distrato — clique para inserir no cursor:
          </span>
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            {MARCADORES_DISTRATO.map(({ marcador, rotulo }) => (
              <button
                key={marcador}
                type="button"
                title={rotulo}
                onClick={() => inserirMarcador(marcador)}
                className={`border px-2 py-0.5 rounded-xs cursor-pointer transition-colors ${
                  usados.has(marcador)
                    ? "border-primary/40 bg-primary-tint text-primary"
                    : "border-line bg-surface text-ink-muted hover:text-ink hover:border-line-strong"
                }`}
              >
                {marcador}
              </button>
            ))}
          </div>
          <p className="text-[0.75rem] text-ink-muted leading-tight pt-1">
            * Os valores em destaque já estão no texto. O proporcional, os dias trabalhados e o
            valor por extenso são calculados no servidor a partir da vigência e da data do
            distrato — nunca digitados.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {alterado && <span className="text-xs text-ink-muted">Alterações não salvas.</span>}
          <button
            type="submit"
            disabled={enviando || !alterado}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded hover:bg-primary-hover transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? "Salvando…" : "Salvar modelo de distrato"}
          </button>
        </div>
      </form>
    </section>
  );
}
