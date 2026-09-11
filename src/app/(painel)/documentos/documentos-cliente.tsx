"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, type StatusTipo } from "@/components/badge";
import { Modal } from "@/components/modal";
import { Alerta } from "@/components/alerta";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import {
  adicionarDocumentoManual,
  aprovarDocumentoEGerarContrato,
  editarDocumento,
  excluirDocumento,
  gerarUrlDocumento,
  marcarDocumentoPendente,
  rejeitarDocumento,
} from "./acoes";
import type { ColaboradorOpcao, DocumentoListado } from "./dados";

const ROTULO_TIPO: Record<string, string> = {
  documento_identidade: "Documento de Identidade (RG/CNH)",
  comprovante_endereco: "Comprovante de Residência",
};

const MOTIVOS_RECORRENTES = [
  "Resolução inferior a 800 px (foto ilegível)",
  "Documento cortado ou incompleto",
  "Reflexo da luz encobre o número do documento",
  "Documento vencido ou inválido",
  "Comprovante com mais de 90 dias ou ilegível",
];

function formatarDataBR(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const partes = isoDate.split("T")[0].split("-");
  if (partes.length !== 3) return isoDate;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function extrairTextoCustomizado(textoAtual: string, motivos: string[]): string {
  const linhas = textoAtual.split("\n");
  const linhasCustomizadas = linhas.filter((linha) => {
    const limpa = linha.replace(/^[\s•\-\*]+\s*/, "").trim();
    return !motivos.some((m) => m.toLowerCase() === limpa.toLowerCase());
  });
  return linhasCustomizadas.join("\n").trim();
}

function montarTextoMotivo(selecionados: string[], textoCustomizado: string): string {
  const partes: string[] = [];
  if (selecionados.length === 1) {
    partes.push(selecionados[0]);
  } else if (selecionados.length > 1) {
    partes.push(selecionados.map((m) => `• ${m}`).join("\n"));
  }
  if (textoCustomizado) {
    partes.push(textoCustomizado);
  }
  return partes.join("\n\n");
}

export function DocumentosCliente({
  documentosIniciais,
  colaboradores = [],
}: {
  documentosIniciais: DocumentoListado[];
  colaboradores?: ColaboradorOpcao[];
}) {
  const router = useRouter();

  // Filtros e busca
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendente" | "aprovado" | "rejeitado">("todos");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "documento_identidade" | "comprovante_endereco">("todos");
  const [busca, setBusca] = useState("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"colaborador" | "tabela">("colaborador");

  const [processando, setProcessando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tipo: "sucesso" | "erro" | "info";
    titulo: string;
    mensagem: string;
    urlAssinatura?: string;
  } | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Modais de Controle
  const [docSelecionado, setDocSelecionado] = useState<DocumentoListado | null>(null);
  const [modalConferenciaAberto, setModalConferenciaAberto] = useState(false);
  const [carregandoDocUrl, setCarregandoDocUrl] = useState(false);

  // Modal 1: Rejeição
  const [modalRejeicaoAberto, setModalRejeicaoAberto] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [motivosSelecionados, setMotivosSelecionados] = useState<string[]>([]);

  // Modal 2: Adicionar Documento Manual
  const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
  const [salvandoNovoDoc, setSalvandoNovoDoc] = useState(false);
  const formAdicionarRef = useRef<HTMLFormElement>(null);

  // Modal 3: Editar Documento
  const [docParaEditar, setDocParaEditar] = useState<DocumentoListado | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const formEditarRef = useRef<HTMLFormElement>(null);

  // Modal 4: Excluir Documento
  const [docParaExcluir, setDocParaExcluir] = useState<DocumentoListado | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [excluindoDoc, setExcluindoDoc] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  // Contadores por status
  const contadores = useMemo(() => {
    return {
      todos: documentosIniciais.length,
      pendente: documentosIniciais.filter((d) => d.status === "pendente").length,
      aprovado: documentosIniciais.filter((d) => d.status === "aprovado").length,
      rejeitado: documentosIniciais.filter((d) => d.status === "rejeitado").length,
    };
  }, [documentosIniciais]);

  // Lista filtrada
  const docsFiltrados = useMemo(() => {
    return documentosIniciais.filter((d) => {
      if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
      if (filtroTipo !== "todos" && d.tipo !== filtroTipo) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const nomeMatch = d.pessoaNome.toLowerCase().includes(termo);
        const cpfMatch = d.pessoaCpf.replace(/\D/g, "").includes(termo.replace(/\D/g, ""));
        const arqMatch = d.nomeOriginal.toLowerCase().includes(termo);
        const storageMatch = d.caminhoStorage.toLowerCase().includes(termo);
        if (!nomeMatch && !cpfMatch && !arqMatch && !storageMatch) return false;
      }
      return true;
    });
  }, [documentosIniciais, filtroStatus, filtroTipo, busca]);

  // Agrupamento por colaborador (1 colaborador pode ter até 2 documentos: Identidade e Residência)
  const gruposPorColaborador = useMemo(() => {
    const mapa = new Map<
      string,
      {
        pessoaId: string;
        pessoaNome: string;
        pessoaCpf: string;
        documentos: DocumentoListado[];
      }
    >();

    for (const doc of docsFiltrados) {
      const existente = mapa.get(doc.pessoaId);
      if (existente) {
        existente.documentos.push(doc);
      } else {
        mapa.set(doc.pessoaId, {
          pessoaId: doc.pessoaId,
          pessoaNome: doc.pessoaNome,
          pessoaCpf: doc.pessoaCpf,
          documentos: [doc],
        });
      }
    }

    return Array.from(mapa.values());
  }, [docsFiltrados]);

  function mostrarFeedback(
    titulo: string,
    mensagem: string,
    tipo: "sucesso" | "erro" | "info" = "sucesso",
    urlAssinatura?: string,
  ) {
    setFeedback({ titulo, mensagem, tipo, urlAssinatura });
    const timeout = urlAssinatura ? 15000 : 6000;
    setTimeout(() => setFeedback(null), timeout);
  }

  // --- Handlers de Ações de Triagem ---

  async function handleAprovar(doc: DocumentoListado) {
    setProcessando(doc.id);
    const resultado = await aprovarDocumentoEGerarContrato(doc.id);
    setProcessando(null);
    setModalConferenciaAberto(false);

    if (!resultado.ok) {
      mostrarFeedback(
        "Erro na Aprovação",
        resultado.mensagem ?? "Não foi possível aprovar o documento.",
        "erro",
      );
      return;
    }

    mostrarFeedback(
      "Documento Aprovado & Contrato Emitido",
      resultado.mensagem ??
        `Documento de ${doc.pessoaNome} aprovado com sucesso e contrato gerado em PDF.`,
      "sucesso",
      resultado.urlAssinatura,
    );
    router.refresh();
  }

  async function handleMarcarPendente(doc: DocumentoListado) {
    setProcessando(doc.id);
    const resultado = await marcarDocumentoPendente(doc.id);
    setProcessando(null);

    if (!resultado.ok) {
      mostrarFeedback(
        "Erro na Reabertura",
        resultado.mensagem ?? "Não foi possível marcar como pendente.",
        "erro",
      );
      return;
    }

    mostrarFeedback(
      "Documento Reaberto",
      resultado.mensagem ?? "O documento voltou para o estado pendente de conferência.",
      "info",
    );
    router.refresh();
  }

  async function handleAprovarTodosDoColaborador(documentos: DocumentoListado[]) {
    const pendentes = documentos.filter((d) => d.status === "pendente");
    if (pendentes.length === 0) return;

    setProcessando(pendentes[0].pessoaId);
    let ultimoResultado: {
      ok: boolean;
      mensagem?: string;
      urlAssinatura?: string;
    } = { ok: true };

    for (const doc of pendentes) {
      const res = await aprovarDocumentoEGerarContrato(doc.id);
      if (!res.ok) {
        mostrarFeedback(
          "Erro na Aprovação",
          res.mensagem ?? `Erro ao aprovar documento ${doc.tipo}.`,
          "erro",
        );
        setProcessando(null);
        return;
      }
      ultimoResultado = res;
    }

    setProcessando(null);
    mostrarFeedback(
      "Documentos Aprovados",
      ultimoResultado.mensagem ??
        `Todos os documentos de ${pendentes[0].pessoaNome} foram aprovados com sucesso.`,
      "sucesso",
      ultimoResultado.urlAssinatura,
    );
    router.refresh();
  }

  function abrirModalRejeicao(doc: DocumentoListado) {
    setDocSelecionado(doc);
    const motivoPadrao =
      (doc.larguraPx ?? 0) < 800
        ? "Resolução inferior a 800 px (foto ilegível)"
        : "";
    const selecionadosIniciais = motivoPadrao ? [motivoPadrao] : [];
    setMotivosSelecionados(selecionadosIniciais);
    setMotivoRejeicao(motivoPadrao);
    setModalConferenciaAberto(false);
    setModalRejeicaoAberto(true);
  }

  function handleToggleMotivo(motivo: string) {
    const jaSelecionado = motivosSelecionados.includes(motivo);
    const novosSelecionados = jaSelecionado
      ? motivosSelecionados.filter((m) => m !== motivo)
      : [...motivosSelecionados, motivo];

    setMotivosSelecionados(novosSelecionados);

    const customizado = extrairTextoCustomizado(motivoRejeicao, MOTIVOS_RECORRENTES);
    const novoTexto = montarTextoMotivo(novosSelecionados, customizado);
    setMotivoRejeicao(novoTexto);
  }

  function handleTextareaChange(novoTexto: string) {
    setMotivoRejeicao(novoTexto);
    const presentes = MOTIVOS_RECORRENTES.filter((m) =>
      novoTexto.toLowerCase().includes(m.toLowerCase()),
    );
    setMotivosSelecionados(presentes);
  }

  async function handleConfirmarRejeicao() {
    if (!docSelecionado || !motivoRejeicao.trim()) return;

    setProcessando(docSelecionado.id);
    const resultado = await rejeitarDocumento(docSelecionado.id, motivoRejeicao.trim());
    setProcessando(null);
    setModalRejeicaoAberto(false);

    if (!resultado.ok) {
      mostrarFeedback(
        "Erro na Reprovação",
        resultado.mensagem ?? "Não foi possível rejeitar o documento.",
        "erro",
      );
      return;
    }
    mostrarFeedback(
      "Documento Reprovado",
      `Documento reprovado. Um novo link de coleta foi enviado por e-mail para ${docSelecionado.pessoaNome} reenviar.`,
      "info",
    );
    router.refresh();
  }

  async function handleVisualizarDocumento(docId: string) {
    setCarregandoDocUrl(true);
    const resultado = await gerarUrlDocumento(docId);
    setCarregandoDocUrl(false);

    if (!resultado.ok || !resultado.url) {
      mostrarFeedback(
        "Acesso ao Arquivo",
        resultado.mensagem ?? "Não foi possível gerar o link de acesso.",
        "erro",
      );
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  // --- Handlers de CRUD Completo ---

  async function handleSubmeterNovoDocumento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setSalvandoNovoDoc(true);
    const res = await adicionarDocumentoManual(formData);
    setSalvandoNovoDoc(false);

    if (!res.ok) {
      mostrarFeedback("Erro ao Adicionar", res.mensagem ?? "Falha no envio do documento.", "erro");
      return;
    }

    setModalAdicionarAberto(false);
    form.reset();
    mostrarFeedback(
      "Documento Adicionado",
      res.mensagem ?? "Documento cadastrado com sucesso no sistema.",
      "sucesso",
      res.urlAssinatura,
    );
    router.refresh();
  }

  async function handleSubmeterEdicaoDocumento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    setSalvandoEdicao(true);
    const res = await editarDocumento(formData);
    setSalvandoEdicao(false);

    if (!res.ok) {
      mostrarFeedback("Erro ao Atualizar", res.mensagem ?? "Falha na atualização.", "erro");
      return;
    }

    setDocParaEditar(null);
    form.reset();
    mostrarFeedback("Documento Atualizado", res.mensagem ?? "Documento atualizado com sucesso.", "sucesso");
    router.refresh();
  }

  async function handleConfirmarExclusao() {
    if (!docParaExcluir) return;

    setExcluindoDoc(true);
    setErroExcluir(null);

    const res = await excluirDocumento(docParaExcluir.id, motivoExclusao);
    setExcluindoDoc(false);

    if (!res.ok) {
      setErroExcluir(res.mensagem ?? "Não foi possível excluir o documento.");
      return;
    }

    setDocParaExcluir(null);
    setMotivoExclusao("");
    mostrarFeedback(
      "Documento Excluído",
      res.mensagem ?? "Documento removido e arquivado em auditoria.",
      "sucesso",
    );
    router.refresh();
  }

  function copiarLinkAssinatura(url: string) {
    navigator.clipboard.writeText(url);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Cabeçalho com Botão de Adicionar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Mesa de Conferência & Triagem
          </span>
          <h1 className="text-h1 font-semibold text-ink">Conferência de Documentos</h1>
          <p className="mt-1 text-small text-ink-muted">
            Inspeção de qualidade técnica, dados informados pelo colaborador, integridade SHA-256 e emissão contratual.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-ink-muted">Storage:</span>
            <Badge status="aprovado" rotuloPersonalizado="Buckets Privados (15 min)" />
          </div>
          <Selo
            voz="selo"
            type="button"
            onClick={() => setModalAdicionarAberto(true)}
            className="text-xs py-2 shadow-sm"
          >
            + Adicionar Documento
          </Selo>
        </div>
      </div>

      {feedback && (
        <Alerta
          tom={
            feedback.tipo === "sucesso"
              ? "sucesso"
              : feedback.tipo === "erro"
                ? "critico"
                : "informativo"
          }
          titulo={feedback.titulo}
        >
          <div className="space-y-3">
            <p className="text-small leading-relaxed">{feedback.mensagem}</p>
            {feedback.urlAssinatura && (
              <div className="pt-2 border-t border-line/40 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-medium text-ink whitespace-nowrap">
                  Link de Assinatura:
                </span>
                <input
                  type="text"
                  readOnly
                  value={feedback.urlAssinatura}
                  className="font-mono text-xs bg-surface border border-line px-2.5 py-1.5 flex-1 select-all text-ink focus:outline-none rounded"
                />
                <button
                  type="button"
                  onClick={() => copiarLinkAssinatura(feedback.urlAssinatura!)}
                  className="px-3 py-1.5 text-xs bg-seal text-paper hover:opacity-90 font-medium cursor-pointer transition-opacity whitespace-nowrap rounded"
                >
                  {linkCopiado ? "Link Copiado! ✓" : "Copiar Link"}
                </button>
              </div>
            )}
          </div>
        </Alerta>
      )}

      {/* Abas com Contadores */}
      <div className="flex flex-wrap border-b border-line gap-2 sm:gap-6">
        {(
          [
            { id: "todos", label: "Todos os Documentos", count: contadores.todos },
            { id: "pendente", label: "Pendente", count: contadores.pendente },
            { id: "aprovado", label: "Aprovado", count: contadores.aprovado },
            { id: "rejeitado", label: "Rejeitado", count: contadores.rejeitado },
          ] as const
        ).map((aba) => (
          <button
            key={aba.id}
            type="button"
            onClick={() => setFiltroStatus(aba.id)}
            className={`pb-3 text-small font-medium border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
              filtroStatus === aba.id
                ? "border-seal text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <span>{aba.label}</span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                filtroStatus === aba.id
                  ? "bg-seal/15 text-seal font-semibold"
                  : "bg-surface-sunken text-ink-muted border border-line"
              }`}
            >
              {aba.count}
            </span>
          </button>
        ))}
      </div>

      {/* Barra de Filtros Rápidos (Busca por Colaborador e Tipo) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-surface p-3 border border-line rounded-md">
        <div className="relative flex-1">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome do colaborador, CPF ou nome do arquivo…"
            className="w-full text-small border border-line bg-surface-sunken/40 px-3 py-2 text-ink placeholder:text-ink-muted/70 focus:outline-none focus:border-primary rounded"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>

        <div className="sm:w-64">
          <select
            value={filtroTipo}
            onChange={(e) =>
              setFiltroTipo(
                e.target.value as "todos" | "documento_identidade" | "comprovante_endereco",
              )
            }
            className="w-full text-small border border-line bg-surface-sunken/40 px-3 py-2 text-ink focus:outline-none focus:border-primary rounded cursor-pointer"
          >
            <option value="todos">Todos os Tipos de Documento</option>
            <option value="documento_identidade">Documento de Identidade (RG/CNH)</option>
            <option value="comprovante_endereco">Comprovante de Residência</option>
          </select>
        </div>
      </div>

      {/* Barra de Esclarecimento e Seletor de Modo de Visualização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface-sunken/60 border border-line rounded-lg text-xs text-ink-muted">
        <div className="flex items-start sm:items-center gap-2">
          <span className="text-base shrink-0">💡</span>
          <span>
            Cada colaborador preenche o formulário <strong>1 única vez</strong> e anexa até <strong>2 documentos</strong> (Identidade e Comprovante de Residência). Gerencie cadastros no{" "}
            <Link href="/pessoas" className="font-semibold text-ink underline hover:text-primary">
              Quadro de Pessoas
            </Link>
            .
          </span>
        </div>

        <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-line shrink-0">
          <button
            type="button"
            onClick={() => setModoVisualizacao("colaborador")}
            className={`px-3 py-1 text-xs font-semibold rounded transition cursor-pointer ${
              modoVisualizacao === "colaborador"
                ? "bg-primary-tint text-primary border border-primary/20"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            👥 Por Colaborador ({gruposPorColaborador.length})
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("tabela")}
            className={`px-3 py-1 text-xs font-semibold rounded transition cursor-pointer ${
              modoVisualizacao === "tabela"
                ? "bg-primary-tint text-primary border border-primary/20"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            📄 Lista de Documentos ({docsFiltrados.length})
          </button>
        </div>
      </div>

      {docsFiltrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum documento encontrado"
          descricao="Não há documentos correspondentes aos filtros e termo de busca informados."
        />
      ) : modoVisualizacao === "colaborador" ? (
        /* =====================================================================
           VISUALIZAÇÃO 1: AGRUPADO POR COLABORADOR (CARD POR CADASTRO)
           ===================================================================== */
        <div className="space-y-4">
          {gruposPorColaborador.map((grupo) => {
            const docsPendentes = grupo.documentos.filter((d) => d.status === "pendente");
            const docsAprovados = grupo.documentos.filter((d) => d.status === "aprovado");
            const docsRejeitados = grupo.documentos.filter((d) => d.status === "rejeitado");
            const todosAprovados =
              grupo.documentos.length > 0 && docsAprovados.length === grupo.documentos.length;
            const ocupadoGrupo = processando === grupo.pessoaId;

            return (
              <div
                key={grupo.pessoaId}
                className="rounded-xl border border-line bg-surface p-5 space-y-4 shadow-sm"
              >
                {/* Cabeçalho do Colaborador */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary font-bold text-sm">
                      {grupo.pessoaNome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink text-base">{grupo.pessoaNome}</h3>
                        <span className="text-xs font-mono text-ink-muted bg-surface-sunken px-2 py-0.5 rounded border border-line">
                          CPF: {grupo.pessoaCpf}
                        </span>
                        <span className="text-[0.68rem] text-primary bg-primary-tint px-2 py-0.5 rounded-full border border-primary/20 font-medium">
                          1 Cadastro Único
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {grupo.documentos.length} documento(s) anexado(s) neste cadastro
                      </p>
                    </div>
                  </div>

                  {/* Status e Ação em Lote */}
                  <div className="flex items-center gap-2">
                    {todosAprovados ? (
                      <span className="text-xs font-semibold text-success bg-success/10 px-3 py-1 rounded-full border border-success/20 flex items-center gap-1.5">
                        <span>✓</span> Documentação Aprovada (Apto)
                      </span>
                    ) : docsPendentes.length > 0 ? (
                      <button
                        type="button"
                        disabled={ocupadoGrupo}
                        onClick={() => handleAprovarTodosDoColaborador(grupo.documentos)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>⚡</span>
                        <span>
                          {ocupadoGrupo
                            ? "Aprovando…"
                            : `Aprovar Todos (${docsPendentes.length})`}
                        </span>
                      </button>
                    ) : docsRejeitados.length > 0 ? (
                      <span className="text-xs font-semibold text-danger bg-danger/10 px-3 py-1 rounded-full border border-danger/20">
                        Documento Rejeitado
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Grid dos Documentos deste Colaborador */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {grupo.documentos.map((doc) => {
                    const baixaResolucao =
                      doc.larguraPx !== null &&
                      doc.alturaPx !== null &&
                      (doc.larguraPx < 800 || doc.alturaPx < 800);
                    const ocupado = processando === doc.id;

                    return (
                      <div
                        key={doc.id}
                        className="rounded-lg border border-line bg-surface-sunken/40 p-4 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-ink block">
                                {ROTULO_TIPO[doc.tipo] ?? doc.tipo}
                              </span>
                              <span className="text-[0.7rem] font-mono text-ink-muted">
                                Versão {doc.versao} · {formatarDataBR(doc.criadoEm)}
                              </span>
                            </div>
                            <Badge status={doc.status as StatusTipo} />
                          </div>

                          {/* Metadados Técnicos */}
                          <div className="text-[0.75rem] font-mono text-ink-muted bg-surface p-2.5 rounded border border-line space-y-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={baixaResolucao ? "text-alert font-bold" : "text-ink"}
                              >
                                📐 {doc.larguraPx ?? "—"} × {doc.alturaPx ?? "—"} px
                              </span>
                              <span>
                                {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB` : "—"}
                              </span>
                            </div>
                            <div className="truncate text-ink-subtle" title={doc.hashSha256}>
                              Hash: {doc.hashSha256.slice(0, 16)}…
                            </div>
                          </div>

                          {doc.motivoRejeicao && (
                            <p className="text-xs text-alert bg-alert/10 p-2 rounded border border-alert/20">
                              <strong>Motivo:</strong> {doc.motivoRejeicao}
                            </p>
                          )}
                        </div>

                        {/* Ações do Documento */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/60">
                          <button
                            type="button"
                            onClick={() => {
                              setDocSelecionado(doc);
                              setModalConferenciaAberto(true);
                            }}
                            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>🔍</span>
                            <span>Visualizar</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {doc.status !== "aprovado" && (
                              <button
                                type="button"
                                disabled={ocupado || ocupadoGrupo}
                                onClick={() => handleAprovar(doc)}
                                className="px-2.5 py-1 text-xs font-semibold bg-success/15 text-success hover:bg-success hover:text-white rounded transition disabled:opacity-50 cursor-pointer"
                              >
                                Aprovar
                              </button>
                            )}

                            {doc.status !== "rejeitado" && (
                              <button
                                type="button"
                                disabled={ocupado || ocupadoGrupo}
                                onClick={() => abrirModalRejeicao(doc)}
                                className="px-2.5 py-1 text-xs font-semibold bg-danger/15 text-danger hover:bg-danger hover:text-white rounded transition disabled:opacity-50 cursor-pointer"
                              >
                                Rejeitar
                              </button>
                            )}

                            {doc.status !== "pendente" && (
                              <button
                                type="button"
                                disabled={ocupado || ocupadoGrupo}
                                onClick={() => handleMarcarPendente(doc)}
                                className="px-2.5 py-1 text-xs text-ink-muted hover:text-ink rounded border border-line transition cursor-pointer"
                              >
                                Reabrir
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDocParaEditar(doc)}
                              className="px-2 py-1 text-xs text-ink-muted hover:text-ink cursor-pointer"
                              title="Editar metadados"
                            >
                              ✎
                            </button>

                            <button
                              type="button"
                              disabled={ocupado || ocupadoGrupo}
                              onClick={() => {
                                setDocParaExcluir(doc);
                                setErroExcluir(null);
                                setMotivoExclusao("");
                              }}
                              className="px-2 py-1 text-xs text-danger/80 hover:text-danger cursor-pointer"
                              title="Excluir documento"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* =====================================================================
           VISUALIZAÇÃO 2: TABELA DE DOCUMENTOS INDIVIDUAIS
           ===================================================================== */
        <div className="overflow-x-auto border border-line bg-surface rounded-md shadow-xs">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-paper/60 font-mono text-xs text-ink-muted">
                <th className="p-3.5">Documento &amp; Colaborador</th>
                <th className="p-3.5">Metadados Técnicos</th>
                <th className="p-3.5">Nome no Storage</th>
                <th className="p-3.5 text-center">Situação</th>
                <th className="p-3.5 text-right">Ações &amp; Conferência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {docsFiltrados.map((doc) => {
                const baixaResolucao =
                  doc.larguraPx !== null &&
                  doc.alturaPx !== null &&
                  (doc.larguraPx < 800 || doc.alturaPx < 800);
                const ocupado = processando === doc.id;

                return (
                  <tr key={doc.id} className="hover:bg-paper/40 transition-colors">
                    {/* Documento & Colaborador */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink text-sm block">
                          {ROTULO_TIPO[doc.tipo] ?? doc.tipo}
                        </span>
                        <span className="text-[0.65rem] font-mono font-semibold uppercase bg-primary-tint text-primary px-1.5 py-0.5 rounded border border-primary/20">
                          v{doc.versao}
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                        <span>Colaborador:</span>
                        <strong className="text-ink font-medium">{doc.pessoaNome}</strong>
                        <span className="text-ink-subtle">•</span>
                        <span className="font-mono text-[0.7rem]">{doc.pessoaCpf}</span>
                      </div>
                    </td>

                    {/* Metadados Técnicos */}
                    <td className="p-3.5 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className={baixaResolucao ? "text-alert font-bold" : "text-ink"}>
                          {doc.larguraPx ?? "—"} × {doc.alturaPx ?? "—"} px
                        </span>
                        {baixaResolucao && (
                          <span className="text-[0.65rem] bg-alert/10 text-alert px-1 font-bold rounded">
                            BAIXA RESOLUÇÃO
                          </span>
                        )}
                      </div>
                      <span className="text-ink-muted text-[0.7rem] block">
                        {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB · ` : ""}
                        Hash: {doc.hashSha256.slice(0, 10)}...
                      </span>
                    </td>

                    {/* Storage */}
                    <td className="p-3.5 font-mono text-xs text-ink-muted">
                      <span
                        className="block text-ink truncate max-w-[200px]"
                        title={doc.caminhoStorage}
                      >
                        {doc.caminhoStorage}
                      </span>
                      <span className="text-[0.7rem] text-ink-muted/80 block truncate max-w-[200px]">
                        Original: {doc.nomeOriginal}
                      </span>
                    </td>

                    {/* Situação */}
                    <td className="p-3.5 text-center">
                      <Badge status={doc.status as StatusTipo} />
                      {doc.motivoRejeicao && (
                        <span
                          className="block text-[0.7rem] text-alert mt-1 max-w-[180px] truncate mx-auto"
                          title={doc.motivoRejeicao}
                        >
                          {doc.motivoRejeicao}
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Ação 1: Aprovar (quando pendente ou rejeitado) */}
                        {doc.status !== "aprovado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleAprovar(doc)}
                            className="px-2.5 py-1 text-xs border border-success text-success hover:bg-success/10 cursor-pointer font-medium disabled:opacity-50 transition-colors rounded"
                            title="Aprovar documento e emitir contrato"
                          >
                            {ocupado ? "Processando…" : "Aprovar"}
                          </button>
                        )}

                        {/* Ação 2: Reabrir / Marcar Pendente (quando aprovado ou rejeitado) */}
                        {doc.status !== "pendente" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleMarcarPendente(doc)}
                            className="px-2.5 py-1 text-xs border border-line hover:border-ink/60 text-ink-muted hover:text-ink cursor-pointer font-medium disabled:opacity-50 transition-colors rounded"
                            title="Voltar status para pendente para nova conferência"
                          >
                            Pendente
                          </button>
                        )}

                        {/* Ação 3: Rejeitar (quando pendente ou aprovado) */}
                        {doc.status !== "rejeitado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => abrirModalRejeicao(doc)}
                            className="px-2.5 py-1 text-xs border border-alert text-alert hover:bg-alert/10 cursor-pointer font-medium disabled:opacity-50 transition-colors rounded"
                            title="Reprovar documento com motivo"
                          >
                            Rejeitar
                          </button>
                        )}

                        {/* Ação 4: Abrir / Detalhes */}
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => {
                            setDocSelecionado(doc);
                            setModalConferenciaAberto(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-paper border border-line text-ink hover:border-seal font-medium cursor-pointer disabled:opacity-50 transition-colors shadow-xs rounded"
                          title="Inspecionar dados do colaborador e visualizar arquivo"
                        >
                          Abrir
                        </button>

                        {/* Ação 5: Editar */}
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => setDocParaEditar(doc)}
                          className="px-2 py-1 text-xs text-primary hover:underline font-medium cursor-pointer"
                          title="Editar tipo de documento, motivo ou substituir arquivo"
                        >
                          Editar
                        </button>

                        {/* Ação 6: Excluir */}
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => {
                            setDocParaExcluir(doc);
                            setErroExcluir(null);
                            setMotivoExclusao("");
                          }}
                          className="px-2 py-1 text-xs text-danger hover:underline font-medium cursor-pointer"
                          title="Excluir documento do painel e do Storage"
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
      )}

      {/* =====================================================================
          MODAL 1: CONFERÊNCIA COMPLETA DE DADOS DO COLABORADOR
          ===================================================================== */}
      {docSelecionado && (
        <Modal
          aberto={modalConferenciaAberto}
          aoFechar={() => setModalConferenciaAberto(false)}
          titulo="Conferência de Documento & Cadastro"
          descricao="Inspecione os dados completos informados pelo colaborador e verifique o arquivo comprobatório antes de aprovar a emissão do contrato."
          larguraMaxima="max-w-3xl"
          ocultarRodapePadrao={true}
        >
          <div className="space-y-6 text-small">
            {/* Bloco 1: Identificação & Contato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-line pb-4">
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-seal block font-semibold">
                  1. Identificação Pessoal
                </span>
                <div className="bg-surface/80 p-3 border border-line space-y-1.5 rounded">
                  <div>
                    <span className="text-xs text-ink-muted block">Nome Completo:</span>
                    <strong className="text-ink font-semibold">
                      {docSelecionado.colaborador.nomeCompleto}
                    </strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-xs text-ink-muted block">CPF:</span>
                      <span className="font-mono text-xs text-ink">
                        {docSelecionado.colaborador.cpf}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-ink-muted block">RG:</span>
                      <span className="font-mono text-xs text-ink">
                        {docSelecionado.colaborador.rg || "Não informado"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">Data de Nascimento:</span>
                    <span className="text-xs text-ink font-mono">
                      {formatarDataBR(docSelecionado.colaborador.dataNascimento)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-seal block font-semibold">
                  2. Contato & Comunicação
                </span>
                <div className="bg-surface/80 p-3 border border-line space-y-1.5 rounded">
                  <div>
                    <span className="text-xs text-ink-muted block">WhatsApp / Telefone:</span>
                    <span className="font-mono text-xs font-medium text-ink">
                      {docSelecionado.colaborador.telefone || "Não informado"}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">E-mail:</span>
                    <span className="text-xs text-ink">
                      {docSelecionado.colaborador.email || "Não informado"}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">Região / Atribuição:</span>
                    <span className="text-xs text-ink font-medium">
                      {docSelecionado.colaborador.regiaoNome || "Geral"} ·{" "}
                      {docSelecionado.colaborador.funcao || "Militância e Mobilização"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 2: Endereço & Pagamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-line pb-4">
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-seal block font-semibold">
                  3. Endereço Residencial
                </span>
                <div className="bg-surface/80 p-3 border border-line space-y-1 rounded">
                  <div>
                    <span className="text-xs text-ink-muted block">Logradouro:</span>
                    <span className="text-xs text-ink leading-relaxed">
                      {docSelecionado.colaborador.endereco || "Não informado"}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">CEP:</span>
                    <span className="font-mono text-xs text-ink">
                      {docSelecionado.colaborador.cep || "Não informado"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-seal block font-semibold">
                  4. Dados de Pagamento (PIX / Banco)
                </span>
                <div className="bg-surface/80 p-3 border border-line space-y-1.5 rounded">
                  <div>
                    <span className="text-xs text-ink-muted block">Chave PIX:</span>
                    {docSelecionado.colaborador.chavePix ? (
                      <span className="font-mono text-xs bg-paper border border-seal/40 px-2 py-0.5 text-ink inline-block mt-0.5">
                        {docSelecionado.colaborador.chavePix}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted italic">Não informada</span>
                    )}
                  </div>
                  {(docSelecionado.colaborador.banco || docSelecionado.colaborador.conta) && (
                    <div className="pt-1 text-xs text-ink-muted">
                      <span>Banco: {docSelecionado.colaborador.banco ?? "—"}</span> ·{" "}
                      <span>Agência: {docSelecionado.colaborador.agencia ?? "—"}</span> ·{" "}
                      <span>Conta: {docSelecionado.colaborador.conta ?? "—"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bloco 3: Inspeção do Arquivo & Botão Visualizar */}
            <div className="space-y-3 bg-paper p-4 border border-line rounded">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-seal block font-semibold">
                    5. Documento Comprobatório Enviado
                  </span>
                  <div className="text-xs text-ink mt-0.5">
                    <strong>{ROTULO_TIPO[docSelecionado.tipo] ?? docSelecionado.tipo}</strong> (v
                    {docSelecionado.versao}) · Arquivo:{" "}
                    <span className="font-mono text-ink-muted">{docSelecionado.nomeOriginal}</span>
                  </div>
                  <div className="text-[0.7rem] text-ink-muted font-mono mt-0.5">
                    {docSelecionado.bytes ? `${(docSelecionado.bytes / 1024).toFixed(0)} KB · ` : ""}
                    Dimensões: {docSelecionado.larguraPx ?? "—"} × {docSelecionado.alturaPx ?? "—"} px ·
                    Hash: {docSelecionado.hashSha256.slice(0, 16)}...
                  </div>
                </div>

                <button
                  type="button"
                  disabled={carregandoDocUrl}
                  onClick={() => handleVisualizarDocumento(docSelecionado.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border-2 border-seal text-ink hover:bg-seal/10 font-medium text-xs cursor-pointer transition-colors shadow-xs whitespace-nowrap disabled:opacity-50 rounded"
                >
                  <span>{carregandoDocUrl ? "Carregando…" : "📄 Visualizar Documento"}</span>
                  <span className="text-seal font-mono text-xs">↗</span>
                </button>
              </div>
            </div>

            {/* Ações de Decisão no Rodapé do Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-line">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => abrirModalRejeicao(docSelecionado)}
                  disabled={processando === docSelecionado.id}
                  className="w-full sm:w-auto px-4 py-2 text-xs border border-alert text-alert hover:bg-alert/10 cursor-pointer font-medium disabled:opacity-50 transition-colors rounded"
                >
                  Rejeitar Documento…
                </button>
                {docSelecionado.status !== "pendente" && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalConferenciaAberto(false);
                      handleMarcarPendente(docSelecionado);
                    }}
                    disabled={processando === docSelecionado.id}
                    className="w-full sm:w-auto px-3 py-2 text-xs border border-line text-ink-muted hover:text-ink cursor-pointer font-medium disabled:opacity-50 transition-colors rounded"
                  >
                    Marcar Pendente
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setModalConferenciaAberto(false)}
                  className="px-3.5 py-2 text-xs text-ink-muted hover:text-ink cursor-pointer transition-colors"
                >
                  Fechar
                </button>

                {docSelecionado.status !== "aprovado" && (
                  <button
                    type="button"
                    disabled={processando === docSelecionado.id}
                    onClick={() => handleAprovar(docSelecionado)}
                    className="w-full sm:w-auto px-5 py-2 text-xs bg-seal text-paper hover:opacity-90 font-semibold cursor-pointer disabled:opacity-50 transition-opacity shadow-sm flex items-center justify-center gap-2 rounded"
                  >
                    {processando === docSelecionado.id ? (
                      <>
                        <span className="animate-spin">⟳</span>
                        <span>Aprovando e Emitindo Contrato…</span>
                      </>
                    ) : (
                      <span>✓ Aprovar e Emitir Contrato</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* =====================================================================
          MODAL 2: ADICIONAR DOCUMENTO MANUAL (UPLOAD PELO GESTOR)
          ===================================================================== */}
      <Modal
        aberto={modalAdicionarAberto}
        aoFechar={() => setModalAdicionarAberto(false)}
        titulo="Adicionar Novo Documento"
        descricao="Faça o upload de documentos comprobatórios diretamente para qualquer colaborador cadastrado."
        larguraMaxima="max-w-lg"
        ocultarRodapePadrao
      >
        <form ref={formAdicionarRef} onSubmit={handleSubmeterNovoDocumento} className="space-y-4">
          {/* Seletor de Colaborador */}
          <div>
            <label htmlFor="novo-doc-pessoa" className="block text-small font-medium text-ink mb-1">
              Colaborador *
            </label>
            <select
              id="novo-doc-pessoa"
              name="pessoaId"
              required
              className="w-full border border-line bg-surface p-2.5 text-small text-ink rounded focus:border-primary focus:outline-none"
            >
              <option value="">Selecione o colaborador…</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeCompleto} ({c.cpf})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Documento */}
          <div>
            <label htmlFor="novo-doc-tipo" className="block text-small font-medium text-ink mb-1">
              Tipo do Documento *
            </label>
            <select
              id="novo-doc-tipo"
              name="tipo"
              required
              className="w-full border border-line bg-surface p-2.5 text-small text-ink rounded focus:border-primary focus:outline-none"
            >
              <option value="documento_identidade">Documento de Identidade (RG/CNH)</option>
              <option value="comprovante_endereco">Comprovante de Residência</option>
            </select>
          </div>

          {/* Situação Inicial */}
          <div>
            <label htmlFor="novo-doc-status" className="block text-small font-medium text-ink mb-1">
              Situação Inicial *
            </label>
            <select
              id="novo-doc-status"
              name="statusInicial"
              className="w-full border border-line bg-surface p-2.5 text-small text-ink rounded focus:border-primary focus:outline-none"
            >
              <option value="pendente">Pendente (conferir na mesa depois)</option>
              <option value="aprovado">Aprovado (já liberar emissão de contrato)</option>
            </select>
          </div>

          {/* Arquivo */}
          <div>
            <label htmlFor="novo-doc-arquivo" className="block text-small font-medium text-ink mb-1">
              Arquivo Comprobatório (JPG, PNG ou PDF até 20MB) *
            </label>
            <input
              id="novo-doc-arquivo"
              name="arquivo"
              type="file"
              required
              accept="image/jpeg,image/png,application/pdf"
              className="w-full border border-line bg-surface p-2 text-small text-ink rounded file:mr-3 file:py-1 file:px-3 file:border-0 file:text-xs file:font-semibold file:bg-seal file:text-paper file:rounded hover:file:opacity-90 cursor-pointer"
            />
            <span className="text-[11px] text-ink-muted block mt-1">
              Para imagens, recomenda-se resolução nítida de pelo menos 800px no lado menor.
            </span>
          </div>

          <div className="pt-4 border-t border-line flex justify-end gap-2">
            <Selo
              voz="linha"
              type="button"
              onClick={() => setModalAdicionarAberto(false)}
              disabled={salvandoNovoDoc}
              className="text-xs"
            >
              Cancelar
            </Selo>
            <Selo
              voz="selo"
              type="submit"
              carregando={salvandoNovoDoc}
              textoCarregando="Enviando…"
              className="text-xs"
            >
              Adicionar Documento
            </Selo>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL 3: EDITAR DOCUMENTO (TIPO, MOTIVO, SUBSTITUIR ARQUIVO)
          ===================================================================== */}
      <Modal
        aberto={Boolean(docParaEditar)}
        aoFechar={() => setDocParaEditar(null)}
        titulo={`Editar Documento: ${docParaEditar?.pessoaNome ?? ""}`}
        descricao="Ajuste a classificação do documento ou anexe uma nova versão do arquivo."
        larguraMaxima="max-w-lg"
        ocultarRodapePadrao
      >
        {docParaEditar && (
          <form ref={formEditarRef} onSubmit={handleSubmeterEdicaoDocumento} className="space-y-4">
            <input type="hidden" name="id" value={docParaEditar.id} />

            <div>
              <label htmlFor="editar-doc-tipo" className="block text-small font-medium text-ink mb-1">
                Classificação / Tipo do Documento
              </label>
              <select
                id="editar-doc-tipo"
                name="tipo"
                defaultValue={docParaEditar.tipo}
                className="w-full border border-line bg-surface p-2.5 text-small text-ink rounded focus:border-primary focus:outline-none"
              >
                <option value="documento_identidade">Documento de Identidade (RG/CNH)</option>
                <option value="comprovante_endereco">Comprovante de Residência</option>
              </select>
              <span className="text-[11px] text-ink-muted block mt-1">
                Útil quando o colaborador enviou o comprovante no campo do RG por engano.
              </span>
            </div>

            {docParaEditar.status === "rejeitado" && (
              <div>
                <label htmlFor="editar-doc-motivo" className="block text-small font-medium text-ink mb-1">
                  Motivo da Rejeição
                </label>
                <textarea
                  id="editar-doc-motivo"
                  name="motivoRejeicao"
                  rows={3}
                  defaultValue={docParaEditar.motivoRejeicao ?? ""}
                  placeholder="Explique o motivo para o colaborador…"
                  className="w-full border border-line bg-surface p-2.5 text-small text-ink rounded focus:border-primary focus:outline-none resize-none"
                />
              </div>
            )}

            <div className="pt-2 border-t border-line">
              <label htmlFor="editar-doc-substituto" className="block text-small font-medium text-ink mb-1">
                Substituir Arquivo Atual (Opcional)
              </label>
              <input
                id="editar-doc-substituto"
                name="arquivo"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="w-full border border-line bg-surface p-2 text-small text-ink rounded file:mr-3 file:py-1 file:px-3 file:border-0 file:text-xs file:font-semibold file:bg-seal file:text-paper file:rounded hover:file:opacity-90 cursor-pointer"
              />
              <span className="text-[11px] text-ink-muted block mt-1">
                Arquivo atual: {docParaEditar.nomeOriginal} (v{docParaEditar.versao}). O envio incrementará a versão.
              </span>
            </div>

            <div className="pt-4 border-t border-line flex justify-end gap-2">
              <Selo
                voz="linha"
                type="button"
                onClick={() => setDocParaEditar(null)}
                disabled={salvandoEdicao}
                className="text-xs"
              >
                Cancelar
              </Selo>
              <Selo
                voz="selo"
                type="submit"
                carregando={salvandoEdicao}
                textoCarregando="Salvando…"
                className="text-xs"
              >
                Salvar Alterações
              </Selo>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 4: EXCLUIR DOCUMENTO (AUDITORIA EM DADOS EXCLUIDOS)
          ===================================================================== */}
      <Modal
        aberto={Boolean(docParaExcluir)}
        aoFechar={() => setDocParaExcluir(null)}
        titulo={`Excluir Documento de ${docParaExcluir?.pessoaNome ?? ""}`}
        larguraMaxima="max-w-md"
        ocultarRodapePadrao
      >
        {docParaExcluir && (
          <div className="space-y-4">
            <p className="text-small text-ink-muted leading-relaxed">
              Tem certeza que deseja excluir este documento (
              <strong>{ROTULO_TIPO[docParaExcluir.tipo] ?? docParaExcluir.tipo}</strong>)?
              O arquivo será removido do Storage e um snapshot de integridade será arquivado em Dados Excluídos.
            </p>

            {docParaExcluir.status === "aprovado" && (
              <Alerta tom="atencao">
                Este documento está <strong>Aprovado</strong>. Ao excluí-lo, a aptidão cadastral do colaborador será
                automaticamente reavaliada e revogada se não houver outro documento válido.
              </Alerta>
            )}

            <Campo
              id="motivo-exclusao-doc"
              rotulo="Motivo da exclusão (para auditoria)"
              value={motivoExclusao}
              onChange={(e) => setMotivoExclusao(e.target.value)}
              placeholder="Ex.: Documento duplicado ou ilegível a pedido do gestor"
            />

            {erroExcluir && <Alerta tom="critico">{erroExcluir}</Alerta>}

            <div className="pt-3 border-t border-line flex justify-end gap-2">
              <Selo
                voz="linha"
                onClick={() => setDocParaExcluir(null)}
                disabled={excluindoDoc}
                className="text-xs"
              >
                Cancelar
              </Selo>
              <Selo
                voz="perigo"
                onClick={handleConfirmarExclusao}
                carregando={excluindoDoc}
                textoCarregando="Excluindo…"
                className="text-xs"
              >
                Confirmar Exclusão
              </Selo>
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 5: MOTIVO DE REJEIÇÃO DO DOCUMENTO
          ===================================================================== */}
      <Modal
        aberto={modalRejeicaoAberto}
        aoFechar={() => setModalRejeicaoAberto(false)}
        titulo="Reprovar Documento na Conferência"
        descricao="Descreva claramente o motivo da rejeição. Um novo link de coleta com essa explicação será enviado por e-mail para o contratado reenviar."
        rotuloPrimario="Confirmar Reprovação"
        vozPrimaria="perigo"
        acaoPrimaria={handleConfirmarRejeicao}
        desabilitarConfirmacao={!motivoRejeicao.trim() || processando === docSelecionado?.id}
      >
        <div className="space-y-4 text-small">
          <div>
            <label className="block text-small font-medium text-ink mb-1.5">
              Motivo da Rejeição (Linguagem Simples)
            </label>
            <textarea
              rows={4}
              value={motivoRejeicao}
              onChange={(e) => handleTextareaChange(e.target.value)}
              className="w-full border border-line bg-surface/40 p-2.5 text-small text-ink outline-none focus:border-seal focus:ring-1 focus:ring-seal leading-relaxed rounded"
              placeholder="Ex: A foto ficou cortada e não é possível ler o número do RG e do CPF."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">
                Motivos recorrentes (marque um ou vários):
              </span>
              {motivosSelecionados.length > 0 && (
                <span className="text-[0.7rem] font-mono text-seal font-semibold">
                  {motivosSelecionados.length} selecionado{motivosSelecionados.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_RECORRENTES.map((m) => {
                const selecionado = motivosSelecionados.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleToggleMotivo(m)}
                    aria-pressed={selecionado}
                    className={`px-2.5 py-1.5 rounded border text-xs text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                      selecionado
                        ? "border-seal bg-seal/20 text-ink font-semibold ring-1 ring-seal"
                        : "border-line bg-surface/60 text-ink-muted hover:border-ink/30 hover:text-ink"
                    }`}
                  >
                    <span
                      className={`font-mono font-bold ${selecionado ? "text-seal" : "text-ink-muted"}`}
                    >
                      {selecionado ? "✓" : "+"}
                    </span>
                    <span>{m}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
