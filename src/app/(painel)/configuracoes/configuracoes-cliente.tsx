"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { Badge } from "@/components/badge";
import { Alerta } from "@/components/alerta";
import { Modal } from "@/components/modal";
import {
  alternarAtivoTemplate,
  expurgarDocumentosDaCampanha,
  salvarIdentidadeComite,
  salvarTemplate,
} from "./acoes";
import { ESTADO_INICIAL_IDENTIDADE, ESTADO_INICIAL_SALVAR_TEMPLATE } from "./estado";
import type { IdentidadeComite, TemplateContrato } from "./dados";

const MARCADORES = [
  "{{nome}}",
  "{{cpf}}",
  "{{endereco}}",
  "{{objeto}}",
  "{{valor}}",
  "{{valor_extenso}}",
  "{{vigencia_inicio}}",
  "{{vigencia_fim}}",
];

export function ConfiguracoesCliente({
  templatesIniciais,
  identidadeInicial,
}: {
  templatesIniciais: TemplateContrato[];
  identidadeInicial: IdentidadeComite;
}) {
  const router = useRouter();

  // Identidade do comitê (item 4) — real: grava em `organizacoes` (só gestor).
  const [estadoIdentidade, salvarIdentidadeAction, salvandoIdentidade] = useActionState(
    salvarIdentidadeComite,
    ESTADO_INICIAL_IDENTIDADE,
  );
  const identidadeFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estadoIdentidade.status === "sucesso") router.refresh();
  }, [estadoIdentidade.status, router]);

  // Editor de modelos — real
  const [modalAberto, setModalAberto] = useState(false);
  const [templateEmEdicao, setTemplateEmEdicao] = useState<TemplateContrato | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const [estado, formAction, pendente] = useActionState(
    salvarTemplate,
    ESTADO_INICIAL_SALVAR_TEMPLATE,
  );

  // Retenção / expurgo (Fase 4, item 6) — só gestor; a action checa o papel.
  const [motivoExpurgo, setMotivoExpurgo] = useState("");
  const [expurgando, iniciarExpurgo] = useTransition();
  const [resultadoExpurgo, setResultadoExpurgo] = useState<{
    tom: "sucesso" | "informativo" | "critico";
    texto: string;
  } | null>(null);

  function executarExpurgo() {
    setResultadoExpurgo(null);
    iniciarExpurgo(async () => {
      const r = await expurgarDocumentosDaCampanha(motivoExpurgo);
      if (r.status === "erro") {
        setResultadoExpurgo({ tom: "critico", texto: r.mensagem ?? "Não foi possível expurgar." });
        return;
      }
      if ((r.expurgados ?? 0) === 0) {
        setResultadoExpurgo({ tom: "informativo", texto: r.mensagem ?? "Nada a expurgar ainda." });
        return;
      }
      setMotivoExpurgo("");
      setResultadoExpurgo({
        tom: "sucesso",
        texto: `${r.expurgados} documento(s) expurgado(s) e registrado(s)${
          r.falhas ? `; ${r.falhas} falha(s)` : ""
        }.`,
      });
      router.refresh();
    });
  }

  useEffect(() => {
    if (estado.status === "sucesso") {
      setModalAberto(false);
      router.refresh();
    }
  }, [estado.status, router]);

  function abrirNovoTemplate() {
    setTemplateEmEdicao(null);
    setModalAberto(true);
  }

  function abrirEdicaoTemplate(template: TemplateContrato) {
    setTemplateEmEdicao(template);
    setModalAberto(true);
  }

  function inserirMarcador(marcador: string) {
    const textarea = corpoRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart ?? textarea.value.length;
    const fim = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, inicio) + marcador + textarea.value.slice(fim);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = inicio + marcador.length;
  }

  async function handleAlternarAtivo(template: TemplateContrato) {
    await alternarAtivoTemplate(template.id, !template.ativo);
    router.refresh();
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Parâmetros do Comitê & Modelos
          </span>
          <h1 className="text-h1 font-semibold text-ink">Configurações e Governança</h1>
          <p className="mt-1 text-small text-ink-muted">
            Dados cadastrais da campanha, modelos de minutas e políticas de retenção LGPD.
          </p>
        </div>

        <Selo voz="selo" onClick={abrirNovoTemplate} className="text-xs">
          + Novo Modelo de Contrato
        </Selo>
      </div>

      {/* IDENTIFICAÇÃO DO COMITÊ ELEITORAL — real (item 4), grava em `organizacoes` */}
      <section className="border border-line bg-surface p-6 space-y-6">
        <div className="regua">
          <h2 className="text-h2 font-semibold text-ink">Identificação do Comitê Eleitoral</h2>
          <p className="text-xs text-ink-muted">
            Nome e CNPJ da campanha, usados nos contratos e relatórios. Só o gestor edita.
          </p>
        </div>

        <form
          ref={identidadeFormRef}
          action={salvarIdentidadeAction}
          className="grid grid-cols-1 gap-6 pt-2 sm:grid-cols-2"
        >
          <Campo
            rotulo="Razão Social / Nome do Comitê"
            id="nome-comite"
            name="nome"
            required
            defaultValue={identidadeInicial.nome}
            erro={estadoIdentidade.status === "erro" ? estadoIdentidade.erros?.nome : undefined}
          />
          <Campo
            rotulo="CNPJ Eleitoral da Campanha"
            id="cnpj"
            name="cnpj"
            mono
            defaultValue={identidadeInicial.cnpj ?? ""}
            placeholder="00.000.000/0001-00"
            erro={estadoIdentidade.status === "erro" ? estadoIdentidade.erros?.cnpj : undefined}
          />
          <div className="sm:col-span-2 flex items-center gap-3">
            <Selo
              voz="selo"
              type="submit"
              carregando={salvandoIdentidade}
              textoCarregando="Salvando…"
              className="text-xs"
            >
              Salvar identidade
            </Selo>
            {estadoIdentidade.status === "sucesso" && (
              <span className="text-xs text-success">{estadoIdentidade.mensagem}</span>
            )}
            {estadoIdentidade.status === "erro" && estadoIdentidade.mensagem && (
              <span className="text-xs text-alert">{estadoIdentidade.mensagem}</span>
            )}
          </div>
        </form>
      </section>

      {/* MODELOS DE MINUTA CONTRATUAL — real (Fase 2, item 7) */}
      <section className="border border-line bg-surface p-6 space-y-6">
        <div className="regua flex items-center justify-between">
          <div>
            <h2 className="text-h2 font-semibold text-ink">Modelos de Minuta Contratual</h2>
            <p className="text-xs text-ink-muted">
              Templates com marcadores automáticos, usados na emissão de contrato.
            </p>
          </div>
          <Badge status="aprovado" rotuloPersonalizado="Variáveis Dinâmicas" />
        </div>

        {templatesIniciais.length > 0 ? (
          <div className="divide-y divide-line border border-line">
            {templatesIniciais.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{t.nome}</span>
                    {!t.ativo && <Badge status="neutro" rotuloPersonalizado="Inativo" />}
                  </div>
                  <span className="text-xs text-ink-muted block">
                    {t.objeto}
                    {t.valorPadrao ? ` · R$ ${Number(t.valorPadrao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirEdicaoTemplate(t)}
                    className="text-xs text-seal hover:underline cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlternarAtivo(t)}
                    className="text-xs text-ink-muted hover:text-ink hover:underline cursor-pointer"
                  >
                    {t.ativo ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-small text-ink-muted">
            Nenhum modelo cadastrado ainda. Crie o primeiro para poder emitir contratos.
          </p>
        )}

        <div className="p-4 bg-paper border border-line space-y-2">
          <span className="text-xs font-mono text-ink font-semibold uppercase">
            Marcadores suportados pelo sistema de emissão:
          </span>
          <div className="flex flex-wrap gap-2 text-xs font-mono text-ink-muted">
            {MARCADORES.map((tag) => (
              <span key={tag} className="border border-line bg-surface px-2 py-0.5 text-seal select-all">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[0.75rem] text-ink-muted leading-tight pt-1">
            * O valor por extenso é calculado no servidor a partir do valor numérico, nunca
            digitado.
          </p>
        </div>
      </section>

      {/* GOVERNANÇA LGPD E SEGURANÇA — cosmético, fora do escopo da Fase 2 */}
      <section className="border border-line bg-surface p-6 space-y-4">
        <div className="regua">
          <h2 className="text-h2 font-semibold text-ink">Proteção de Dados & Conformidade LGPD</h2>
          <p className="text-xs text-ink-muted">
            Política de privacidade, controle de privilégios e expurgo pós-campanha.
          </p>
        </div>

        <div className="space-y-3 pt-2 text-small text-ink-muted leading-relaxed">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <strong className="text-ink block">MFA TOTP Obrigatório</strong>
              <span className="text-xs">Exigido por política RLS para gestores e coordenadores.</span>
            </div>
            <Badge status="aprovado">Ativado</Badge>
          </div>

          <div className="flex items-center justify-between border-b border-line pb-3 pt-1">
            <div>
              <strong className="text-ink block">Isolamento Multi-tenant (Row-Level Security)</strong>
              <span className="text-xs">Impede vazamento de dados entre organizações distintas.</span>
            </div>
            <Badge status="aprovado">100% Coberto</Badge>
          </div>

          {/* Expurgo de documentos pessoais ao fim da campanha (Fase 4, item 6) */}
          <div className="pt-2">
            <strong className="text-ink block">Expurgo de documentos pessoais</strong>
            <span className="text-xs block">
              Ao fim da campanha, passada a carência legal de retenção, apaga os arquivos de
              RG/CNH/comprovante do Storage e registra o expurgo (o que, quando, por quem e por quê).
              Só o gestor executa.
            </span>
            <div className="mt-3 space-y-2">
              <Campo
                id="motivo-expurgo"
                rotulo="Motivo do expurgo"
                value={motivoExpurgo}
                onChange={(e) => setMotivoExpurgo(e.target.value)}
                placeholder="Ex.: encerramento da prestação de contas da campanha 2026"
              />
              <Selo
                voz="perigo"
                onClick={executarExpurgo}
                carregando={expurgando}
                textoCarregando="Expurgando…"
                disabled={!motivoExpurgo.trim() || expurgando}
                className="text-xs"
              >
                Executar expurgo de retenção
              </Selo>
              {resultadoExpurgo && (
                <Alerta
                  tom={
                    resultadoExpurgo.tom === "sucesso"
                      ? "sucesso"
                      : resultadoExpurgo.tom === "informativo"
                        ? "informativo"
                        : "critico"
                  }
                >
                  {resultadoExpurgo.texto}
                </Alerta>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MODAL: EDITAR/CRIAR MODELO */}
      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={templateEmEdicao ? "Editar Modelo de Contrato" : "Novo Modelo de Contrato"}
        descricao="Use os marcadores abaixo no corpo do texto — eles são substituídos pelos dados reais na emissão."
        rotuloPrimario={pendente ? "Salvando…" : "Salvar Modelo"}
        acaoPrimaria={() => formRef.current?.requestSubmit()}
        desabilitarConfirmacao={pendente}
      >
        <form ref={formRef} action={formAction} className="space-y-4 text-small">
          <input type="hidden" name="id" value={templateEmEdicao?.id ?? ""} />

          {estado.status === "erro" && (
            <Alerta tom="critico" titulo="Não foi possível salvar">
              {estado.mensagem}
            </Alerta>
          )}

          <Campo
            rotulo="Identificador do Modelo"
            id="template-nome"
            name="nome"
            required
            defaultValue={templateEmEdicao?.nome ?? ""}
          />
          <Campo
            rotulo="Objeto Padrão"
            id="template-objeto"
            name="objeto"
            required
            defaultValue={templateEmEdicao?.objeto ?? ""}
          />
          <Campo
            rotulo="Valor Padrão (R$) — opcional"
            id="template-valor"
            name="valorPadrao"
            mono
            defaultValue={templateEmEdicao?.valorPadrao ?? ""}
            placeholder="1500.00"
          />

          <div>
            <label className="block text-small font-medium text-ink mb-1.5">
              Corpo do Contrato
            </label>
            <textarea
              ref={corpoRef}
              name="corpoHtml"
              rows={8}
              required
              defaultValue={templateEmEdicao?.corpoHtml ?? ""}
              className="w-full border border-line bg-transparent p-2.5 text-small text-ink outline-none focus:border-seal leading-relaxed font-mono text-xs"
              placeholder={"<p>O(a) CONTRATADO(A) {{nome}}, CPF {{cpf}}...</p>"}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {MARCADORES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => inserirMarcador(m)}
                  className="px-2 py-1 bg-paper border border-line text-[0.7rem] font-mono text-seal hover:border-seal cursor-pointer"
                >
                  + {m}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
