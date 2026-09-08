"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type StatusTipo } from "@/components/badge";
import { Selo } from "@/components/selo";
import { Campo } from "@/components/campo";
import { Modal } from "@/components/modal";
import { Alerta } from "@/components/alerta";
import { EstadoVazio } from "@/components/estado-vazio";
import {
  ESTADO_INICIAL_EMITIR_CONTRATO,
  distratarContrato,
  emitirContrato,
  enviarContrato,
  gerarUrlPdfContrato,
  marcarContratoAssinado,
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

  async function handleConfirmarDistrato() {
    if (!contratoParaDistrato) return;
    setProcessando(contratoParaDistrato.id);
    const resultado = await distratarContrato(contratoParaDistrato.id);
    setProcessando(null);
    setModalDistratoAberto(false);
    mostrarFeedback(resultado.ok ? "sucesso" : "critico", resultado.mensagem ?? "Distrato registrado.");
    if (resultado.ok) router.refresh();
  }

  async function handleVerTermo(contrato: ContratoListado) {
    setProcessando(contrato.id);
    const resultado = await gerarUrlPdfContrato(contrato.id);
    setProcessando(null);
    if (!resultado.ok || !resultado.url) {
      mostrarFeedback("critico", resultado.mensagem ?? "PDF indisponível.");
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
            Ciclo de Vida Contratual & Auditoria
          </span>
          <h1 className="text-h1 font-semibold text-ink">Gestão de Contratos e Vigor</h1>
          <p className="mt-1 text-small text-ink-muted">
            Emissão com valor por extenso, transições seguras e trilha de eventos.
          </p>
        </div>

        <Selo
          voz="selo"
          onClick={abrirModalEmissao}
          className="text-xs"
          disabled={pessoasAptas.length === 0 || templates.length === 0}
        >
          + Emitir Contrato
        </Selo>
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
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => handleMarcarAssinado(c)}
                            className="px-2 py-1 text-xs border border-success text-success hover:bg-success/10 cursor-pointer disabled:opacity-50"
                          >
                            Marcar Assinado
                          </button>
                        )}
                        {c.status === "assinado" && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => {
                              setContratoParaDistrato(c);
                              setModalDistratoAberto(true);
                            }}
                            className="px-2 py-1 text-xs border border-alert/40 text-alert hover:bg-alert/10 cursor-pointer disabled:opacity-50"
                          >
                            Distratar
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={ocupado || !c.pdfPath}
                          onClick={() => handleVerTermo(c)}
                          className="px-2 py-1 text-xs text-ink hover:underline cursor-pointer disabled:opacity-40"
                          title={c.pdfPath ? "Abrir PDF assinado digitalmente" : "PDF ainda não gerado"}
                        >
                          Ver Termo
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

      {/* MODAL: CONFIRMAÇÃO DE DISTRATO */}
      <Modal
        aberto={modalDistratoAberto}
        aoFechar={() => setModalDistratoAberto(false)}
        titulo="Registrar Distrato"
        descricao="Retira a pessoa do quadro ativo. O contrato original é preservado, não apagado."
        rotuloPrimario="Confirmar Distrato"
        rotuloSecundario="Desistir"
        vozPrimaria="perigo"
        acaoPrimaria={handleConfirmarDistrato}
      >
        <div className="space-y-3">
          <Alerta tom="critico" titulo="Geração do termo ainda não automatizada">
            Esta ação registra a transição de estado. A geração do documento de distrato em si
            ainda não foi implementada — item pendente da Fase 2.
          </Alerta>
          <p className="text-small text-ink">
            Contratado: <strong>{contratoParaDistrato?.pessoaNome}</strong>
          </p>
        </div>
      </Modal>
    </div>
  );
}
