"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, type StatusTipo } from "@/components/badge";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import { Paginacao } from "@/components/paginacao";
import { posicaoAlcancada, type Funil } from "@/lib/dashboard/agregacoes";
import { gerarUrlParaDrillDown } from "../acoes";
import type { PessoaResumo, VisaoRegional } from "../dados";

export type EtapaFunil = "cadastrados" | "aptos" | "emitido" | "enviado" | "assinado";

const ETAPAS_CONFIG: { chave: EtapaFunil; rotulo: string; descricao: string }[] = [
  {
    chave: "cadastrados",
    rotulo: "Cadastrados",
    descricao: "Todos os colaboradores registrados na base da organização.",
  },
  {
    chave: "aptos",
    rotulo: "Aptos",
    descricao: "Colaboradores com documentação analisada e aprovada, aptos para emissão.",
  },
  {
    chave: "emitido",
    rotulo: "Emitido",
    descricao: "Contratos gerados e prontos para envio ao colaborador.",
  },
  {
    chave: "enviado",
    rotulo: "Enviado",
    descricao: "Contratos enviados por e-mail, WhatsApp ou entregues presencialmente.",
  },
  {
    chave: "assinado",
    rotulo: "Assinado",
    descricao: "Contratos formalizados e assinados pelo colaborador.",
  },
];

const STATUS_CONHECIDOS: StatusTipo[] = [
  "rascunho",
  "emitido",
  "enviado",
  "assinado",
  "distratado",
  "distrato_assinado",
  "encerrado",
  "cancelado",
];

function statusContratoParaBadge(status: string | null): StatusTipo | null {
  if (!status) return null;
  return (STATUS_CONHECIDOS as string[]).includes(status) ? (status as StatusTipo) : null;
}

function formatarValor(valor: string | null): string {
  if (!valor) return "—";
  const num = Number(valor);
  if (isNaN(num)) return "—";
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function ContratosFunilCliente({
  pessoas,
  regioes,
  funil,
  etapaInicial = "cadastrados",
  objetoInicial,
}: {
  pessoas: PessoaResumo[];
  regioes: VisaoRegional[];
  funil: Funil;
  etapaInicial?: string;
  objetoInicial?: string;
}) {
  const [etapaAtiva, setEtapaAtiva] = useState<EtapaFunil>(() => {
    const valida = ETAPAS_CONFIG.find((e) => e.chave === etapaInicial.toLowerCase());
    return valida ? valida.chave : "cadastrados";
  });

  const [busca, setBusca] = useState("");
  const [filtroObjeto, setFiltroObjeto] = useState<string>(objetoInicial ?? "todos");
  const [filtroRegiao, setFiltroRegiao] = useState("todas");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [processandoPessoa, setProcessandoPessoa] = useState<string | null>(null);

  // Lista única de todos os objetos e funções disponíveis
  const listaObjetos = Array.from(
    new Set(
      pessoas
        .flatMap((p) => [p.objeto, p.funcao, ...(p.objetos ?? [])])
        .filter((o): o is string => Boolean(o && o.trim()))
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (objetoInicial && objetoInicial !== "todos" && !listaObjetos.includes(objetoInicial)) {
    listaObjetos.unshift(objetoInicial);
  }

  // Reseta a página sempre que os critérios de filtragem mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [etapaAtiva, busca, filtroRegiao, filtroObjeto]);

  // Filtra pessoas conforme a etapa do funil e os critérios de busca/região/objeto
  const pessoasFiltradas = pessoas.filter((p) => {
    // 1. Predicado da etapa do funil
    let bateEtapa = true;
    if (etapaAtiva === "aptos") {
      bateEtapa = p.apta;
    } else if (etapaAtiva === "emitido") {
      bateEtapa = posicaoAlcancada(p.statusContrato) >= 1;
    } else if (etapaAtiva === "enviado") {
      bateEtapa = posicaoAlcancada(p.statusContrato) >= 2;
    } else if (etapaAtiva === "assinado") {
      bateEtapa = posicaoAlcancada(p.statusContrato) >= 3;
    }

    if (!bateEtapa) return false;

    // 2. Filtro de Objeto Contratual / Função
    if (filtroObjeto !== "todos") {
      const objetoAlvo = filtroObjeto.toLowerCase().trim();
      const bateObjeto =
        p.objeto?.toLowerCase().trim() === objetoAlvo ||
        p.funcao?.toLowerCase().trim() === objetoAlvo ||
        (p.objetos && p.objetos.some((o) => o.toLowerCase().trim() === objetoAlvo));
      if (!bateObjeto) return false;
    }

    // 3. Busca por texto (nome, CPF, objeto ou função)
    const termo = busca.toLowerCase().trim();
    if (termo) {
      const termoCpf = termo.replace(/\D/g, "");
      const bateNome = p.nomeCompleto.toLowerCase().includes(termo);
      const bateCpf = termoCpf.length > 0 && p.cpf.includes(termoCpf);
      const bateObjeto = p.objeto?.toLowerCase().includes(termo) ?? false;
      const bateFuncao = p.funcao?.toLowerCase().includes(termo) ?? false;
      if (!bateNome && !bateCpf && !bateObjeto && !bateFuncao) return false;
    }

    // 4. Filtro de região
    if (filtroRegiao !== "todas" && p.regiaoNome !== filtroRegiao) {
      return false;
    }

    return true;
  });

  // Fatiamento de paginação
  const totalPaginas = Math.max(1, Math.ceil(pessoasFiltradas.length / itensPorPagina));
  const paginaAjustada = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const indiceInicial = (paginaAjustada - 1) * itensPorPagina;
  const pessoasExibidas = pessoasFiltradas.slice(indiceInicial, indiceInicial + itensPorPagina);

  function handleMudarItensPorPagina(novosItensPorPagina: number) {
    setItensPorPagina(novosItensPorPagina);
    setPaginaAtual(1);
  }

  async function handleAbrirDocumentoOuContrato(pessoa: PessoaResumo) {
    setProcessandoPessoa(pessoa.id);
    const resultado = await gerarUrlParaDrillDown({
      documentoId: pessoa.documentoId,
      contratoId: pessoa.contratoId,
    });
    setProcessandoPessoa(null);

    if (!resultado.ok || !resultado.url) {
      alert(resultado.mensagem ?? "Documento ou contrato ainda não disponível.");
      return;
    }

    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  const etapaInfo = ETAPAS_CONFIG.find((e) => e.chave === etapaAtiva);

  function obterContagemDaEtapa(chave: EtapaFunil): number {
    switch (chave) {
      case "cadastrados":
        return funil.cadastrado;
      case "aptos":
        return funil.apto;
      case "emitido":
        return funil.emitido;
      case "enviado":
        return funil.enviado;
      case "assinado":
        return funil.assinado;
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Navegação de retorno */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-primary transition-colors group"
        >
          <span className="transition-transform group-hover:-translate-x-0.5">←</span>
          <span>Voltar ao Painel Geral</span>
        </Link>
        <span className="font-mono text-xs text-ink-muted">
          Total de registros nesta visão:{" "}
          <strong className="text-ink">{pessoasFiltradas.length}</strong>
        </span>
      </div>

      {/* Cabeçalho da página */}
      <div className="border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
              Painel do Gestor · Relação Analítica de Contratos
            </span>
            <h1 className="text-h1 font-semibold text-ink mt-0.5">
              Relação de Contratos — Funil de Conversão
            </h1>
          </div>
          {filtroObjeto !== "todos" && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-primary-tint text-primary border border-primary/25">
              <span>Objeto: <strong>{filtroObjeto}</strong></span>
              <button
                type="button"
                onClick={() => setFiltroObjeto("todos")}
                className="hover:text-ink font-bold cursor-pointer ml-1"
                title="Remover filtro de objeto"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <p className="mt-1 text-small text-ink-muted">
          {filtroObjeto !== "todos"
            ? `Listando colaboradores vinculados ao objeto contratual "${filtroObjeto}".`
            : etapaInfo?.descricao ??
              "Relação nominal com objeto, remuneração, região e status de conformidade documental."}
        </p>
      </div>

      {/* Abas das 5 Etapas do Funil */}
      <div className="flex border-b border-line gap-2 sm:gap-6 overflow-x-auto">
        {ETAPAS_CONFIG.map((e) => {
          const ativa = etapaAtiva === e.chave;
          const quantidade = obterContagemDaEtapa(e.chave);
          return (
            <button
              key={e.chave}
              type="button"
              onClick={() => setEtapaAtiva(e.chave)}
              className={`pb-3 text-small font-medium border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                ativa
                  ? "border-primary text-ink font-semibold"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              <span>{e.rotulo}</span>{" "}
              <span
                className={`ml-1 font-mono text-xs px-1.5 py-0.5 rounded-full ${
                  ativa ? "bg-primary-tint text-primary font-bold" : "bg-surface-sunken text-ink-muted"
                }`}
              >
                {quantidade}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-surface p-4 border border-line">
        <div className="md:col-span-5">
          <Campo
            rotulo="Buscar por colaborador, CPF ou objeto"
            id="busca-funil"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite nome, CPF ou função para filtrar..."
          />
        </div>

        <div className="md:col-span-4">
          <label
            htmlFor="filtro-objeto-funil"
            className="block text-small font-medium text-ink mb-1.5"
          >
            Objeto Contratual / Função
          </label>
          <select
            id="filtro-objeto-funil"
            value={filtroObjeto}
            onChange={(e) => setFiltroObjeto(e.target.value)}
            className="w-full border-b border-line bg-transparent py-2 text-small text-ink outline-none focus:border-primary cursor-pointer"
          >
            <option value="todos">Todos os objetos</option>
            {listaObjetos.map((obj) => (
              <option key={obj} value={obj}>
                {obj}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label
            htmlFor="filtro-regiao-funil"
            className="block text-small font-medium text-ink mb-1.5"
          >
            Região / Localidade
          </label>
          <select
            id="filtro-regiao-funil"
            value={filtroRegiao}
            onChange={(e) => setFiltroRegiao(e.target.value)}
            className="w-full border-b border-line bg-transparent py-2 text-small text-ink outline-none focus:border-primary cursor-pointer"
          >
            <option value="todas">Todas as regiões</option>
            {regioes.map((r) => (
              <option key={r.regiaoId} value={r.nome}>
                {r.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela Completa de Contratos do Funil */}
      {pessoasFiltradas.length > 0 ? (
        <div className="border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-line bg-surface-sunken font-mono text-xs text-ink-muted">
                  <th className="p-3.5">Colaborador / Contratado</th>
                  <th className="p-3.5">Função e Objeto</th>
                  <th className="p-3.5">Região</th>
                  <th className="p-3.5">Remuneração</th>
                  <th className="p-3.5 text-center">Aptidão</th>
                  <th className="p-3.5 text-center">Status Contratual</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pessoasExibidas.map((p) => {
                  const statusBadge = statusContratoParaBadge(p.statusContrato);
                  const ocupado = processandoPessoa === p.id;
                  const temDocumentoOuContrato = Boolean(p.documentoId || p.contratoId);

                  return (
                    <tr key={p.id} className="hover:bg-surface-sunken/60 transition-colors">
                      {/* Colaborador */}
                      <td className="p-3.5">
                        <div className="font-medium text-ink">{p.nomeCompleto}</div>
                        <div className="font-mono text-xs text-ink-muted">{p.cpf}</div>
                      </td>

                      {/* Função e Objeto */}
                      <td className="p-3.5 text-xs">
                        <div className="text-ink font-medium">
                          {p.objeto ?? p.funcao ?? "—"}
                        </div>
                        {p.objeto && p.funcao && p.objeto !== p.funcao && (
                          <div className="text-ink-muted">{p.funcao}</div>
                        )}
                      </td>

                      {/* Região */}
                      <td className="p-3.5 text-xs text-ink-muted">
                        {p.regiaoNome ?? "Sem região"}
                      </td>

                      {/* Remuneração */}
                      <td className="p-3.5 font-mono text-xs font-semibold text-ink">
                        {formatarValor(p.valor)}
                      </td>

                      {/* Aptidão */}
                      <td className="p-3.5 text-center">
                        {p.apta ? (
                          <Badge status="apta">Apto p/ Contrato</Badge>
                        ) : (
                          <Badge status="pendente">Doc Pendente</Badge>
                        )}
                      </td>

                      {/* Status do Contrato */}
                      <td className="p-3.5 text-center">
                        {statusBadge ? (
                          <Badge status={statusBadge} />
                        ) : (
                          <span className="text-xs text-ink-muted font-mono">Sem contrato</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-3.5 text-right">
                        {temDocumentoOuContrato ? (
                          <button
                            type="button"
                            onClick={() => handleAbrirDocumentoOuContrato(p)}
                            disabled={ocupado}
                            className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer disabled:opacity-50"
                            title="Abrir PDF do contrato ou documento comprobatório"
                          >
                            <span>{ocupado ? "Abrindo…" : "Abrir ↗"}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <Paginacao
            paginaAtual={paginaAjustada}
            totalItens={pessoasFiltradas.length}
            itensPorPagina={itensPorPagina}
            aoMudarPagina={setPaginaAtual}
            aoMudarItensPorPagina={handleMudarItensPorPagina}
            rotuloItem="contrato/colaborador"
            rotuloItemPlural="contratos/colaboradores"
          />
        </div>
      ) : (
        <EstadoVazio
          titulo={
            filtroObjeto !== "todos"
              ? `Nenhum colaborador encontrado para "${filtroObjeto}" na etapa "${etapaInfo?.rotulo ?? etapaAtiva}"`
              : `Nenhum registro localizado na etapa "${etapaInfo?.rotulo ?? etapaAtiva}"`
          }
          descricao="Tente redefinir a busca por texto, selecionar outra região ou redefinir o objeto contratual."
          acao={
            <Selo
              voz="neutro"
              onClick={() => {
                setBusca("");
                setFiltroRegiao("todas");
                setFiltroObjeto("todos");
              }}
            >
              Limpar filtros
            </Selo>
          }
        />
      )}
    </div>
  );
}
