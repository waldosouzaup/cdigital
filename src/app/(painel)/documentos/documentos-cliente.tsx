"use client";

import { useMemo, useRef, useState } from "react";
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
import type { ColaboradorDocumento, ColaboradorOpcao, DocumentoListado } from "./dados";

export interface ColaboradorAgrupado {
  pessoaId: string;
  pessoaNome: string;
  pessoaCpf: string;
  colaborador: ColaboradorDocumento;
  documentos: DocumentoListado[];
  statusGeral: "pendente" | "aprovado" | "rejeitado";
  criadoEm: string;
}

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

  const [processando, setProcessando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tipo: "sucesso" | "erro" | "info";
    titulo: string;
    mensagem: string;
    urlAssinatura?: string;
  } | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Modais de Controle
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<ColaboradorAgrupado | null>(null);
  const [docSelecionado, setDocSelecionado] = useState<DocumentoListado | null>(null);
  const [modalConferenciaAberto, setModalConferenciaAberto] = useState(false);
  const [carregandoDocId, setCarregandoDocId] = useState<string | null>(null);

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

  // Agrupamento por colaborador (1 único registro por usuário com seus documentos anexados)
  const colaboradoresAgrupados = useMemo(() => {
    const mapa = new Map<string, ColaboradorAgrupado>();

    for (const doc of documentosIniciais) {
      const existente = mapa.get(doc.pessoaId);
      if (existente) {
        existente.documentos.push(doc);
      } else {
        mapa.set(doc.pessoaId, {
          pessoaId: doc.pessoaId,
          pessoaNome: doc.pessoaNome,
          pessoaCpf: doc.pessoaCpf,
          colaborador: doc.colaborador,
          documentos: [doc],
          statusGeral: "pendente",
          criadoEm: doc.criadoEm,
        });
      }
    }

    return Array.from(mapa.values()).map((c) => {
      // Ordena para que Identidade apareça primeiro, seguido por Residência
      c.documentos.sort((a, b) => {
        if (a.tipo === "documento_identidade") return -1;
        if (b.tipo === "documento_identidade") return 1;
        return 0;
      });

      const temRejeitado = c.documentos.some((d) => d.status === "rejeitado");
      const temPendente = c.documentos.some((d) => d.status === "pendente");
      const todosAprovados =
        c.documentos.length > 0 && c.documentos.every((d) => d.status === "aprovado");

      c.statusGeral = temRejeitado
        ? "rejeitado"
        : temPendente
          ? "pendente"
          : todosAprovados
            ? "aprovado"
            : "pendente";

      return c;
    });
  }, [documentosIniciais]);

  // Contadores por status de cadastro
  const contadores = useMemo(() => {
    return {
      todos: colaboradoresAgrupados.length,
      pendente: colaboradoresAgrupados.filter((c) => c.statusGeral === "pendente").length,
      aprovado: colaboradoresAgrupados.filter((c) => c.statusGeral === "aprovado").length,
      rejeitado: colaboradoresAgrupados.filter((c) => c.statusGeral === "rejeitado").length,
    };
  }, [colaboradoresAgrupados]);

  // Lista filtrada (1 linha por colaborador)
  const colaboradoresFiltrados = useMemo(() => {
    return colaboradoresAgrupados.filter((c) => {
      if (filtroStatus !== "todos" && c.statusGeral !== filtroStatus) return false;
      if (filtroTipo !== "todos") {
        const temTipo = c.documentos.some((d) => d.tipo === filtroTipo);
        if (!temTipo) return false;
      }
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const nomeMatch = c.pessoaNome.toLowerCase().includes(termo);
        const cpfMatch = c.pessoaCpf.replace(/\D/g, "").includes(termo.replace(/\D/g, ""));
        const arqMatch = c.documentos.some((d) => d.nomeOriginal.toLowerCase().includes(termo));
        if (!nomeMatch && !cpfMatch && !arqMatch) return false;
      }
      return true;
    });
  }, [colaboradoresAgrupados, filtroStatus, filtroTipo, busca]);

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

    if (resultado.pessoaFicouApta) {
      mostrarFeedback(
        "Documentação Aprovada & Contrato Emitido",
        resultado.mensagem ??
          `Todos os documentos de ${doc.pessoaNome} foram conferidos e aprovados. O contrato foi gerado e enviado para assinatura.`,
        "sucesso",
        resultado.urlAssinatura,
      );
    } else {
      mostrarFeedback(
        "Documento Aprovado",
        resultado.mensagem ??
          `Documento aprovado com sucesso. O contrato NÃO foi gerado pois aguarda a aprovação de ambos os documentos obrigatórios (Identidade e Comprovante de Residência).`,
        "info",
      );
    }
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

  function abrirModalColaborador(c: ColaboradorAgrupado) {
    setColaboradorSelecionado(c);
    setModalConferenciaAberto(true);
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
    setCarregandoDocId(docId);
    const resultado = await gerarUrlDocumento(docId);
    setCarregandoDocId(null);

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
            { id: "todos", label: "Todos os Cadastros", count: contadores.todos },
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

      {/* Barra de Informação Consolidada */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface-sunken/60 border border-line rounded-lg text-xs text-ink-muted">
        <div className="flex items-start sm:items-center gap-2">
          <span className="text-base shrink-0">💡</span>
          <span>
            Cada linha representa <strong>1 único cadastro</strong>. Clique em <strong>Abrir</strong> para inspecionar os dados e conferir os 2 documentos comprobatórios (Identidade e Residência).
          </span>
        </div>
        <div className="text-[0.7rem] font-mono text-ink-subtle shrink-0">
          {colaboradoresFiltrados.length} cadastro(s) listado(s)
        </div>
      </div>

      {colaboradoresFiltrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum cadastro encontrado"
          descricao="Não há colaboradores correspondentes aos filtros e termo de busca informados."
        />
      ) : (
        /* =====================================================================
           TABELA COM APENAS 1 REGISTRO POR USUÁRIO
           ===================================================================== */
        <div className="overflow-x-auto border border-line bg-surface rounded-md shadow-xs">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-paper/60 font-mono text-xs text-ink-muted">
                <th className="p-3.5">Colaborador / Cadastro</th>
                <th className="p-3.5">Documentos Enviados</th>
                <th className="p-3.5">Integridade &amp; Arquivos</th>
                <th className="p-3.5 text-center">Situação</th>
                <th className="p-3.5 text-right">Ações &amp; Conferência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {colaboradoresFiltrados.map((c) => {
                const ocupado = processando === c.pessoaId;
                const totalBytes = c.documentos.reduce((acc, d) => acc + (d.bytes ?? 0), 0);

                return (
                  <tr key={c.pessoaId} className="hover:bg-paper/40 transition-colors">
                    {/* Colaborador / Cadastro */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <strong className="font-semibold text-ink text-sm block">
                          {c.pessoaNome}
                        </strong>
                        {c.colaborador.origem === "autoinscricao" && (
                          <span
                            className="text-[0.65rem] bg-primary-tint border border-primary/20 text-primary px-1.5 py-0.5 rounded font-mono font-semibold"
                            title="Cadastrado via link de autoinscrição pública"
                          >
                            Autoinscrito
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5 font-mono">
                        <span>CPF: {c.pessoaCpf}</span>
                        <span className="text-ink-subtle">•</span>
                        <span className="font-sans">{c.colaborador.regiaoNome || "Geral"}</span>
                        {c.colaborador.funcao && (
                          <>
                            <span className="text-ink-subtle">•</span>
                            <span className="font-sans truncate max-w-[160px]" title={c.colaborador.funcao}>
                              {c.colaborador.funcao}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Documentos Enviados */}
                    <td className="p-3.5">
                      <div className="space-y-1.5">
                        {c.documentos.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 text-xs">
                            <span className="text-ink font-medium">
                              {doc.tipo === "documento_identidade" ? "🪪 Identidade (RG/CNH)" : "🏠 Residência"}:
                            </span>
                            <Badge status={doc.status as StatusTipo} />
                            <span className="text-[0.68rem] font-mono text-ink-muted">
                              {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB` : ""}
                            </span>
                          </div>
                        ))}
                        {c.documentos.length === 0 && (
                          <span className="text-xs text-ink-muted italic">Nenhum documento anexado</span>
                        )}
                      </div>
                    </td>

                    {/* Integridade & Arquivos */}
                    <td className="p-3.5 text-xs font-mono text-ink-muted">
                      <div className="space-y-0.5">
                        <span className="block text-ink font-medium">
                          {c.documentos.length} documento(s) recebido(s)
                        </span>
                        <span className="text-[0.7rem] block text-ink-subtle">
                          {totalBytes > 0 ? `${(totalBytes / 1024).toFixed(0)} KB total` : ""}
                        </span>
                        <span className="text-[0.68rem] text-success block">
                          ✓ SHA-256 Validado
                        </span>
                      </div>
                    </td>

                    {/* Situação */}
                    <td className="p-3.5 text-center">
                      <Badge status={c.statusGeral as StatusTipo} />
                      {c.statusGeral === "pendente" && (
                        <span className="text-[0.68rem] text-ink-muted block mt-1">
                          Aguardando conferência
                        </span>
                      )}
                    </td>

                    {/* Ações & Conferência */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Botão Abrir - Abre o modal com os dados cadastrais e OS 2 DOCUMENTOS */}
                        <button
                          type="button"
                          onClick={() => abrirModalColaborador(c)}
                          className="px-3.5 py-1.5 text-xs bg-paper border border-seal text-ink hover:bg-seal/10 font-bold cursor-pointer transition-colors shadow-xs rounded flex items-center gap-1.5"
                          title="Inspecionar dados do colaborador e conferir os 2 documentos no popup"
                        >
                          <span>🔍</span>
                          <span>Abrir</span>
                        </button>

                        {/* Botão Aprovar Tudo */}
                        {c.statusGeral !== "aprovado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleAprovarTodosDoColaborador(c.documentos)}
                            className="px-3 py-1.5 text-xs border border-success bg-success/10 text-success hover:bg-success hover:text-white cursor-pointer font-semibold disabled:opacity-50 transition-colors rounded"
                            title="Aprovar os documentos e emitir contrato"
                          >
                            {ocupado ? "Aprovando…" : "Aprovar"}
                          </button>
                        )}
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
          MODAL 1: CONFERÊNCIA COMPLETA DE DADOS DO COLABORADOR COM OS 2 DOCUMENTOS
          ===================================================================== */}
      {colaboradorSelecionado && (
        <Modal
          aberto={modalConferenciaAberto}
          aoFechar={() => setModalConferenciaAberto(false)}
          titulo="Conferência de Documento & Cadastro"
          descricao="Inspecione os dados completos informados pelo colaborador e verifique os arquivos comprobatórios antes de aprovar a emissão do contrato."
          larguraMaxima="max-w-4xl"
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
                      {colaboradorSelecionado.colaborador.nomeCompleto}
                    </strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-xs text-ink-muted block">CPF:</span>
                      <span className="font-mono text-xs text-ink">
                        {colaboradorSelecionado.colaborador.cpf}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-ink-muted block">RG:</span>
                      <span className="font-mono text-xs text-ink">
                        {colaboradorSelecionado.colaborador.rg || "Não informado"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">Data de Nascimento:</span>
                    <span className="text-xs text-ink font-mono">
                      {formatarDataBR(colaboradorSelecionado.colaborador.dataNascimento)}
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
                      {colaboradorSelecionado.colaborador.telefone || "Não informado"}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">E-mail:</span>
                    <span className="text-xs text-ink">
                      {colaboradorSelecionado.colaborador.email || "Não informado"}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">Região / Atribuição:</span>
                    <span className="text-xs text-ink font-medium">
                      {colaboradorSelecionado.colaborador.regiaoNome || "Geral"} ·{" "}
                      {colaboradorSelecionado.colaborador.funcao || "Militância e Mobilização"}
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
                      {colaboradorSelecionado.colaborador.endereco || "Não informado"}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-ink-muted block">CEP:</span>
                    <span className="font-mono text-xs text-ink">
                      {colaboradorSelecionado.colaborador.cep || "Não informado"}
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
                    {colaboradorSelecionado.colaborador.chavePix ? (
                      <span className="font-mono text-xs bg-paper border border-seal/40 px-2 py-0.5 text-ink inline-block mt-0.5">
                        {colaboradorSelecionado.colaborador.chavePix}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted italic">Não informada</span>
                    )}
                  </div>
                  {(colaboradorSelecionado.colaborador.banco || colaboradorSelecionado.colaborador.conta) && (
                    <div className="pt-1 text-xs text-ink-muted">
                      <span>Banco: {colaboradorSelecionado.colaborador.banco ?? "—"}</span> ·{" "}
                      <span>Agência: {colaboradorSelecionado.colaborador.agencia ?? "—"}</span> ·{" "}
                      <span>Conta: {colaboradorSelecionado.colaborador.conta ?? "—"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bloco 3: OS 2 DOCUMENTOS COMPROBATÓRIOS ENVIADOS */}
            <div className="space-y-3 bg-surface-sunken/40 p-4 border border-line rounded">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-seal block font-semibold">
                  5. Documentos Comprobatórios Enviados ({colaboradorSelecionado.documentos.length})
                </span>
                <span className="text-[0.7rem] font-mono text-ink-muted">
                  Conferência de Identidade e Residência
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {colaboradorSelecionado.documentos.map((doc, idx) => {
                  const baixaResolucao =
                    doc.larguraPx !== null &&
                    doc.alturaPx !== null &&
                    (doc.larguraPx < 800 || doc.alturaPx < 800);

                  return (
                    <div
                      key={doc.id}
                      className="bg-surface p-3.5 border border-line rounded flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[0.7rem] font-mono text-ink-muted uppercase">
                              Documento {idx + 1}
                            </span>
                            <strong className="text-xs font-bold text-ink block">
                              {ROTULO_TIPO[doc.tipo] ?? doc.tipo}
                            </strong>
                          </div>
                          <Badge status={doc.status as StatusTipo} />
                        </div>

                        <div className="text-xs text-ink-muted font-mono space-y-0.5 pt-1">
                          <div className="truncate text-ink" title={doc.nomeOriginal}>
                            Arquivo: {doc.nomeOriginal}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={baixaResolucao ? "text-alert font-bold" : "text-ink"}>
                              {doc.larguraPx ?? "—"} × {doc.alturaPx ?? "—"} px
                            </span>
                            <span>•</span>
                            <span>{doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB` : "—"}</span>
                          </div>
                          <div className="truncate text-ink-subtle text-[0.68rem]" title={doc.hashSha256}>
                            Hash: {doc.hashSha256.slice(0, 16)}…
                          </div>
                        </div>

                        {doc.motivoRejeicao && (
                          <p className="text-xs text-alert bg-alert/10 p-2 rounded border border-alert/20 mt-1">
                            <strong>Motivo:</strong> {doc.motivoRejeicao}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={carregandoDocId === doc.id}
                          onClick={() => handleVisualizarDocumento(doc.id)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-paper border border-seal text-ink hover:bg-seal/10 font-medium text-xs cursor-pointer transition-colors shadow-xs rounded disabled:opacity-50"
                        >
                          <span>{carregandoDocId === doc.id ? "Carregando…" : "📄 Visualizar Documento"}</span>
                          <span className="text-seal font-mono text-xs">↗</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {doc.status !== "aprovado" && (
                            <button
                              type="button"
                              disabled={processando === doc.id}
                              onClick={async () => {
                                await handleAprovar(doc);
                                doc.status = "aprovado";
                              }}
                              className="px-2 py-1 text-xs font-semibold bg-success/15 text-success hover:bg-success hover:text-white rounded transition cursor-pointer"
                              title="Aprovar este documento"
                            >
                              Aprovar
                            </button>
                          )}
                          {doc.status !== "rejeitado" && (
                            <button
                              type="button"
                              disabled={processando === doc.id}
                              onClick={() => abrirModalRejeicao(doc)}
                              className="px-2 py-1 text-xs font-semibold bg-danger/15 text-danger hover:bg-danger hover:text-white rounded transition cursor-pointer"
                              title="Rejeitar este documento"
                            >
                              Rejeitar
                            </button>
                          )}
                          {doc.status !== "pendente" && (
                            <button
                              type="button"
                              disabled={processando === doc.id}
                              onClick={async () => {
                                await handleMarcarPendente(doc);
                                doc.status = "pendente";
                              }}
                              className="px-2 py-1 text-xs font-semibold border border-line text-ink-muted hover:text-ink rounded transition cursor-pointer"
                              title="Reabrir / Marcar como pendente"
                            >
                              Pendente
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ações de Decisão no Rodapé do Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-line">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const docAlvo =
                      colaboradorSelecionado.documentos.find((d) => d.status === "pendente") ??
                      colaboradorSelecionado.documentos[0];
                    if (docAlvo) abrirModalRejeicao(docAlvo);
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-xs border border-alert text-alert hover:bg-alert/10 cursor-pointer font-medium transition-colors rounded"
                >
                  Rejeitar Documentação…
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setModalConferenciaAberto(false)}
                  className="px-3.5 py-2 text-xs text-ink-muted hover:text-ink cursor-pointer transition-colors"
                >
                  Fechar
                </button>

                {colaboradorSelecionado.statusGeral !== "aprovado" && (
                  <button
                    type="button"
                    disabled={processando === colaboradorSelecionado.pessoaId}
                    onClick={async () => {
                      await handleAprovarTodosDoColaborador(colaboradorSelecionado.documentos);
                      setModalConferenciaAberto(false);
                    }}
                    className="w-full sm:w-auto px-5 py-2 text-xs bg-seal text-paper hover:opacity-90 font-semibold cursor-pointer disabled:opacity-50 transition-opacity shadow-sm flex items-center justify-center gap-2 rounded"
                  >
                    {processando === colaboradorSelecionado.pessoaId ? (
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
