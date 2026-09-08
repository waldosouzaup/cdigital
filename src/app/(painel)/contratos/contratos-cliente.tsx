"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  gerarUrlPdfContrato,
  marcarContratoAssinado,
  marcarDistratoAssinado,
} from "./acoes";
import type { ContratoListado, PessoaParaEmissao, TemplateParaEmissao } from "./dados";

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
  contratosIniciais,
  pessoasAptas,
  templates,
}: {
  contratosIniciais: ContratoListado[];
  pessoasAptas: PessoaParaEmissao[];
  templates: TemplateParaEmissao[];
}) {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<"ativos" | "distratos">("ativos");
  const [processando, setProcessando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tom: "sucesso" | "critico"; texto: string } | null>(
    null,
  );

  const contratosAtivos = contratosIniciais.filter(
    (c) => c.status !== "distratado" && c.status !== "distrato_assinado",
  );
  const contratosDistratados = contratosIniciais.filter(
    (c) => c.status === "distratado" || c.status === "distrato_assinado",
  );
  const listaExibida = abaAtiva === "ativos" ? contratosAtivos : contratosDistratados;

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

  function abrirModalEmissao() {
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

  function abrirModalLote() {
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
    setDestinatarioEnvio("");
    setModalEnvioAberto(true);
  }

  async function handleConfirmarEnvio() {
    if (!contratoParaEnvio || !destinatarioEnvio.trim()) return;
    setProcessando(contratoParaEnvio.id);
    const resultado = await enviarContrato(contratoParaEnvio.id, canalEnvio, destinatarioEnvio.trim());
    setProcessando(null);
    setModalEnvioAberto(false);
    mostrarFeedback(
      resultado.ok ? "sucesso" : "critico",
      resultado.ok ? "Envio registrado. O contratado foi avisado." : (resultado.mensagem ?? "Falha."),
    );
    if (resultado.ok) router.refresh();
  }

  // --- Ações diretas: marcar assinado, distratar, ver termo -----------------
  async function handleMarcarAssinado(contrato: ContratoListado) {
    setProcessando(contrato.id);
    const resultado = await marcarContratoAssinado(contrato.id);
    setProcessando(null);
    mostrarFeedback(resultado.ok ? "sucesso" : "critico", resultado.mensagem ?? "Contrato assinado.");
    if (resultado.ok) router.refresh();
  }

  const [modalDistratoAberto, setModalDistratoAberto] = useState(false);
  const [contratoParaDistrato, setContratoParaDistrato] = useState<ContratoListado | null>(null);
  const [motivoDistrato, setMotivoDistrato] = useState("");

  function abrirModalDistrato(contrato: ContratoListado) {
    setContratoParaDistrato(contrato);
    setMotivoDistrato("");
    setModalDistratoAberto(true);
  }

  async function handleConfirmarDistrato() {
    if (!contratoParaDistrato || !motivoDistrato.trim()) return;
    setProcessando(contratoParaDistrato.id);
    const resultado = await distratarContrato(contratoParaDistrato.id, motivoDistrato.trim());
    setProcessando(null);
    setModalDistratoAberto(false);
    mostrarFeedback(
      resultado.ok ? "sucesso" : "critico",
      resultado.mensagem ?? (resultado.ok ? "Distrato registrado e termo gerado." : "Falha ao distratar."),
    );
    if (resultado.ok) router.refresh();
  }

  async function handleMarcarDistratoAssinado(contrato: ContratoListado) {
    setProcessando(contrato.id);
    const resultado = await marcarDistratoAssinado(contrato.id);
    setProcessando(null);
    mostrarFeedback(resultado.ok ? "sucesso" : "critico", resultado.mensagem ?? "Recebimento confirmado.");
    if (resultado.ok) router.refresh();
  }

  async function handleVerTermo(
    contrato: ContratoListado,
    versao: "gerado" | "assinado" | "distrato" = "gerado",
  ) {
    setProcessando(contrato.id);
    const resultado = await gerarUrlPdfContrato(contrato.id, versao);
    setProcessando(null);
    if (!resultado.ok || !resultado.url) {
      mostrarFeedback("critico", resultado.mensagem ?? "PDF indisponível.");
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  // --- Modal: Anexar PDF assinado (item 12) ----------------------------------
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [contratoParaAssinatura, setContratoParaAssinatura] = useState<ContratoListado | null>(null);
  const [arquivoAssinatura, setArquivoAssinatura] = useState<File | null>(null);
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false);

  function abrirModalAssinatura(contrato: ContratoListado) {
    setContratoParaAssinatura(contrato);
    setArquivoAssinatura(null);
    setModalAssinaturaAberto(true);
  }

  async function handleConfirmarAssinatura() {
    if (!contratoParaAssinatura || !arquivoAssinatura) return;
    setEnviandoAssinatura(true);

    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivoAssinatura);
      const resposta = await fetch(`/api/contratos/${contratoParaAssinatura.id}/assinatura`, {
        method: "POST",
        body: corpo,
      });
      const resultado = await resposta.json();

      setModalAssinaturaAberto(false);
      mostrarFeedback(
        resposta.ok && resultado.ok ? "sucesso" : "critico",
        resultado.mensagem ?? (resposta.ok ? "PDF assinado anexado." : "Falha ao enviar."),
      );
      if (resposta.ok && resultado.ok) router.refresh();
    } catch {
      mostrarFeedback("critico", "Falha de conexão ao enviar o PDF assinado.");
    } finally {
      setEnviandoAssinatura(false);
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
            Emissão com valor por extenso, transições seguras e trilha de eventos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Selo
            voz="neutro"
            onClick={abrirModalLote}
            className="text-xs"
            disabled={pessoasAptas.length === 0 || templates.length === 0}
          >
            📄 Emissão em Lote
          </Selo>
          <Selo
            voz="selo"
            onClick={abrirModalEmissao}
            className="text-xs"
            disabled={pessoasAptas.length === 0 || templates.length === 0}
          >
            + Emitir Contrato
          </Selo>
        </div>
      </div>

      {(pessoasAptas.length === 0 || templates.length === 0) && (
        <Alerta tom="atencao" titulo="Emissão indisponível no momento">
          {templates.length === 0
            ? "Cadastre um modelo de contrato em Configurações antes de emitir."
            : "Não há pessoas aptas sem contrato ativo no momento — aprove documentos em Documentos."}
        </Alerta>
      )}

      {feedback && (
        <Alerta tom={feedback.tom === "sucesso" ? "sucesso" : "critico"} titulo="Transição">
          {feedback.texto}
        </Alerta>
      )}

      {/* Abas */}
      <div className="flex border-b border-line gap-6">
        <button
          type="button"
          onClick={() => setAbaAtiva("ativos")}
          className={`pb-3 text-small font-medium border-b-2 cursor-pointer transition-colors ${
            abaAtiva === "ativos" ? "border-seal text-ink" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Quadro Ativo ({contratosAtivos.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("distratos")}
          className={`pb-3 text-small font-medium border-b-2 cursor-pointer transition-colors ${
            abaAtiva === "distratos" ? "border-alert text-alert" : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Visão de Distratos ({contratosDistratados.length})
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
                <th className="p-3.5 text-right">Ações da Máquina</th>
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
                        {c.status === "emitido" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => abrirModalEnvio(c)}
                            className="px-2 py-1 text-xs border border-info text-info hover:bg-info/10 cursor-pointer disabled:opacity-50"
                          >
                            Registrar Envio
                          </button>
                        )}
                        {c.status === "enviado" && (
                          <>
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => abrirModalAssinatura(c)}
                              className="px-2 py-1 text-xs border border-success text-success hover:bg-success/10 cursor-pointer disabled:opacity-50"
                              title="Anexar o PDF assinado enviado pelo contratado"
                            >
                              Anexar PDF Assinado
                            </button>
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => handleMarcarAssinado(c)}
                              className="px-2 py-1 text-xs text-ink-muted hover:text-ink hover:underline cursor-pointer disabled:opacity-50"
                              title="Assinatura feita presencialmente, sem arquivo"
                            >
                              Marcar Assinado (Presencial)
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
                          disabled={ocupado || !c.pdfPath}
                          onClick={() => handleVerTermo(c, "gerado")}
                          className="px-2 py-1 text-xs text-ink hover:underline cursor-pointer disabled:opacity-40"
                          title={c.pdfPath ? "Abrir o PDF gerado pelo sistema na emissão" : "PDF ainda não gerado"}
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
          descricao="Não existem contratos associados a esta lista ainda."
        />
      )}

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

          <Campo.Selecao rotulo="Pessoa (apta, sem contrato ativo)" id="pessoaId" name="pessoaId" required>
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
            onChange={(e) => setTemplateSelecionado(templates.find((t) => t.id === e.target.value) ?? null)}
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
            <Campo rotulo="Vigência — início" id="vigenciaInicio" name="vigenciaInicio" type="date" required />
            <Campo rotulo="Vigência — fim" id="vigenciaFim" name="vigenciaFim" type="date" required />
          </div>
        </form>
      </Modal>

      {/* MODAL: EMISSÃO EM LOTE (item 9) */}
      <Modal
        aberto={modalLoteAberto}
        aoFechar={() => setModalLoteAberto(false)}
        titulo="Emissão de Contratos em Lote"
        descricao="Gera contrato (com PDF) para todas as pessoas selecionadas, com o mesmo modelo, valor e vigência."
        rotuloPrimario={emitindoLotePendente ? "Emitindo…" : `Emitir ${pessoasSelecionadasLote.size || ""} Contrato(s)`}
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
            onChange={(e) => setTemplateLote(templates.find((t) => t.id === e.target.value) ?? null)}
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
            <Campo rotulo="Vigência — início" id="vigenciaInicioLote" name="vigenciaInicio" type="date" required />
            <Campo rotulo="Vigência — fim" id="vigenciaFimLote" name="vigenciaFim" type="date" required />
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
                {pessoasSelecionadasLote.size === pessoasAptas.length ? "Limpar seleção" : "Selecionar todas"}
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
        titulo="Registrar Envio do Contrato"
        descricao="Dispara um aviso por e-mail ao contratado (se houver e-mail cadastrado)."
        rotuloPrimario={processando === contratoParaEnvio?.id ? "Enviando…" : "Confirmar Envio"}
        acaoPrimaria={handleConfirmarEnvio}
        desabilitarConfirmacao={!destinatarioEnvio.trim() || processando === contratoParaEnvio?.id}
      >
        <div className="space-y-4 text-small">
          <div>
            <label className="block text-small font-medium text-ink mb-1.5">Canal de Envio</label>
            <select
              value={canalEnvio}
              onChange={(e) => setCanalEnvio(e.target.value as typeof canalEnvio)}
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

      {/* MODAL: CONFIRMAÇÃO DE DISTRATO (item 13) */}
      <Modal
        aberto={modalDistratoAberto}
        aoFechar={() => setModalDistratoAberto(false)}
        titulo="Registrar Distrato"
        descricao="Gera o termo de distrato em PDF e retira a pessoa do quadro ativo. O contrato original é preservado, não apagado."
        rotuloPrimario={processando === contratoParaDistrato?.id ? "Gerando termo…" : "Confirmar e Gerar Distrato"}
        rotuloSecundario="Desistir"
        vozPrimaria="perigo"
        acaoPrimaria={handleConfirmarDistrato}
        desabilitarConfirmacao={!motivoDistrato.trim() || processando === contratoParaDistrato?.id}
      >
        <div className="space-y-3">
          <Alerta tom="critico" titulo="Atenção à legislação eleitoral">
            O distrato preserva integralmente o histórico financeiro e o contrato original para
            prestação de contas, mas impede novos lançamentos e pagamentos.
          </Alerta>
          <p className="text-small text-ink">
            Contratado: <strong>{contratoParaDistrato?.pessoaNome}</strong>
          </p>
          <div>
            <label className="block text-small font-medium text-ink mb-1.5">Motivo do Distrato</label>
            <textarea
              rows={3}
              value={motivoDistrato}
              onChange={(e) => setMotivoDistrato(e.target.value)}
              className="w-full border border-line bg-transparent p-2.5 text-small text-ink outline-none focus:border-seal leading-relaxed"
              placeholder="Ex: Pedido de desligamento do próprio contratado."
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: ANEXAR PDF ASSINADO (item 12) */}
      <Modal
        aberto={modalAssinaturaAberto}
        aoFechar={() => setModalAssinaturaAberto(false)}
        titulo="Anexar PDF Assinado"
        descricao="Envie o contrato assinado que o contratado devolveu (escaneado ou fotografado em PDF)."
        rotuloPrimario={enviandoAssinatura ? "Enviando…" : "Confirmar Assinatura"}
        acaoPrimaria={handleConfirmarAssinatura}
        desabilitarConfirmacao={!arquivoAssinatura || enviandoAssinatura}
      >
        <div className="space-y-4 text-small">
          <p className="text-small text-ink">
            Contratado: <strong>{contratoParaAssinatura?.pessoaNome}</strong>
          </p>
          <label
            htmlFor="upload-assinatura"
            className="block border-2 border-dashed border-line hover:border-seal p-6 text-center bg-surface/60 cursor-pointer transition-colors"
          >
            <input
              id="upload-assinatura"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setArquivoAssinatura(e.target.files?.[0] ?? null)}
            />
            <div className="space-y-1">
              <div className="font-mono text-2xl text-seal">📄</div>
              <div className="text-small font-medium text-ink">
                {arquivoAssinatura ? arquivoAssinatura.name : "Selecionar arquivo PDF"}
              </div>
              <p className="text-xs text-ink-muted">Somente PDF, até 20 MB</p>
            </div>
          </label>
        </div>
      </Modal>
    </div>
  );
}
