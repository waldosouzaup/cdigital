"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type StatusTipo } from "@/components/badge";
import { Modal } from "@/components/modal";
import { Alerta } from "@/components/alerta";
import { EstadoVazio } from "@/components/estado-vazio";
import { aprovarDocumentoEGerarContrato, gerarUrlDocumento, rejeitarDocumento } from "./acoes";
import type { DocumentoListado } from "./dados";

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
}: {
  documentosIniciais: DocumentoListado[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "aprovado" | "rejeitado">("todos");
  const [processando, setProcessando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tipo: "sucesso" | "erro" | "info";
    titulo: string;
    mensagem: string;
    urlAssinatura?: string;
  } | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Modais
  const [docSelecionado, setDocSelecionado] = useState<DocumentoListado | null>(null);
  const [modalConferenciaAberto, setModalConferenciaAberto] = useState(false);
  const [modalRejeicaoAberto, setModalRejeicaoAberto] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [motivosSelecionados, setMotivosSelecionados] = useState<string[]>([]);
  const [carregandoDocUrl, setCarregandoDocUrl] = useState(false);

  const docsFiltrados = documentosIniciais.filter((d) => filtro === "todos" || d.status === filtro);

  function mostrarFeedback(
    titulo: string,
    mensagem: string,
    tipo: "sucesso" | "erro" | "info" = "sucesso",
    urlAssinatura?: string,
  ) {
    setFeedback({ titulo, mensagem, tipo, urlAssinatura });
    // Mantém feedback com link visível por mais tempo
    const timeout = urlAssinatura ? 15000 : 6000;
    setTimeout(() => setFeedback(null), timeout);
  }

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

  function abrirModalConferencia(doc: DocumentoListado) {
    setDocSelecionado(doc);
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

  function copiarLinkAssinatura(url: string) {
    navigator.clipboard.writeText(url);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Mesa de Conferência & Triagem
          </span>
          <h1 className="text-h1 font-semibold text-ink">Conferência de Documentos</h1>
          <p className="mt-1 text-small text-ink-muted">
            Inspeção de qualidade técnica, dados informados pelo colaborador, integridade SHA-256 e
            emissão contratual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Storage:</span>
          <Badge status="aprovado" rotuloPersonalizado="Buckets Privados (15 min)" />
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
                  className="font-mono text-xs bg-surface border border-line px-2.5 py-1.5 flex-1 select-all text-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copiarLinkAssinatura(feedback.urlAssinatura!)}
                  className="px-3 py-1.5 text-xs bg-seal text-paper hover:opacity-90 font-medium cursor-pointer transition-opacity whitespace-nowrap"
                >
                  {linkCopiado ? "Link Copiado! ✓" : "Copiar Link"}
                </button>
              </div>
            )}
          </div>
        </Alerta>
      )}

      {/* Filtros por Situação */}
      <div className="flex border-b border-line gap-4 sm:gap-6">
        {(["todos", "pendente", "aprovado", "rejeitado"] as const).map((sit) => (
          <button
            key={sit}
            type="button"
            onClick={() => setFiltro(sit)}
            className={`pb-3 text-small font-medium border-b-2 cursor-pointer capitalize transition-colors ${
              filtro === sit
                ? "border-seal text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {sit === "todos" ? "Todos os Documentos" : sit}
          </button>
        ))}
      </div>

      {/* Lista de Documentos */}
      {docsFiltrados.length > 0 ? (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-paper/60 font-mono text-xs text-ink-muted">
                <th className="p-3.5">Colaborador / Tipo</th>
                <th className="p-3.5">Metadados Técnicos</th>
                <th className="p-3.5">Nome no Storage</th>
                <th className="p-3.5 text-center">Situação</th>
                <th className="p-3.5 text-right">Ação de Conferência</th>
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
                    <td className="p-3.5">
                      <span className="font-medium text-ink block">{doc.pessoaNome}</span>
                      <span className="text-xs text-seal block">
                        {ROTULO_TIPO[doc.tipo] ?? doc.tipo} · v{doc.versao}
                      </span>
                      <span className="font-mono text-[0.7rem] text-ink-muted">{doc.pessoaCpf}</span>
                    </td>

                    <td className="p-3.5 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className={baixaResolucao ? "text-alert font-bold" : "text-ink"}>
                          {doc.larguraPx ?? "—"} × {doc.alturaPx ?? "—"} px
                        </span>
                        {baixaResolucao && (
                          <span className="text-[0.65rem] bg-alert/10 text-alert px-1 font-bold">
                            BAIXA RESOLUÇÃO
                          </span>
                        )}
                      </div>
                      <span className="text-ink-muted text-[0.7rem] block">
                        {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB · ` : ""}
                        Hash: {doc.hashSha256.slice(0, 10)}...
                      </span>
                    </td>

                    <td className="p-3.5 font-mono text-xs text-ink-muted">
                      <span
                        className="block text-ink truncate max-w-[220px]"
                        title={doc.caminhoStorage}
                      >
                        {doc.caminhoStorage}
                      </span>
                      <span className="text-[0.7rem] text-ink-muted/80 block">
                        Original: {doc.nomeOriginal}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <Badge status={doc.status as StatusTipo} />
                      {doc.motivoRejeicao && (
                        <span
                          className="block text-[0.7rem] text-alert mt-1 max-w-[180px] truncate"
                          title={doc.motivoRejeicao}
                        >
                          {doc.motivoRejeicao}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.status !== "aprovado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleAprovar(doc)}
                            className="px-2.5 py-1 text-xs border border-success text-success hover:bg-success/10 cursor-pointer font-medium disabled:opacity-50 transition-colors"
                          >
                            {ocupado ? "Processando…" : "Aprovar"}
                          </button>
                        )}

                        {doc.status !== "rejeitado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => abrirModalRejeicao(doc)}
                            className="px-2.5 py-1 text-xs border border-alert text-alert hover:bg-alert/10 cursor-pointer font-medium disabled:opacity-50 transition-colors"
                          >
                            Rejeitar
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => abrirModalConferencia(doc)}
                          className="px-2.5 py-1 text-xs bg-paper border border-line text-ink hover:border-seal font-medium cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                        >
                          Abrir
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
          titulo="Nenhum documento aguardando nesta fila"
          descricao="Todos os documentos desta categoria foram auditados ou nenhum envio recente foi registrado."
        />
      )}

      {/* MODAL 1: CONFERÊNCIA COMPLETA DE DADOS DO COLABORADOR */}
      {docSelecionado && (
        <Modal
          aberto={modalConferenciaAberto}
          aoFechar={() => setModalConferenciaAberto(false)}
          titulo="Conferência de Documento & Cadastro"
          descricao="Inspecione os dados completos informados pelo colaborador no link de coleta e verifique o arquivo comprobatório antes de aprovar a emissão do contrato."
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
                <div className="bg-surface/80 p-3 border border-line space-y-1.5">
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
                <div className="bg-surface/80 p-3 border border-line space-y-1.5">
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
                <div className="bg-surface/80 p-3 border border-line space-y-1">
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
                <div className="bg-surface/80 p-3 border border-line space-y-1.5">
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
            <div className="space-y-3 bg-paper p-4 border border-line">
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
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border-2 border-seal text-ink hover:bg-seal/10 font-medium text-xs cursor-pointer transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
                >
                  <span>{carregandoDocUrl ? "Carregando…" : "📄 Visualizar Documento"}</span>
                  <span className="text-seal font-mono text-xs">↗</span>
                </button>
              </div>
            </div>

            {/* Ações de Decisão no Rodapé do Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => abrirModalRejeicao(docSelecionado)}
                disabled={processando === docSelecionado.id}
                className="w-full sm:w-auto px-4 py-2 text-xs border border-alert text-alert hover:bg-alert/10 cursor-pointer font-medium disabled:opacity-50 transition-colors"
              >
                Rejeitar Documento…
              </button>

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
                    className="w-full sm:w-auto px-5 py-2 text-xs bg-seal text-paper hover:opacity-90 font-semibold cursor-pointer disabled:opacity-50 transition-opacity shadow-sm flex items-center justify-center gap-2"
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

      {/* MODAL 2: MOTIVO DE REJEIÇÃO DO DOCUMENTO */}
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
