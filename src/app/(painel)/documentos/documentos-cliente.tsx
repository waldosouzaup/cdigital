"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type StatusTipo } from "@/components/badge";
import { Modal } from "@/components/modal";
import { Alerta } from "@/components/alerta";
import { EstadoVazio } from "@/components/estado-vazio";
import { aprovarDocumento, gerarUrlDocumento, rejeitarDocumento } from "./acoes";
import type { DocumentoListado } from "./dados";

const ROTULO_TIPO: Record<string, string> = {
  documento_identidade: "Documento de Identidade (RG/CNH)",
};

const MOTIVOS_RECORRENTES = [
  "Resolução inferior a 800 px (foto ilegível)",
  "Documento cortado ou incompleto",
  "Reflexo da luz encobre o número do documento",
  "Documento vencido ou inválido",
];

export function DocumentosCliente({
  documentosIniciais,
}: {
  documentosIniciais: DocumentoListado[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "aprovado" | "rejeitado">("todos");
  const [processando, setProcessando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [docSelecionado, setDocSelecionado] = useState<DocumentoListado | null>(null);
  const [modalRejeicaoAberto, setModalRejeicaoAberto] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  const docsFiltrados = documentosIniciais.filter((d) => filtro === "todos" || d.status === filtro);

  function mostrarFeedback(mensagem: string) {
    setFeedback(mensagem);
    setTimeout(() => setFeedback(null), 4500);
  }

  async function handleAprovar(doc: DocumentoListado) {
    setProcessando(doc.id);
    const resultado = await aprovarDocumento(doc.id);
    setProcessando(null);

    if (!resultado.ok) {
      mostrarFeedback(resultado.mensagem ?? "Não foi possível aprovar o documento.");
      return;
    }
    mostrarFeedback(
      resultado.pessoaFicouApta
        ? `Documento aprovado. ${doc.pessoaNome} está com a documentação completa — liberado(a) para emissão de contrato.`
        : "Documento aprovado.",
    );
    router.refresh();
  }

  function abrirModalRejeicao(doc: DocumentoListado) {
    setDocSelecionado(doc);
    setMotivoRejeicao(
      (doc.larguraPx ?? 0) < 800
        ? "Resolução inferior a 800 px na menor dimensão. Imagem ilegível."
        : "",
    );
    setModalRejeicaoAberto(true);
  }

  async function handleConfirmarRejeicao() {
    if (!docSelecionado || !motivoRejeicao.trim()) return;

    setProcessando(docSelecionado.id);
    const resultado = await rejeitarDocumento(docSelecionado.id, motivoRejeicao.trim());
    setProcessando(null);
    setModalRejeicaoAberto(false);

    if (!resultado.ok) {
      mostrarFeedback(resultado.mensagem ?? "Não foi possível rejeitar o documento.");
      return;
    }
    mostrarFeedback(
      `Documento reprovado. Um novo link de coleta foi enviado por e-mail para ${docSelecionado.pessoaNome} reenviar.`,
    );
    router.refresh();
  }

  async function handleAbrir(doc: DocumentoListado) {
    setProcessando(doc.id);
    const resultado = await gerarUrlDocumento(doc.id);
    setProcessando(null);

    if (!resultado.ok || !resultado.url) {
      mostrarFeedback(resultado.mensagem ?? "Não foi possível gerar o link de acesso.");
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
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
            Inspeção de qualidade técnica, integridade SHA-256 e validação de resolução mínima
            (800 px).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">Storage:</span>
          <Badge status="aprovado" rotuloPersonalizado="Buckets Privados (15 min)" />
        </div>
      </div>

      {feedback && (
        <Alerta tom="informativo" titulo="Registro de auditoria atualizado">
          {feedback}
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
                  (doc.larguraPx ?? Infinity) < 800 || (doc.alturaPx ?? Infinity) < 800;
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
                          <span className="text-[0.65rem] bg-alert/10 text-alert px-1">
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
                            className="px-2.5 py-1 text-xs border border-success text-success hover:bg-success/10 cursor-pointer font-medium disabled:opacity-50"
                          >
                            Aprovar
                          </button>
                        )}

                        {doc.status !== "rejeitado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => abrirModalRejeicao(doc)}
                            className="px-2.5 py-1 text-xs border border-alert text-alert hover:bg-alert/10 cursor-pointer font-medium disabled:opacity-50"
                          >
                            Rejeitar
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => handleAbrir(doc)}
                          className="px-2 py-1 text-xs text-ink hover:underline cursor-pointer disabled:opacity-50"
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

      {/* MODAL: MOTIVO DE REJEIÇÃO DO DOCUMENTO */}
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
              rows={3}
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              className="w-full border border-line bg-transparent p-2.5 text-small text-ink outline-none focus:border-seal leading-relaxed"
              placeholder="Ex: A foto ficou cortada e não é possível ler o número do RG e do CPF."
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-ink-muted">Motivos recorrentes:</span>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_RECORRENTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivoRejeicao(m)}
                  className="px-2 py-1 bg-paper border border-line text-[0.7rem] text-ink hover:border-seal cursor-pointer"
                >
                  + {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
