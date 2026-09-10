"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/badge";
import { Alerta } from "@/components/alerta";
import { EstadoVazio } from "@/components/estado-vazio";
import { Modal } from "@/components/modal";
import { Selo } from "@/components/selo";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";
import {
  exportarBaseNominalXlsx,
  exportarRelatorioPdf,
  gerarUrlParaDrillDown,
} from "./acoes";
import type { DadosDashboard, PessoaResumo } from "./dados";
import {
  ETAPAS_FUNIL_CONFIG,
  obterEscalaTermica,
} from "@/lib/dashboard/escala-termica";

type StatusConexao = "conectando" | "ao_vivo" | "degradado";
const INTERVALO_POLLING_MS = 5000;

function formatarValor(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function baixarBase64(base64: string, nomeArquivo: string, tipoMime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

/** Predicado de filtro para a lista nominal (1º clique) — cada card/célula/barra
 * clicável do dashboard define qual pessoa entra na lista. */
type FiltroDrillDown = { titulo: string; predicado: (p: PessoaResumo) => boolean };

export function DashboardCliente({ dadosIniciais }: { dadosIniciais: DadosDashboard }) {
  const router = useRouter();
  const [statusConexao, setStatusConexao] = useState<StatusConexao>("conectando");
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(new Date());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Realtime (item 2) — atualiza a tela quando pessoas/contratos/documentos/
  // notificações mudam; degrada para polling se o socket cair. ---------------
  useEffect(() => {
    const supabase = createClient();
    const tabelas = ["contratos", "pessoas", "documentos", "notificacoes"] as const;

    let canal = supabase.channel("dashboard-mudancas");
    for (const tabela of tabelas) {
      canal = canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabela },
        () => {
          router.refresh();
          setUltimaAtualizacao(new Date());
        },
      );
    }

    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setStatusConexao("ao_vivo");
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setStatusConexao("degradado");
        if (!pollingRef.current) {
          pollingRef.current = setInterval(() => {
            router.refresh();
            setUltimaAtualizacao(new Date());
          }, INTERVALO_POLLING_MS);
        }
      }
    });

    return () => {
      supabase.removeChannel(canal);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [router]);

  // --- Detalhamento progressivo (item 3): clique 1 = lista nominal ----------
  const [drillDown, setDrillDown] = useState<FiltroDrillDown | null>(null);
  const [processandoPessoa, setProcessandoPessoa] = useState<string | null>(null);

  const pessoasNaLista = useMemo(
    () => (drillDown ? dadosIniciais.pessoas.filter(drillDown.predicado) : []),
    [drillDown, dadosIniciais.pessoas],
  );

  async function abrirDocumentoOuContrato(pessoa: PessoaResumo) {
    setProcessandoPessoa(pessoa.id);
    const resultado = await gerarUrlParaDrillDown({
      documentoId: pessoa.documentoId,
      contratoId: pessoa.contratoId,
    });
    setProcessandoPessoa(null);
    if (!resultado.ok || !resultado.url) {
      alert(resultado.mensagem ?? "Nada para abrir ainda.");
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  // --- Exportação (item 7) ---------------------------------------------------
  const [exportando, setExportando] = useState<"pdf" | "xlsx" | null>(null);

  async function handleExportarPdf() {
    setExportando("pdf");
    const resultado = await exportarRelatorioPdf();
    setExportando(null);
    if (resultado.ok && resultado.base64 && resultado.nomeArquivo) {
      baixarBase64(resultado.base64, resultado.nomeArquivo, "application/pdf");
    } else {
      alert(resultado.mensagem ?? "Falha ao exportar.");
    }
  }

  async function handleExportarXlsx() {
    setExportando("xlsx");
    const resultado = await exportarBaseNominalXlsx();
    setExportando(null);
    if (resultado.ok && resultado.base64 && resultado.nomeArquivo) {
      baixarBase64(
        resultado.base64,
        resultado.nomeArquivo,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } else {
      alert(resultado.mensagem ?? "Falha ao exportar.");
    }
  }

  const { funil, matriz, regioes, pendencias, notificacoesFalhadas } = dadosIniciais;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Cabeçalho + status de conexão em tempo real */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
            Painel do Gestor
          </span>
          <h1 className="text-h1 font-semibold text-ink">Painel Consolidado</h1>
          <p className="mt-1 text-small text-ink-muted">
            Matriz por objeto, funil de conversão, cobertura regional e pendências — em tempo
            real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-mono text-ink-muted">
            <span
              className={`h-2 w-2 rounded-full ${
                statusConexao === "ao_vivo"
                  ? "bg-success animate-pulse"
                  : statusConexao === "degradado"
                    ? "bg-warning"
                    : "bg-line"
              }`}
            />
            {statusConexao === "ao_vivo" && "Ao vivo"}
            {statusConexao === "degradado" && "Atualizando a cada 5s (conexão instável)"}
            {statusConexao === "conectando" && "Conectando…"}
            <span className="text-ink-muted/70">
              · {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Selo voz="neutro" onClick={handleExportarPdf} carregando={exportando === "pdf"} className="text-xs">
          Relatório Institucional (PDF)
        </Selo>
        <Selo voz="neutro" onClick={handleExportarXlsx} carregando={exportando === "xlsx"} className="text-xs">
          Base Nominal (XLSX)
        </Selo>
      </div>

      {/* Funil — item 5 */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div>
            <h2 className="text-h2 font-semibold text-ink">Funil de Conversão</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Etapas progressivas de mobilização e conformidade contratual.
            </p>
          </div>
          <span className="text-xs text-ink-muted">
            Clique em um card para abrir a relação completa de contratos
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {ETAPAS_FUNIL_CONFIG.map((cfg) => {
            const valor =
              cfg.chave === "cadastrados"
                ? funil.cadastrado
                : cfg.chave === "aptos"
                  ? funil.apto
                  : funil[cfg.chave];

            const pctBase =
              funil.cadastrado > 0
                ? ((valor / funil.cadastrado) * 100).toFixed(cfg.chave === "cadastrados" ? 0 : 1)
                : "0";

            return (
              <Link
                key={cfg.rotulo}
                href={`/dashboard/contratos?etapa=${cfg.chave}`}
                className={`group relative overflow-hidden border p-4 text-left transition-all cursor-pointer block rounded-lg shadow-xs ${cfg.corCard}`}
              >
                {/* Linha superior colorida da etapa */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${cfg.corTopo}`} />

                {/* Header com indicador de etapa e taxa sobre a base */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span
                    className={`inline-flex items-center text-[0.68rem] font-mono font-medium px-1.5 py-0.5 rounded border ${cfg.corBadge}`}
                  >
                    {cfg.fase}
                  </span>
                  <span
                    className="font-mono text-[0.7rem] text-ink-muted tabular-nums"
                    title={`Representa ${pctBase}% dos colaboradores cadastrados`}
                  >
                    {pctBase}%
                  </span>
                </div>

                {/* Valor numérico */}
                <div
                  className={`font-mono text-2xl font-bold text-ink tabular-nums transition-colors ${cfg.corNumero}`}
                >
                  {valor}
                </div>

                {/* Micro barra de progresso em relação à base */}
                <div className="mt-2.5 w-full bg-line/60 dark:bg-surface-sunken h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.corBarra}`}
                    style={{
                      width: `${funil.cadastrado > 0 ? Math.min(100, Math.max(0, Math.round((valor / funil.cadastrado) * 100))) : 0}%`,
                    }}
                  />
                </div>

                {/* Rótulo da etapa e link hover */}
                <div className="text-xs text-ink-muted mt-2.5 flex items-center justify-between">
                  <span className="font-medium text-ink/90">{cfg.rotulo}</span>
                  <span className="text-[0.7rem] opacity-0 group-hover:opacity-100 transition-opacity font-medium text-primary flex items-center gap-0.5">
                    Ver relação ↗
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Matriz objeto × status — item 1 */}
      <section className="space-y-3">
        <h2 className="text-h2 font-semibold text-ink">Matriz por Objeto Contratual</h2>
        {matriz.linhas.length > 0 ? (
          <div className="overflow-x-auto border border-line bg-surface rounded-lg shadow-xs">
            <table className="w-full border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-line bg-surface-sunken font-mono text-xs text-ink-muted">
                  <th className="p-3">Objeto</th>
                  <th className="p-3 text-center">Emitido</th>
                  <th className="p-3 text-center">Enviado</th>
                  <th className="p-3 text-center">Assinado</th>
                  <th className="p-3 text-center">Total</th>
                  <th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {matriz.linhas.map((linha) => (
                  <tr key={linha.objeto} className="hover:bg-surface-sunken/40 transition-colors">
                    <td className="p-3 font-medium">
                      <Link
                        href={`/dashboard/contratos?objeto=${encodeURIComponent(linha.objeto)}`}
                        className="text-ink hover:text-primary hover:underline cursor-pointer inline-flex items-center gap-1.5 group/link"
                        title={`Ver relação de colaboradores em ${linha.objeto}`}
                      >
                        <span>{linha.objeto}</span>
                        <span className="text-xs text-primary opacity-0 group-hover/link:opacity-100 transition-opacity font-mono">
                          ↗
                        </span>
                      </Link>
                    </td>
                    {(["emitido", "enviado", "assinado"] as ContractStatus[]).map((status) => (
                      <td key={status} className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setDrillDown({
                              titulo: `${linha.objeto} — ${status}`,
                              predicado: (p) =>
                                (p.objeto === linha.objeto ||
                                  p.funcao === linha.objeto ||
                                  Boolean(p.objetos?.includes(linha.objeto))) &&
                                p.statusContrato === status,
                            })
                          }
                          className="font-mono tabular-nums text-ink hover:text-primary hover:underline cursor-pointer disabled:text-ink-muted disabled:no-underline disabled:cursor-default"
                          disabled={!linha.porStatus[status]}
                        >
                          {linha.porStatus[status] ?? 0}
                        </button>
                      </td>
                    ))}
                    <td className="p-3 text-center font-mono font-semibold">
                      <Link
                        href={`/dashboard/contratos?objeto=${encodeURIComponent(linha.objeto)}`}
                        className="text-ink hover:text-primary hover:underline cursor-pointer"
                        title={`Ver ${linha.total} colaboradores em ${linha.objeto}`}
                      >
                        {linha.total}
                      </Link>
                    </td>
                    <td className="p-3 text-right font-mono text-ink-muted">
                      {formatarValor(linha.valorTotal)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-sunken font-semibold">
                  <td className="p-3 text-ink">Total geral</td>
                  <td className="p-3 text-center font-mono">{matriz.totalPorStatus.emitido ?? 0}</td>
                  <td className="p-3 text-center font-mono">{matriz.totalPorStatus.enviado ?? 0}</td>
                  <td className="p-3 text-center font-mono">{matriz.totalPorStatus.assinado ?? 0}</td>
                  <td className="p-3 text-center font-mono">
                    <Link
                      href="/dashboard/contratos?etapa=cadastrados"
                      className="text-ink hover:text-primary hover:underline cursor-pointer"
                      title="Ver todos os colaboradores cadastrados"
                    >
                      {matriz.totalGeral}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono">{formatarValor(matriz.valorTotalGeral)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio titulo="Nenhum contrato emitido ainda" descricao="A matriz aparece assim que o primeiro contrato for emitido." />
        )}
      </section>

      {/* Visão por região — item 4 */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-h2 font-semibold text-ink">Conclusão por Região</h2>
            <p className="text-xs text-ink-muted">
              % de pessoas da região com contrato assinado.
            </p>
          </div>

          {/* Legenda Térmica Dinâmica */}
          <div className="flex items-center gap-1.5 flex-wrap text-[0.7rem] font-mono text-ink-muted bg-surface-sunken/80 border border-line p-1.5 rounded-md">
            <span className="text-[0.68rem] uppercase font-semibold text-ink-subtle px-1">
              Escala Térmica:
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/25 dark:border-sky-500/25">
              🧊 0–25% Frio
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-400/25 dark:border-amber-500/25">
              ⛅ 26–50% Morno
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-400/25 dark:border-orange-500/25">
              ☀️ 51–75% Quente
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-400/35 dark:border-rose-500/35 font-semibold">
              🔥 76–100% Muito Quente
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {regioes.map((r) => {
            const escala = obterEscalaTermica(r.conclusaoPct);

            return (
              <button
                key={r.regiaoId}
                type="button"
                onClick={() =>
                  setDrillDown({ titulo: r.nome, predicado: (p) => p.regiaoNome === r.nome })
                }
                className={`relative overflow-hidden border p-4 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default rounded-lg shadow-xs group ${escala.cardClasse} ${escala.glowClasse}`}
                disabled={r.totalPessoas === 0}
              >
                {/* Cabeçalho do Card: Nome da Região e Quantidade de Pessoas */}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-ink text-small truncate group-hover:underline">
                    {r.nome}
                  </span>
                  <span className="font-mono text-xs text-ink-muted shrink-0">
                    {r.totalPessoas} pessoas
                  </span>
                </div>

                {/* % de Conclusão e Tag Térmica */}
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <div className={`font-mono text-2xl font-bold tabular-nums ${escala.textoClasse}`}>
                    {/* "não informado" nunca vira 0 (Seção 11) */}
                    {r.conclusaoPct === null ? "não informado" : `${r.conclusaoPct}%`}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[0.7rem] px-2 py-0.5 rounded-full border font-mono ${escala.badgeClasse}`}
                  >
                    <span>{escala.icone}</span>
                    <span>{escala.rotuloCurto}</span>
                  </span>
                </div>

                {/* Barra de Progresso com Gradiente Térmico */}
                <div className="mt-3 w-full bg-line/60 dark:bg-surface-sunken h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${escala.barraClasse}`}
                    style={{
                      width: `${Math.min(100, Math.max(0, r.conclusaoPct ?? 0))}%`,
                    }}
                  />
                </div>

                {/* Resumo de Assinaturas e Aptidão */}
                <div className="mt-2.5 text-xs text-ink-muted flex items-center justify-between">
                  <span>
                    {r.pessoasComContratoAssinado} de {r.totalPessoas} assinados
                  </span>
                  <span className="font-mono text-[0.7rem] text-ink-muted/80">
                    {r.pessoasAptas} aptas
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Central de pendências — item 6 */}
      <section className="space-y-3">
        <h2 className="text-h2 font-semibold text-ink">Central de Pendências</h2>
        {pendencias.length === 0 && notificacoesFalhadas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma pendência no momento" descricao="Tudo em dia." />
        ) : (
          <div className="space-y-2">
            {pendencias.map((p) => (
              <button
                key={p.codigo}
                type="button"
                onClick={() =>
                  setDrillDown({
                    titulo: p.descricao,
                    predicado: (pessoa) => predicadoDaPendencia(p.codigo, pessoa),
                  })
                }
                className="w-full flex items-center justify-between border border-line bg-surface p-3 text-left hover:border-primary transition-colors cursor-pointer rounded-lg shadow-xs"
              >
                <span className="flex items-center gap-2 text-small text-ink">
                  <span
                    className={`h-2 w-2 rounded-full ${p.severidade === "critica" ? "bg-alert" : "bg-warning"}`}
                  />
                  {p.descricao}
                </span>
                <Badge status={p.severidade === "critica" ? "rejeitado" : "pendente"} rotuloPersonalizado={String(p.quantidade)} />
              </button>
            ))}

            {notificacoesFalhadas.length > 0 && (
              <Alerta tom="critico" titulo={`${notificacoesFalhadas.length} notificação(ões) com falha de envio`}>
                <ul className="mt-1 space-y-1 text-xs">
                  {notificacoesFalhadas.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      {n.tipo} → {n.destinatario} {n.erro ? `(${n.erro})` : ""}
                    </li>
                  ))}
                </ul>
              </Alerta>
            )}
          </div>
        )}
      </section>

      {/* MODAL: LISTA NOMINAL (1º clique) → documento/contrato (2º clique) */}
      <Modal
        aberto={drillDown !== null}
        aoFechar={() => setDrillDown(null)}
        titulo={drillDown?.titulo ?? ""}
        descricao={`${pessoasNaLista.length} pessoa(s) — clique em uma para abrir o documento ou contrato.`}
      >
        {pessoasNaLista.length > 0 ? (
          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto divide-y divide-line border border-line">
              {pessoasNaLista.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => abrirDocumentoOuContrato(p)}
                  disabled={processandoPessoa === p.id}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-sunken cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <div>
                    <div className="text-small font-medium text-ink">{p.nomeCompleto}</div>
                    <div className="text-xs text-ink-muted">
                      {p.objeto ?? p.funcao ?? "sem função"} · {p.regiaoNome ?? "sem região"}
                    </div>
                  </div>
                  <span className="text-xs text-primary font-medium">
                    {processandoPessoa === p.id ? "Abrindo…" : "Abrir →"}
                  </span>
                </button>
              ))}
            </div>
            {drillDown?.titulo && (
              <div className="pt-2 border-t border-line flex justify-end">
                <Link
                  href={`/dashboard/contratos?objeto=${encodeURIComponent(drillDown.titulo.split(" — ")[0])}`}
                  className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  Ver relação analítica completa →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <p className="text-small text-ink-muted">Ninguém nesta lista.</p>
        )}
      </Modal>
    </div>
  );
}

/** Deriva o predicado de filtro a partir do código da pendência — mesma
 * nomenclatura de `src/lib/pessoas/pendencias.ts`. Hoje só existe um tipo de
 * documento obrigatório, então qualquer pendência "documento_*" equivale
 * exatamente a "não apta"; se a lista de tipos crescer, este predicado precisa
 * crescer junto (mesmo aviso já deixado em `aptidao.ts`). */
function predicadoDaPendencia(codigo: string, pessoa: PessoaResumo): boolean {
  if (codigo.startsWith("documento_")) return !pessoa.apta;
  if (codigo === "contrato_nao_emitido") {
    return pessoa.apta && (pessoa.statusContrato === null || pessoa.statusContrato === "rascunho");
  }
  if (codigo === "contrato_nao_enviado") return pessoa.apta && pessoa.statusContrato === "emitido";
  if (codigo === "contrato_nao_assinado") return pessoa.apta && pessoa.statusContrato === "enviado";
  return false;
}
