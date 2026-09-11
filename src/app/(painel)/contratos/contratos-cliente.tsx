"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type StatusTipo } from "@/components/badge";
import { Selo } from "@/components/selo";
import { Campo } from "@/components/campo";
import { Modal } from "@/components/modal";
import { Alerta } from "@/components/alerta";
import { EstadoVazio } from "@/components/estado-vazio";
import { ESTADO_INICIAL_EMITIR_CONTRATO, ESTADO_INICIAL_EMITIR_LOTE } from "./estado";
import {
  distratarContrato,
  emitirContrato,
  emitirContratosEmLote,
  enviarContrato,
  excluirContrato,
  gerarUrlPdfContrato,
  prepararLinkAssinatura,
  carregarPessoasParaEmissao,
  marcarDistratoAssinado,
} from "./acoes";
import { Paginacao } from "@/components/paginacao";
import { calcularProporcionalDistrato } from "@/lib/contratos/distrato";
import type {
  PaginaContratos,
  ContratoListado,
  PessoaParaEmissao,
  TemplateParaEmissao,
} from "./dados";

const CANAIS_ENVIO = [
  { valor: "email" as const, rotulo: "E-mail" },
  { valor: "whatsapp" as const, rotulo: "WhatsApp" },
  { valor: "presencial" as const, rotulo: "Presencial" },
];

function formatarValor(valor: string) {
  return `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function ContratosCliente({
  paginaContratos,
  templates,
}: {
  paginaContratos: PaginaContratos;
  templates: TemplateParaEmissao[];
}) {
  const router = useRouter();
  const [pessoasAptas, setPessoasAptas] = useState<PessoaParaEmissao[]>([]);
  const [carregandoPessoas, setCarregandoPessoas] = useState(false);
  const [busca, setBusca] = useState(paginaContratos.busca);
  const [statusFiltro, setStatusFiltro] = useState(paginaContratos.status || "");
  const [navegando, startTransition] = useTransition();
  const abaAtiva = paginaContratos.aba;
  useEffect(() => setBusca(paginaContratos.busca), [paginaContratos.busca]);
  useEffect(() => setStatusFiltro(paginaContratos.status || ""), [paginaContratos.status]);
  function navegar(alteracoes: Partial<PaginaContratos>) {
    const filtros = { ...paginaContratos, ...alteracoes };
    if (alteracoes.aba && alteracoes.aba !== paginaContratos.aba && !alteracoes.status) {
      if (
        (alteracoes.aba === "distratos" &&
          !["distratado", "distrato_assinado"].includes(filtros.status || "")) ||
        (alteracoes.aba === "ativos" &&
          ["distratado", "distrato_assinado"].includes(filtros.status || ""))
      ) {
        filtros.status = "";
      }
    }
    const params = new URLSearchParams({
      busca: filtros.busca,
      ...(filtros.status ? { status: filtros.status } : {}),
      aba: filtros.aba,
      pagina: String(filtros.pagina),
      porPagina: String(filtros.porPagina),
    });
    startTransition(() => router.push(`/contratos?${params}`, { scroll: false }));
  }
  async function carregarPessoas() {
    setCarregandoPessoas(true);
    try {
      const resultado = await carregarPessoasParaEmissao();
      if (!resultado.ok) {
        mostrarFeedback("critico", resultado.mensagem);
        return false;
      }
      if (!resultado.pessoas.length) {
        mostrarFeedback(
          "critico",
          "Não há pessoas aptas sem contrato ativo. Confira os cadastros e os documentos.",
        );
        return false;
      }
      setPessoasAptas(resultado.pessoas);
      return true;
    } catch {
      mostrarFeedback("critico", "Não foi possível carregar as pessoas aptas.");
      return false;
    } finally {
      setCarregandoPessoas(false);
    }
  }
  const [processando, setProcessando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tom: "sucesso" | "critico"; texto: string } | null>(
    null,
  );

  const listaExibida = paginaContratos.contratos;

  function mostrarFeedback(tom: "sucesso" | "critico", texto: string) {
    setFeedback({ tom, texto });
    setTimeout(() => setFeedback(null), 4500);
  }

  // --- Modal: Emitir Contrato -----------------------------------------------
  const [modalEmissaoAberto, setModalEmissaoAberto] = useState(false);
  const formEmissaoRef = useRef<HTMLFormElement>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState<TemplateParaEmissao | null>(null);
  const [estadoEmissao, acaoEmissao, emitindoPendente] = useActionState(
    emitirContrato,
    ESTADO_INICIAL_EMITIR_CONTRATO,
  );

  useEffect(() => {
    if (estadoEmissao.status === "sucesso") {
      setModalEmissaoAberto(false);
      formEmissaoRef.current?.reset();
      mostrarFeedback("sucesso", estadoEmissao.mensagem ?? "Contrato emitido.");
      router.refresh();
    }
  }, [estadoEmissao.status, estadoEmissao.mensagem, router]);

  async function abrirModalEmissao() {
    if (!(await carregarPessoas())) return;
    setTemplateSelecionado(templates[0] ?? null);
    setModalEmissaoAberto(true);
  }

  // --- Modal: Emissão em Lote (item 9) ---------------------------------------
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const formLoteRef = useRef<HTMLFormElement>(null);
  const [templateLote, setTemplateLote] = useState<TemplateParaEmissao | null>(null);
  const [pessoasSelecionadasLote, setPessoasSelecionadasLote] = useState<Set<string>>(new Set());
  const [estadoLote, acaoLote, emitindoLotePendente] = useActionState(
    emitirContratosEmLote,
    ESTADO_INICIAL_EMITIR_LOTE,
  );

  useEffect(() => {
    if (estadoLote.status === "sucesso") {
      setModalLoteAberto(false);
      formLoteRef.current?.reset();
      setPessoasSelecionadasLote(new Set());
      mostrarFeedback("sucesso", estadoLote.mensagem ?? "Lote emitido.");
      router.refresh();
    }
  }, [estadoLote.status, estadoLote.mensagem, router]);

  async function abrirModalLote() {
    if (!(await carregarPessoas())) return;
    setTemplateLote(templates[0] ?? null);
    setPessoasSelecionadasLote(new Set());
    setModalLoteAberto(true);
  }

  function alternarPessoaLote(pessoaId: string) {
    setPessoasSelecionadasLote((atual) => {
      const novo = new Set(atual);
      if (novo.has(pessoaId)) novo.delete(pessoaId);
      else novo.add(pessoaId);
      return novo;
    });
  }

  function alternarTodasPessoasLote() {
    setPessoasSelecionadasLote((atual) =>
      atual.size === pessoasAptas.length ? new Set() : new Set(pessoasAptas.map((p) => p.id)),
    );
  }

  // --- Modal: Registrar Envio -------------------------------------------------
  const [modalEnvioAberto, setModalEnvioAberto] = useState(false);
  const [contratoParaEnvio, setContratoParaEnvio] = useState<ContratoListado | null>(null);
  const [canalEnvio, setCanalEnvio] = useState<"email" | "whatsapp" | "presencial">("email");
  const [destinatarioEnvio, setDestinatarioEnvio] = useState("");

  function abrirModalEnvio(contrato: ContratoListado) {
    setContratoParaEnvio(contrato);
    setCanalEnvio("email");
    setDestinatarioEnvio(contrato.pessoaEmail ?? "");
    setModalEnvioAberto(true);
  }

  async function handleConfirmarEnvio() {
    if (!contratoParaEnvio || !destinatarioEnvio.trim()) return;
    setProcessando(contratoParaEnvio.id);
    try {
      const resultado = await enviarContrato(
        contratoParaEnvio.id,
        canalEnvio,
        destinatarioEnvio.trim(),
      );
      setModalEnvioAberto(false);
      mostrarFeedback(
        resultado.ok ? "sucesso" : "critico",
        resultado.mensagem ?? "Não foi possível enviar o contrato.",
      );
      router.refresh();
    } catch {
      mostrarFeedback("critico", "Falha de conexão ao enviar. Tente novamente.");
    } finally {
      setProcessando(null);
    }
  }

  // --- Ações diretas: marcar assinado, distratar, ver termo -----------------
  const [modalDistratoAberto, setModalDistratoAberto] = useState(false);
  const [contratoParaDistrato, setContratoParaDistrato] = useState<ContratoListado | null>(null);
  const [motivoDistrato, setMotivoDistrato] = useState("");
  const [dataDistrato, setDataDistrato] = useState("");

  function abrirModalDistrato(contrato: ContratoListado) {
    setContratoParaDistrato(contrato);
    setMotivoDistrato("desacordo");
    const hoje = new Date().toISOString().split("T")[0];
    let dataInicial = hoje;
    if (hoje < contrato.vigenciaInicio) {
      dataInicial = contrato.vigenciaInicio;
    } else if (hoje > contrato.vigenciaFim) {
      dataInicial = contrato.vigenciaFim;
    }
    setDataDistrato(dataInicial);
    setModalDistratoAberto(true);
  }

  const calculoDistrato = useMemo(() => {
    if (!contratoParaDistrato || !dataDistrato) return null;
    try {
      return calcularProporcionalDistrato({
        vigenciaInicio: contratoParaDistrato.vigenciaInicio,
        vigenciaFim: contratoParaDistrato.vigenciaFim,
        dataDistrato: dataDistrato,
        valor: Number(contratoParaDistrato.valor),
      });
    } catch {
      return null;
    }
  }, [contratoParaDistrato, dataDistrato]);

  async function handleConfirmarDistrato() {
    if (!contratoParaDistrato || !motivoDistrato.trim() || !dataDistrato) return;
    setProcessando(contratoParaDistrato.id);
    const resultado = await distratarContrato(
      contratoParaDistrato.id,
      motivoDistrato.trim(),
      dataDistrato,
    );
    setProcessando(null);
    setModalDistratoAberto(false);
    mostrarFeedback(
      resultado.ok ? "sucesso" : "critico",
      resultado.mensagem ??
        (resultado.ok ? "Distrato registrado e termo gerado." : "Falha ao distratar."),
    );
    if (resultado.ok) router.refresh();
  }

  async function handleMarcarDistratoAssinado(contrato: ContratoListado) {
    setProcessando(contrato.id);
    const resultado = await marcarDistratoAssinado(contrato.id);
    setProcessando(null);
    mostrarFeedback(
      resultado.ok ? "sucesso" : "critico",
      resultado.mensagem ?? "Recebimento confirmado.",
    );
    if (resultado.ok) router.refresh();
  }

  // --- Ação: Excluir Contratado (DadosExcluidos) ----------------------------
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [contratoParaExclusao, setContratoParaExclusao] = useState<ContratoListado | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");

  function abrirModalExclusao(contrato: ContratoListado) {
    setContratoParaExclusao(contrato);
    setMotivoExclusao("");
    setModalExclusaoAberto(true);
  }

  async function handleConfirmarExclusao() {
    if (!contratoParaExclusao) return;
    setProcessando(contratoParaExclusao.id);
    try {
      const resultado = await excluirContrato(contratoParaExclusao.id, motivoExclusao.trim());
      setProcessando(null);
      setModalExclusaoAberto(false);
      mostrarFeedback(
        resultado.ok ? "sucesso" : "critico",
        resultado.mensagem ?? (resultado.ok ? "Contratado excluído com sucesso." : "Falha ao excluir."),
      );
      if (resultado.ok) router.refresh();
    } catch {
      setProcessando(null);
      mostrarFeedback("critico", "Falha de conexão ao excluir o contratado.");
    }
  }

  async function handleVerTermo(
    contrato: ContratoListado,
    versao: "gerado" | "assinado" | "distrato" = "gerado",
  ) {
    setProcessando(contrato.id);
    try {
      const resultado = await gerarUrlPdfContrato(contrato.id, versao);
      if (!resultado.ok || !resultado.url) {
        mostrarFeedback("critico", resultado.mensagem ?? "PDF indisponível.");
        return;
      }
      setTermoUrl(resultado.url);
      setTermoDownloadUrl(resultado.urlDownload ?? resultado.url);
      setTermoNomeArquivo(resultado.nomeArquivo ?? "contrato.pdf");
      setTermoTexto(resultado.texto ?? null);
      setModalTermoAberto(true);
    } catch {
      mostrarFeedback("critico", "Não foi possível abrir o contrato. Tente novamente.");
    } finally {
      setProcessando(null);
    }
  }

  const [modalTermoAberto, setModalTermoAberto] = useState(false);
  const [termoUrl, setTermoUrl] = useState("");
  const [termoDownloadUrl, setTermoDownloadUrl] = useState("");
  const [termoNomeArquivo, setTermoNomeArquivo] = useState("");
  const [termoTexto, setTermoTexto] = useState<string | null>(null);
  const [linkAssinatura, setLinkAssinatura] = useState("");
  async function abrirModalAssinatura(contrato: ContratoListado) {
    setProcessando(contrato.id);
    try {
      const resultado = await prepararLinkAssinatura(contrato.id);
      if (!resultado.ok || !resultado.url)
        mostrarFeedback("critico", resultado.mensagem ?? "Não foi possível preparar o link.");
      else {
        setLinkAssinatura(new URL(resultado.url, window.location.origin).href);
        router.refresh();
      }
    } catch {
      mostrarFeedback("critico", "Falha de conexão ao preparar o link.");
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Ciclo de Vida Contratual & Auditoria
          </span>
          <h1 className="text-h1 font-semibold text-ink">Gestão de Contratos e Vigor</h1>
          <p className="mt-1 text-small text-ink-muted">
            Encontre colaboradores, confira contratos e acompanhe assinaturas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Selo
            voz="neutro"
            onClick={abrirModalLote}
            className="text-xs"
            disabled={carregandoPessoas || templates.length === 0}
          >
            📄 Emissão em Lote
          </Selo>
          <Selo
            voz="selo"
            onClick={abrirModalEmissao}
            className="text-xs"
            disabled={carregandoPessoas || templates.length === 0}
          >
            + Emitir Contrato
          </Selo>
        </div>
      </div>

      {templates.length === 0 && (
        <Alerta tom="atencao" titulo="Emissão indisponível no momento">
          {templates.length === 0
            ? "Cadastre um modelo de contrato em Configurações antes de emitir."
            : "Não há pessoas aptas sem contrato ativo no momento — aprove documentos em Documentos."}
        </Alerta>
      )}

      {feedback && (
        <Alerta tom={feedback.tom === "sucesso" ? "sucesso" : "critico"} titulo="Contratos">
          {feedback.texto}
        </Alerta>
      )}

      <form
        action="/contratos"
        method="get"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navegar({ busca: busca.trim(), status: statusFiltro, pagina: 1 });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="aba" value={abaAtiva} />
        <input type="hidden" name="porPagina" value={paginaContratos.porPagina} />
        <div className="flex-1 min-w-60">
          <Campo
            rotulo="Pesquisar colaborador"
            id="busca-contrato"
            name="busca"
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            maxLength={120}
            placeholder="Nome, CPF, e-mail ou telefone"
          />
        </div>
        <div className="w-56 min-w-44">
          <label
            htmlFor="filtro-estado-contrato"
            className="block text-small font-medium text-ink mb-1"
          >
            Filtrar por Estado
          </label>
          <select
            id="filtro-estado-contrato"
            name="status"
            value={statusFiltro}
            onChange={(e) => {
              const novoStatus = e.target.value;
              setStatusFiltro(novoStatus);
              let novaAba = abaAtiva;
              if (["distratado", "distrato_assinado"].includes(novoStatus)) {
                novaAba = "distratos";
              } else if (novoStatus && abaAtiva === "distratos") {
                novaAba = "ativos";
              }
              navegar({ status: novoStatus, aba: novaAba, pagina: 1 });
            }}
            className="w-full h-[42px] px-3 border border-line bg-surface text-small text-ink focus:border-seal focus:ring-1 focus:ring-seal outline-none cursor-pointer transition-colors"
          >
            <option value="">Todos os Estados</option>
            <optgroup label="Quadro Ativo">
              <option value="assinado">✓ Assinado</option>
              <option value="enviado">➤ Enviado</option>
              <option value="emitido">▸ Emitido</option>
              <option value="rascunho">○ Rascunho</option>
              <option value="cancelado">✕ Cancelado</option>
              <option value="encerrado">✓✓ Encerrado</option>
            </optgroup>
            <optgroup label="Distratos">
              <option value="distratado">✕ Distratado</option>
              <option value="distrato_assinado">✓ Distrato Assinado</option>
            </optgroup>
          </select>
        </div>
        <Selo type="submit" disabled={navegando}>
          {navegando ? "Buscando…" : "Pesquisar"}
        </Selo>
        {(paginaContratos.busca || paginaContratos.status) && (
          <Selo
            voz="neutro"
            onClick={() => {
              setBusca("");
              setStatusFiltro("");
              navegar({ busca: "", status: "", pagina: 1 });
            }}
          >
            Limpar Filtros
          </Selo>
        )}
      </form>

      {/* Filtros Rápidos por Estado (Pills) */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <span className="text-xs text-ink-muted font-medium mr-1 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-seal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Estado:
        </span>
        <button
          type="button"
          onClick={() => {
            setStatusFiltro("");
            navegar({ status: "", pagina: 1 });
          }}
          className={`px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer ${
            !statusFiltro
              ? "bg-seal/15 border-seal text-seal font-semibold shadow-sm"
              : "border-line text-ink-muted hover:border-ink-muted hover:text-ink bg-surface/50"
          }`}
        >
          Todos
        </button>
        {abaAtiva === "ativos" ? (
          <>
            {[
              { id: "assinado", rotulo: "Assinado", icone: "✓", badgeClasses: "text-primary border-primary/40 bg-primary/10" },
              { id: "enviado", rotulo: "Enviado", icone: "➤", badgeClasses: "text-primary border-primary/40 bg-primary/10" },
              { id: "emitido", rotulo: "Emitido", icone: "▸", badgeClasses: "text-primary border-primary/40 bg-primary/10" },
              { id: "rascunho", rotulo: "Rascunho", icone: "○", badgeClasses: "text-ink-muted border-line bg-paper/40" },
              { id: "cancelado", rotulo: "Cancelado", icone: "✕", badgeClasses: "text-ink-muted border-line bg-paper/40" },
              { id: "encerrado", rotulo: "Encerrado", icone: "✓✓", badgeClasses: "text-ink-muted border-line bg-paper/40" },
            ].map((st) => {
              const ativo = statusFiltro === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    const novo = ativo ? "" : st.id;
                    setStatusFiltro(novo);
                    navegar({ status: novo, pagina: 1 });
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                    ativo
                      ? `${st.badgeClasses} font-semibold ring-1 ring-seal/40 shadow-sm`
                      : "border-line text-ink-muted hover:border-ink-muted hover:text-ink bg-surface/50"
                  }`}
                >
                  <span className="text-[0.7rem]">{st.icone}</span>
                  {st.rotulo}
                </button>
              );
            })}
          </>
        ) : (
          <>
            {[
              { id: "distratado", rotulo: "Distratado", icone: "✕", badgeClasses: "text-alert border-alert/40 bg-alert/10" },
              { id: "distrato_assinado", rotulo: "Distrato Assinado", icone: "✓", badgeClasses: "text-alert border-alert/40 bg-alert/10" },
            ].map((st) => {
              const ativo = statusFiltro === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    const novo = ativo ? "" : st.id;
                    setStatusFiltro(novo);
                    navegar({ status: novo, pagina: 1 });
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${
                    ativo
                      ? `${st.badgeClasses} font-semibold ring-1 ring-seal/40 shadow-sm`
                      : "border-line text-ink-muted hover:border-ink-muted hover:text-ink bg-surface/50"
                  }`}
                >
                  <span className="text-[0.7rem]">{st.icone}</span>
                  {st.rotulo}
                </button>
              );
            })}
          </>
        )}
      </div>
      <div role="status" className="sr-only">
        {navegando ? "Carregando contratos" : `${paginaContratos.total} contratos encontrados`}
      </div>
      {/* Abas */}
      <div className="flex border-b border-line gap-6">
        <button
          type="button"
          onClick={() => navegar({ aba: "ativos", pagina: 1 })}
          className={`pb-3 text-small font-medium border-b-2 cursor-pointer transition-colors ${
            abaAtiva === "ativos"
              ? "border-seal text-ink"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Quadro Ativo ({paginaContratos.totalAtivos})
        </button>
        <button
          type="button"
          onClick={() => navegar({ aba: "distratos", pagina: 1 })}
          className={`pb-3 text-small font-medium border-b-2 cursor-pointer transition-colors ${
            abaAtiva === "distratos"
              ? "border-alert text-alert"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Visão de Distratos ({paginaContratos.totalDistratos})
        </button>
      </div>

      {/* Tabela */}
      {listaExibida.length > 0 ? (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-paper/60 font-mono text-xs text-ink-muted">
                <th className="p-3.5">Contratado</th>
                <th className="p-3.5">Objeto e Região</th>
                <th className="p-3.5">Remuneração (Valor por Extenso)</th>
                <th className="p-3.5">Vigência</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {listaExibida.map((c) => {
                const ocupado = processando === c.id;
                return (
                  <tr key={c.id} className="hover:bg-paper/40 transition-colors">
                    <td className="p-3.5">
                      <span className="font-medium text-ink block">{c.pessoaNome}</span>
                      <span className="font-mono text-[0.7rem] text-ink-muted">{c.pessoaCpf}</span>
                    </td>
                    <td className="p-3.5 text-xs">
                      <span className="font-medium text-ink block">{c.objeto}</span>
                      <span className="text-ink-muted block">{c.regiaoNome ?? "—"}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono font-semibold text-ink block">
                        {formatarValor(c.valor)}
                      </span>
                      <span className="text-[0.75rem] text-ink-muted italic block leading-tight">
                        {c.valorExtenso}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-xs text-ink-muted">
                      {formatarData(c.vigenciaInicio)} a {formatarData(c.vigenciaFim)}
                    </td>
                    <td className="p-3.5 text-center">
                      <Badge status={c.status as StatusTipo} />
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {["emitido", "enviado"].includes(c.status) && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => abrirModalEnvio(c)}
                            className="px-2 py-1 text-xs border border-info text-info hover:bg-info/10 cursor-pointer disabled:opacity-50"
                          >
                            Enviar link
                          </button>
                        )}
                        {c.status === "enviado" && (
                          <>
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => abrirModalAssinatura(c)}
                              className="px-2 py-1 text-xs border border-success text-success hover:bg-success/10 cursor-pointer disabled:opacity-50"
                              title="Preparar link para assinatura na tela e foto do rosto"
                            >
                              Link de assinatura
                            </button>
                          </>
                        )}
                        {c.status === "assinado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => abrirModalDistrato(c)}
                            className="px-2 py-1 text-xs border border-alert/40 text-alert hover:bg-alert/10 cursor-pointer disabled:opacity-50"
                          >
                            Distratar
                          </button>
                        )}
                        {c.status === "distratado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleMarcarDistratoAssinado(c)}
                            className="px-2 py-1 text-xs border border-alert/40 text-alert hover:bg-alert/10 cursor-pointer disabled:opacity-50"
                          >
                            Confirmar Recebimento do Termo
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => handleVerTermo(c, "gerado")}
                          className="px-2 py-1 text-xs text-ink hover:underline cursor-pointer disabled:opacity-40"
                          title="Visualizar o contrato completo preenchido"
                        >
                          Ver Termo
                        </button>
                        {c.signedPdfPath && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleVerTermo(c, "assinado")}
                            className="px-2 py-1 text-xs text-success hover:underline cursor-pointer disabled:opacity-40"
                            title="Abrir o PDF assinado anexado"
                          >
                            Ver Assinado
                          </button>
                        )}
                        {c.distratoTermPath && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleVerTermo(c, "distrato")}
                            className="px-2 py-1 text-xs text-alert hover:underline cursor-pointer disabled:opacity-40"
                            title="Abrir o termo de distrato gerado"
                          >
                            Ver Termo de Distrato
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => abrirModalExclusao(c)}
                          className="px-2 py-1 text-xs border border-alert/30 text-alert hover:bg-alert/10 cursor-pointer disabled:opacity-40 transition-colors"
                          title="Excluir contratado do painel e arquivar em DadosExcluidos"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVazio
          titulo="Nenhum contrato encontrado nesta visão"
          descricao={
            paginaContratos.status || paginaContratos.busca
              ? `Nenhum contrato encontrado com os filtros atuais${
                  paginaContratos.status ? ` (estado: ${paginaContratos.status})` : ""
                }${paginaContratos.busca ? ` para "${paginaContratos.busca}"` : ""}. Tente limpar os filtros.`
              : "Não existem contratos associados a esta lista ainda."
          }
        />
      )}

      <Paginacao
        paginaAtual={paginaContratos.pagina}
        totalItens={paginaContratos.total}
        itensPorPagina={paginaContratos.porPagina}
        rotuloItem="contrato"
        rotuloItemPlural="contratos"
        aoMudarPagina={(pagina) => navegar({ pagina })}
        aoMudarItensPorPagina={(porPagina) => navegar({ porPagina, pagina: 1 })}
      />
      {/* MODAL: EMITIR CONTRATO */}
      <Modal
        aberto={modalEmissaoAberto}
        aoFechar={() => setModalEmissaoAberto(false)}
        titulo="Emitir Novo Contrato"
        descricao="O valor por extenso e o PDF são gerados automaticamente pelo sistema."
        rotuloPrimario={emitindoPendente ? "Emitindo…" : "Gerar PDF e Emitir"}
        acaoPrimaria={() => formEmissaoRef.current?.requestSubmit()}
        desabilitarConfirmacao={emitindoPendente}
      >
        <form ref={formEmissaoRef} action={acaoEmissao} className="space-y-4 text-small">
          {estadoEmissao.status === "erro" && (
            <Alerta tom="critico" titulo="Não foi possível emitir">
              {estadoEmissao.mensagem}
            </Alerta>
          )}

          <Campo.Selecao
            rotulo="Pessoa (apta, sem contrato ativo)"
            id="pessoaId"
            name="pessoaId"
            required
          >
            {pessoasAptas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nomeCompleto} — {p.regiaoNome ?? "sem região"}
              </option>
            ))}
          </Campo.Selecao>

          <Campo.Selecao
            rotulo="Modelo de Contrato"
            id="templateId"
            name="templateId"
            required
            value={templateSelecionado?.id ?? ""}
            onChange={(e) =>
              setTemplateSelecionado(templates.find((t) => t.id === e.target.value) ?? null)
            }
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} — {t.objeto}
              </option>
            ))}
          </Campo.Selecao>

          <Campo
            rotulo="Valor (R$)"
            id="valor"
            name="valor"
            mono
            required
            defaultValue={templateSelecionado?.valorPadrao ?? ""}
            key={templateSelecionado?.id}
            placeholder="1500.00"
          />

          <div className="grid grid-cols-2 gap-4">
            <Campo
              rotulo="Vigência — início"
              id="vigenciaInicio"
              name="vigenciaInicio"
              type="date"
              required
            />
            <Campo
              rotulo="Vigência — fim"
              id="vigenciaFim"
              name="vigenciaFim"
              type="date"
              required
            />
          </div>
        </form>
      </Modal>

      {/* MODAL: EMISSÃO EM LOTE (item 9) */}
      <Modal
        aberto={modalLoteAberto}
        aoFechar={() => setModalLoteAberto(false)}
        titulo="Emissão de Contratos em Lote"
        descricao="Gera contrato (com PDF) para todas as pessoas selecionadas, com o mesmo modelo, valor e vigência."
        rotuloPrimario={
          emitindoLotePendente
            ? "Emitindo…"
            : `Emitir ${pessoasSelecionadasLote.size || ""} Contrato(s)`
        }
        acaoPrimaria={() => formLoteRef.current?.requestSubmit()}
        desabilitarConfirmacao={emitindoLotePendente || pessoasSelecionadasLote.size === 0}
      >
        <form ref={formLoteRef} action={acaoLote} className="space-y-4 text-small">
          {estadoLote.status === "erro" && (
            <Alerta tom="critico" titulo="Não foi possível emitir o lote">
              {estadoLote.mensagem}
            </Alerta>
          )}
          {estadoLote.falhas && estadoLote.falhas.length > 0 && (
            <Alerta tom="atencao" titulo={`${estadoLote.falhas.length} contrato(s) não emitido(s)`}>
              <ul className="list-disc pl-4">
                {estadoLote.falhas.map((f, i) => (
                  <li key={i}>
                    {f.pessoaNome}: {f.motivo}
                  </li>
                ))}
              </ul>
            </Alerta>
          )}

          <Campo.Selecao
            rotulo="Modelo de Contrato"
            id="templateIdLote"
            name="templateId"
            required
            value={templateLote?.id ?? ""}
            onChange={(e) =>
              setTemplateLote(templates.find((t) => t.id === e.target.value) ?? null)
            }
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} — {t.objeto}
              </option>
            ))}
          </Campo.Selecao>

          <Campo
            rotulo="Valor (R$) — igual para todos"
            id="valorLote"
            name="valor"
            mono
            required
            defaultValue={templateLote?.valorPadrao ?? ""}
            key={templateLote?.id}
            placeholder="1500.00"
          />

          <div className="grid grid-cols-2 gap-4">
            <Campo
              rotulo="Vigência — início"
              id="vigenciaInicioLote"
              name="vigenciaInicio"
              type="date"
              required
            />
            <Campo
              rotulo="Vigência — fim"
              id="vigenciaFimLote"
              name="vigenciaFim"
              type="date"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-small font-medium text-ink">
                Pessoas ({pessoasSelecionadasLote.size} de {pessoasAptas.length} selecionadas)
              </label>
              <button
                type="button"
                onClick={alternarTodasPessoasLote}
                className="text-xs text-seal hover:underline cursor-pointer"
              >
                {pessoasSelecionadasLote.size === pessoasAptas.length
                  ? "Limpar seleção"
                  : "Selecionar todas"}
              </button>
            </div>
            <div className="border border-line max-h-48 overflow-y-auto divide-y divide-line">
              {pessoasAptas.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-paper/40 text-xs"
                >
                  <input
                    type="checkbox"
                    name="pessoaIds"
                    value={p.id}
                    checked={pessoasSelecionadasLote.has(p.id)}
                    onChange={() => alternarPessoaLote(p.id)}
                    className="h-4 w-4 rounded border-line text-seal focus:ring-seal"
                  />
                  <span className="text-ink">{p.nomeCompleto}</span>
                  <span className="text-ink-muted">— {p.regiaoNome ?? "sem região"}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: REGISTRAR ENVIO */}
      <Modal
        aberto={modalEnvioAberto}
        aoFechar={() => setModalEnvioAberto(false)}
        titulo="Enviar link de assinatura"
        descricao="Envie o contrato preenchido por e-mail ou prepare o link para compartilhar pela coordenação."
        rotuloPrimario={processando === contratoParaEnvio?.id ? "Enviando…" : "Confirmar Envio"}
        acaoPrimaria={handleConfirmarEnvio}
        desabilitarConfirmacao={!destinatarioEnvio.trim() || processando === contratoParaEnvio?.id}
      >
        <div className="space-y-4 text-small">
          <div>
            <label className="block text-small font-medium text-ink mb-1.5">Canal de Envio</label>
            <select
              value={canalEnvio}
              onChange={(e) => {
                const canal = e.target.value as typeof canalEnvio;
                setCanalEnvio(canal);
                setDestinatarioEnvio(
                  canal === "email"
                    ? (contratoParaEnvio?.pessoaEmail ?? "")
                    : canal === "whatsapp"
                      ? (contratoParaEnvio?.pessoaTelefone ?? "")
                      : (contratoParaEnvio?.pessoaNome ?? ""),
                );
              }}
              className="w-full border-b border-line bg-transparent py-2 text-small text-ink outline-none focus:border-seal cursor-pointer"
            >
              {CANAIS_ENVIO.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </div>
          <Campo
            rotulo="Destinatário (e-mail, telefone ou nome de quem recebeu presencialmente)"
            id="destinatarioEnvio"
            value={destinatarioEnvio}
            onChange={(e) => setDestinatarioEnvio(e.target.value)}
            required
          />
        </div>
      </Modal>

      {/* MODAL: CONFIRMAÇÃO DE DISTRATO COM CÁLCULO PROPORCIONAL */}
      <Modal
        aberto={modalDistratoAberto}
        aoFechar={() => setModalDistratoAberto(false)}
        titulo="Registrar Distrato / Rescisão"
        descricao="Insira a data do distrato para calcular automaticamente o valor proporcional aos dias trabalhados e gerar o termo em PDF conforme o modelo oficial."
        rotuloPrimario={
          processando === contratoParaDistrato?.id ? "Gerando termo…" : "Confirmar e Gerar Distrato"
        }
        rotuloSecundario="Desistir"
        vozPrimaria="perigo"
        acaoPrimaria={handleConfirmarDistrato}
        desabilitarConfirmacao={
          !motivoDistrato.trim() || !dataDistrato || processando === contratoParaDistrato?.id
        }
      >
        <div className="space-y-4 text-small">
          <Alerta tom="critico" titulo="Atenção à legislação eleitoral">
            O distrato preserva o histórico financeiro e o contrato original para prestação de
            contas. O valor proporcional calculado constará no Termo de Rescisão oficial.
          </Alerta>

          <div className="p-3 bg-paper/60 border border-line text-small text-ink space-y-1 rounded-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-ink-muted uppercase tracking-wider font-mono">
                Contratado
              </span>
              <span className="font-mono text-xs text-ink-muted">
                CPF: {contratoParaDistrato?.pessoaCpf}
              </span>
            </div>
            <p className="font-semibold text-ink text-base">{contratoParaDistrato?.pessoaNome}</p>
            <p className="text-xs text-ink-muted">
              Objeto: <span className="text-ink font-medium">{contratoParaDistrato?.objeto}</span>
            </p>
            <div className="pt-1.5 flex flex-wrap justify-between text-xs border-t border-line/60 gap-2">
              <span>
                Vigência contratual:{" "}
                <strong className="font-mono">
                  {contratoParaDistrato ? formatarData(contratoParaDistrato.vigenciaInicio) : ""} a{" "}
                  {contratoParaDistrato ? formatarData(contratoParaDistrato.vigenciaFim) : ""}
                </strong>
              </span>
              <span>
                Remuneração mensal:{" "}
                <strong className="font-mono">
                  {contratoParaDistrato ? formatarValor(contratoParaDistrato.valor) : ""}
                </strong>
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="data-distrato-input"
              className="block text-small font-medium text-ink mb-1"
            >
              Data do Distrato (Período de término trabalhado)
            </label>
            <input
              type="date"
              id="data-distrato-input"
              value={dataDistrato}
              min={contratoParaDistrato?.vigenciaInicio}
              max={contratoParaDistrato?.vigenciaFim}
              onChange={(e) => setDataDistrato(e.target.value)}
              className="w-full border border-line bg-surface p-2.5 text-small text-ink outline-none focus:border-seal focus:ring-1 focus:ring-seal"
              required
            />
            <p className="text-xs text-ink-muted mt-1">
              Data de encerramento efetivo das atividades para cálculo dos dias corridos.
            </p>
          </div>

          {calculoDistrato && (
            <div className="p-3.5 bg-surface border border-seal/40 space-y-2 rounded-sm shadow-inner">
              <div className="flex items-center justify-between text-xs border-b border-line pb-2">
                <span className="text-ink font-medium flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-seal"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Cálculo Proporcional Automático
                </span>
                <span className="font-mono text-ink-muted text-[0.75rem]">
                  {calculoDistrato.diasTrabalhados} de {calculoDistrato.diasTotais} dias corridos
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-ink-muted block text-[0.7rem]">Período trabalhado</span>
                  <strong className="text-ink font-mono">
                    {calculoDistrato.vigenciaInicioFormatada} a{" "}
                    {calculoDistrato.dataDistratoFormatada}
                  </strong>
                </div>
                <div>
                  <span className="text-ink-muted block text-[0.7rem]">Valor da diária</span>
                  <strong className="text-ink font-mono">
                    R${" "}
                    {calculoDistrato.valorDiario.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    / dia
                  </strong>
                </div>
              </div>
              <div className="pt-2 border-t border-line/60">
                <span className="text-xs text-ink-muted block">
                  Valor a ser pago ao colaborador:
                </span>
                <div className="text-lg font-bold text-success font-mono">
                  R${" "}
                  {calculoDistrato.valorProporcional.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-ink-muted italic leading-snug">
                  ({calculoDistrato.valorProporcionalExtenso})
                </div>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="motivo-distrato-input"
              className="block text-small font-medium text-ink mb-1"
            >
              Motivo do Distrato
            </label>
            <textarea
              id="motivo-distrato-input"
              rows={2}
              value={motivoDistrato}
              onChange={(e) => setMotivoDistrato(e.target.value)}
              className="w-full border border-line bg-transparent p-2.5 text-small text-ink outline-none focus:border-seal leading-relaxed"
              placeholder="Ex: desacordo ou pedido de desligamento do próprio contratado."
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: EXCLUIR CONTRATADO (DadosExcluidos) */}
      <Modal
        aberto={modalExclusaoAberto}
        aoFechar={() => setModalExclusaoAberto(false)}
        titulo="Excluir Contratado do Painel"
        descricao="O registro será removido das listas do painel para não confundir o administrador, e os dados completos serão arquivados com segurança na tabela DadosExcluidos."
        rotuloPrimario={
          processando === contratoParaExclusao?.id ? "Excluindo…" : "Confirmar Exclusão"
        }
        rotuloSecundario="Cancelar"
        vozPrimaria="perigo"
        acaoPrimaria={handleConfirmarExclusao}
        desabilitarConfirmacao={processando === contratoParaExclusao?.id}
      >
        <div className="space-y-4">
          <Alerta tom="atencao" titulo="Controle total e registros de atividades">
            Ao excluir, o contrato desaparece deste painel, mas o histórico completo e os dados cadastrais
            ficam permanentemente registrados na tabela <strong>DadosExcluidos</strong> para fins de auditoria,
            incluindo seu nome e login como responsável pela exclusão.
          </Alerta>
          <div className="p-3 bg-paper/60 border border-line text-small text-ink space-y-1">
            <p>
              Contratado: <strong>{contratoParaExclusao?.pessoaNome}</strong>
            </p>
            <p className="text-xs text-ink-muted">
              CPF: <span className="font-mono">{contratoParaExclusao?.pessoaCpf}</span> · Função:{" "}
              {contratoParaExclusao?.objeto}
            </p>
            <p className="text-xs text-ink-muted">
              Remuneração: {contratoParaExclusao ? formatarValor(contratoParaExclusao.valor) : ""} · Estado atual:{" "}
              <span className="font-mono font-medium text-ink uppercase">{contratoParaExclusao?.status}</span>
            </p>
          </div>
          <div>
            <label className="block text-small font-medium text-ink mb-1.5">
              Motivo da Exclusão <span className="text-xs text-ink-muted">(opcional)</span>
            </label>
            <textarea
              rows={2}
              value={motivoExclusao}
              onChange={(e) => setMotivoExclusao(e.target.value)}
              className="w-full border border-line bg-transparent p-2.5 text-small text-ink outline-none focus:border-seal leading-relaxed"
              placeholder="Ex: Contratação cancelada por desistência do candidato antes do início."
            />
          </div>
        </div>
      </Modal>

      <Modal
        aberto={modalTermoAberto}
        aoFechar={() => setModalTermoAberto(false)}
        titulo="Contrato completo"
        larguraMaxima="max-w-5xl"
        rotuloSecundario="Fechar"
      >
        <div className="flex flex-wrap gap-4">
          <a href={termoUrl} target="_blank" rel="noopener noreferrer" className="text-seal underline">
            Abrir PDF
          </a>
          <a href={termoDownloadUrl} download={termoNomeArquivo} className="text-seal underline">
            Baixar PDF
          </a>
        </div>
        <p className="mt-2 break-all text-xs text-ink-muted">{termoNomeArquivo}</p>
        {modalTermoAberto &&
          (termoTexto ? (
            <article
              aria-label="Texto integral do contrato"
              className="mt-4 max-h-[65vh] overflow-y-auto whitespace-pre-line break-words bg-white p-6 text-sm leading-7 text-slate-900"
              tabIndex={0}
            >
              <h3 className="mb-5 text-center font-semibold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h3>
              {termoTexto}
            </article>
          ) : (
            <iframe
              title="Contrato completo preenchido"
              src={termoUrl}
              className="mt-3 h-[65vh] w-full bg-white"
            />
          ))}
      </Modal>
      <Modal
        aberto={!!linkAssinatura}
        aoFechar={() => setLinkAssinatura("")}
        titulo="Link de assinatura"
        descricao="O colaborador confere o contrato, assina na tela e tira uma foto do rosto. O PDF assinado será anexado automaticamente."
      >
        <Campo
          rotulo="Link para o colaborador"
          id="link-assinatura"
          value={linkAssinatura}
          readOnly
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Selo
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(linkAssinatura);
                mostrarFeedback("sucesso", "Link copiado.");
              } catch {
                mostrarFeedback("critico", "Selecione e copie o link acima.");
              }
            }}
          >
            Copiar link
          </Selo>
          <a
            href={linkAssinatura}
            target="_blank"
            rel="noopener noreferrer"
            className="text-seal underline self-center"
          >
            Abrir contrato
          </a>
        </div>
        <p className="mt-4 text-small text-ink-muted">
          Válido por 7 dias. Compartilhe apenas com o colaborador.
        </p>
      </Modal>
    </div>
  );
}
