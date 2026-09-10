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
import { EquipeSecao } from "./equipe-secao";
import { RegioesSecao } from "./regioes-secao";
import { AtividadesSecao } from "./atividades-secao";
import { CampanhasSecao } from "./campanhas-secao";
import { MODELO_REFERENCIA_MICHELLE } from "@/lib/contratos/modelo-referencia";
import type { CampanhaSuperadmin, IdentidadeComite, TemplateContrato } from "./dados";
import type { MembroEquipe } from "../equipe/dados";
import type { RegiaoListada } from "../regioes/dados";
import type {
  PessoaOpcao,
  RegiaoOpcao,
  RegistroAtividadeListado,
} from "../atividades/dados";

const MARCADORES = [
  "{{nome}}",
  "{{cpf}}",
  "{{endereco}}",
  "{{chave_pix}}",
  "{{email}}",
  "{{telefone}}",
  "{{banco}}",
  "{{agencia}}",
  "{{conta}}",
  "{{objeto}}",
  "{{objeto_descricao}}",
  "{{valor}}",
  "{{valor_extenso}}",
  "{{vigencia_inicio}}",
  "{{vigencia_fim}}",
];

export function ConfiguracoesCliente({
  templatesIniciais,
  identidadeInicial,
  membrosIniciais,
  regioesIniciais,
  atividadesContexto,
  campanhasIniciais,
  usuarioLogado,
}: {
  templatesIniciais: TemplateContrato[];
  identidadeInicial: IdentidadeComite;
  membrosIniciais: MembroEquipe[];
  regioesIniciais: RegiaoListada[];
  atividadesContexto: {
    regioes: RegiaoOpcao[];
    pessoas: PessoaOpcao[];
    registros: RegistroAtividadeListado[];
  };
  campanhasIniciais?: CampanhaSuperadmin[];
  usuarioLogado?: { id: string | null; papel?: string };
}) {
  const router = useRouter();

  // Estado dos modelos de contrato sincronizado com os dados do servidor
  const [templates, setTemplates] = useState<TemplateContrato[]>(templatesIniciais);
  useEffect(() => {
    setTemplates(templatesIniciais);
  }, [templatesIniciais]);

  // Identidade do comitê (item 4) — real: grava em `organizacoes` (só gestor).
  const [estadoIdentidade, salvarIdentidadeAction, salvandoIdentidade] = useActionState(
    salvarIdentidadeComite,
    ESTADO_INICIAL_IDENTIDADE,
  );
  const identidadeFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estadoIdentidade.status === "sucesso") router.refresh();
  }, [estadoIdentidade.status, router]);

  // Slug da URL pública de autoinscrição (Feature B) — controlado, para o preview
  // reagir enquanto digita.
  const [slug, setSlug] = useState(identidadeInicial.slug ?? "");
  const [origin, setOrigin] = useState("");
  const [slugCopiado, setSlugCopiado] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const urlInscricao = slug ? `${origin}/inscricao/${slug}` : "";

  async function copiarUrlInscricao() {
    if (!urlInscricao) return;
    await navigator.clipboard.writeText(urlInscricao);
    setSlugCopiado(true);
    setTimeout(() => setSlugCopiado(false), 2000);
  }

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

  function carregarMinutaBase() {
    if (corpoRef.current) {
      corpoRef.current.value = MODELO_REFERENCIA_MICHELLE;
      corpoRef.current.focus();
    }
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
    setTemplates((anteriores) =>
      anteriores.map((t) => (t.id === template.id ? { ...t, ativo: !t.ativo } : t)),
    );
    await alternarAtivoTemplate(template.id, !template.ativo);
    router.refresh();
  }


  type AbaConfiguracao =
    | "equipe"
    | "regioes"
    | "atividades"
    | "identidade"
    | "modelos"
    | "seguranca"
    | "campanhas";
  const [abaAtiva, setAbaAtiva] = useState<AbaConfiguracao>(
    usuarioLogado?.papel === "superadmin" ? "campanhas" : "equipe",
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const aba = params.get("aba");
    if (
      aba === "identidade" ||
      aba === "modelos" ||
      aba === "seguranca" ||
      aba === "equipe" ||
      aba === "regioes" ||
      aba === "atividades" ||
      aba === "campanhas"
    ) {
      setAbaAtiva(aba);
    }
  }, []);

  function mudarAba(novaAba: AbaConfiguracao) {
    setAbaAtiva(novaAba);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", novaAba);
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Parâmetros Gerais &amp; Governança
          </span>
          <h1 className="text-h1 font-semibold text-ink">Configurações do Comitê</h1>
          <p className="mt-1 text-small text-ink-muted">
            Gestão de equipe, regiões territoriais, apontamento de atividades, parâmetros da campanha, modelos de minutas e segurança LGPD.
          </p>
        </div>

        {abaAtiva === "modelos" && (
          <Selo voz="selo" onClick={abrirNovoTemplate} className="text-xs">
            + Novo Modelo de Contrato
          </Selo>
        )}
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => mudarAba("equipe")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "equipe"
              ? "border-primary text-primary font-semibold bg-primary/5"
              : "border-transparent text-ink-muted hover:text-ink hover:border-line"
          }`}
        >
          <span>🔑</span>
          <span>Equipe &amp; Acessos</span>
          <span className="ml-1 rounded-full bg-surface-sunken border border-line px-1.5 py-0.2 font-mono text-[0.65rem] text-ink-muted">
            {membrosIniciais.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => mudarAba("regioes")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "regioes"
              ? "border-primary text-primary font-semibold bg-primary/5"
              : "border-transparent text-ink-muted hover:text-ink hover:border-line"
          }`}
        >
          <span>🗺</span>
          <span>Regiões de Atuação</span>
          <span className="ml-1 rounded-full bg-surface-sunken border border-line px-1.5 py-0.2 font-mono text-[0.65rem] text-ink-muted">
            {regioesIniciais.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => mudarAba("atividades")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "atividades"
              ? "border-primary text-primary font-semibold bg-primary/5"
              : "border-transparent text-ink-muted hover:text-ink hover:border-line"
          }`}
        >
          <span>📌</span>
          <span>Atividades de Rua</span>
          <span className="ml-1 rounded-full bg-surface-sunken border border-line px-1.5 py-0.2 font-mono text-[0.65rem] text-ink-muted">
            {atividadesContexto.registros.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => mudarAba("identidade")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "identidade"
              ? "border-primary text-primary font-semibold bg-primary/5"
              : "border-transparent text-ink-muted hover:text-ink hover:border-line"
          }`}
        >
          <span>🏢</span>
          <span>Identificação do Comitê</span>
        </button>

        <button
          type="button"
          onClick={() => mudarAba("modelos")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "modelos"
              ? "border-primary text-primary font-semibold bg-primary/5"
              : "border-transparent text-ink-muted hover:text-ink hover:border-line"
          }`}
        >
          <span>📄</span>
          <span>Modelos de Minuta</span>
          <span className="ml-1 rounded-full bg-surface-sunken border border-line px-1.5 py-0.2 font-mono text-[0.65rem] text-ink-muted">
            {templates.length}
          </span>
        </button>


        <button
          type="button"
          onClick={() => mudarAba("seguranca")}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "seguranca"
              ? "border-primary text-primary font-semibold bg-primary/5"
              : "border-transparent text-ink-muted hover:text-ink hover:border-line"
          }`}
        >
          <span>🛡</span>
          <span>Proteção &amp; LGPD</span>
        </button>

        {usuarioLogado?.papel === "superadmin" && (
          <button
            type="button"
            onClick={() => mudarAba("campanhas")}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === "campanhas"
                ? "border-primary text-primary font-semibold bg-primary/5"
                : "border-transparent text-ink-muted hover:text-ink hover:border-line"
            }`}
          >
            <span>👑</span>
            <span>Campanhas (SuperAdmin)</span>
            <span className="ml-1 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.2 font-mono text-[0.65rem] text-primary font-semibold">
              {campanhasIniciais?.length ?? 0}
            </span>
          </button>
        )}
      </div>

      {/* ABA: EQUIPE & ACESSOS */}
      {abaAtiva === "equipe" && (
        <section className="border border-line bg-surface p-6">
          <EquipeSecao
            membrosIniciais={membrosIniciais}
            regioes={regioesIniciais}
            usuarioLogado={usuarioLogado}
          />
        </section>
      )}

      {/* ABA: REGIÕES DE ATUAÇÃO */}
      {abaAtiva === "regioes" && (
        <section className="border border-line bg-surface p-6">
          <RegioesSecao regioesIniciais={regioesIniciais} />
        </section>
      )}

      {/* ABA: ATIVIDADES DE RUA */}
      {abaAtiva === "atividades" && (
        <section className="border border-line bg-surface p-6">
          <AtividadesSecao
            regioes={atividadesContexto.regioes}
            pessoas={atividadesContexto.pessoas}
            registros={atividadesContexto.registros}
          />
        </section>
      )}

      {/* IDENTIFICAÇÃO DO COMITÊ ELEITORAL — real (item 4), grava em `organizacoes` */}
      {abaAtiva === "identidade" && (
      <section className="border border-line bg-surface p-6 space-y-6">
        <div className="regua">
          <h2 className="text-h2 font-semibold text-ink">Identificação do Comitê Eleitoral</h2>
          <p className="text-xs text-ink-muted">
            Nome e CNPJ da campanha (usados nos contratos e relatórios) e o endereço público de
            autoinscrição. Só o gestor edita.
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

          <div className="sm:col-span-2 space-y-2">
            <Campo
              rotulo="Endereço público de autoinscrição"
              id="slug-inscricao"
              name="slug"
              mono
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="comite-michelle-2026"
              auxiliar="Link fixo para divulgar em canais e no portal. Deixe em branco para desativar a autoinscrição."
              erro={estadoIdentidade.status === "erro" ? estadoIdentidade.erros?.slug : undefined}
            />
            {urlInscricao && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-seal select-all break-all">{urlInscricao}</span>
                <button
                  type="button"
                  onClick={copiarUrlInscricao}
                  className="border border-line px-2 py-0.5 text-ink-muted hover:text-ink"
                >
                  {slugCopiado ? "Copiado ✓" : "Copiar"}
                </button>
              </div>
            )}
          </div>

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
      )}

      {/* MODELOS DE MINUTA CONTRATUAL — real (Fase 2, item 7) */}
      {abaAtiva === "modelos" && (
      <section className="border border-line bg-surface p-6 space-y-6 rounded-lg shadow-xs">
        <div className="regua flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-ink">Modelos de Minuta Contratual</h2>
            <p className="text-xs text-ink-muted">
              Templates com marcadores automáticos, usados na emissão de contrato.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge status="aprovado" rotuloPersonalizado="Variáveis Dinâmicas" />
            <button
              type="button"
              onClick={abrirNovoTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-semibold text-xs rounded hover:bg-primary-hover transition-colors cursor-pointer shadow-xs"
            >
              <span>+</span>
              <span>Novo Modelo de Minuta</span>
            </button>
          </div>
        </div>

        {templates.length > 0 ? (
          <div className="divide-y divide-line border border-line rounded-lg overflow-hidden">
            {templates.map((t) => (
              <div
                key={t.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-surface-sunken/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{t.nome}</span>
                    {!t.ativo && <Badge status="neutro" rotuloPersonalizado="Inativo" />}
                  </div>
                  <span className="text-xs text-ink-muted block">
                    {t.objeto}
                    {t.valorPadrao
                      ? ` · R$ ${Number(t.valorPadrao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirEdicaoTemplate(t)}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
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
          <div className="p-8 text-center border border-dashed border-line rounded-lg space-y-3">
            <p className="text-small text-ink-muted">
              Nenhum modelo cadastrado ainda. Crie o primeiro para poder emitir contratos.
            </p>
            <button
              type="button"
              onClick={abrirNovoTemplate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded hover:bg-primary-hover transition-colors cursor-pointer shadow-xs"
            >
              + Criar Primeiro Modelo de Minuta
            </button>
          </div>
        )}

        {templates.length > 0 && (
          <div className="pt-1 flex justify-start">
            <button
              type="button"
              onClick={abrirNovoTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-line hover:border-primary text-xs font-medium text-ink hover:text-primary transition-all cursor-pointer rounded"
            >
              <span>+</span>
              <span>Adicionar outro modelo de minuta</span>
            </button>
          </div>
        )}

        <div className="p-4 bg-paper border border-line rounded-md space-y-2">
          <span className="text-xs font-mono text-ink font-semibold uppercase">
            Marcadores suportados pelo sistema de emissão:
          </span>
          <div className="flex flex-wrap gap-2 text-xs font-mono text-ink-muted">
            {MARCADORES.map((tag) => (
              <span
                key={tag}
                className="border border-line bg-surface px-2 py-0.5 text-seal select-all rounded-xs"
              >
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
      )}


      {/* GOVERNANÇA LGPD E SEGURANÇA — cosmético, fora do escopo da Fase 2 */}
      {abaAtiva === "seguranca" && (
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
              <strong className="text-ink block">Verificação em duas etapas (2FA / TOTP)</strong>
              <span className="text-xs">
                Camada opcional para a sua conta. Ative num app autenticador.
              </span>
            </div>
            <a
              href="/mfa"
              className="shrink-0 border border-line px-2.5 py-1 text-xs font-medium text-seal hover:border-seal"
            >
              Configurar
            </a>
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
      )}

      {/* ABA: CAMPANHAS & GESTORES (SUPERADMIN) */}
      {abaAtiva === "campanhas" && (
        <section className="border border-line bg-surface p-6">
          <CampanhasSecao campanhasIniciais={campanhasIniciais ?? []} />
        </section>
      )}

      {/* MODAL: EDITAR/CRIAR MODELO */}
      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={templateEmEdicao ? "Editar Modelo de Minuta" : "Novo Modelo de Minuta Contratual"}
        descricao="Defina o identificador, objeto, remuneração padrão e insira os marcadores dinâmicos no corpo do contrato."
        rotuloPrimario={pendente ? "Salvando…" : templateEmEdicao ? "Salvar Alterações" : "Salvar Modelo"}
        acaoPrimaria={() => formRef.current?.requestSubmit()}
        desabilitarConfirmacao={pendente}
      >

        <form
          ref={formRef}
          action={formAction}
          key={templateEmEdicao?.id ?? "novo-modelo"}
          className="space-y-4 text-small"
        >
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
            placeholder="Ex.: Template — Coordenador de Zona"
          />
          <Campo
            rotulo="Objeto / Função Contratual Padrão"
            id="template-objeto"
            name="objeto"
            required
            defaultValue={templateEmEdicao?.objeto ?? ""}
            placeholder="Ex.: Coordenador de Zona Eleitoral e Mobilização"
          />
          <Campo
            rotulo="Valor Padrão (R$) — opcional"
            id="template-valor"
            name="valorPadrao"
            mono
            defaultValue={templateEmEdicao?.valorPadrao ?? ""}
            placeholder="3553.00"
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-small font-medium text-ink">
                Corpo da Minuta Contratual
              </label>
              <button
                type="button"
                onClick={carregarMinutaBase}
                className="text-xs text-primary hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
                title="Carregar minuta jurídica base da campanha com todos os marcadores preenchidos"
              >
                <span>⚡</span>
                <span>Carregar Minuta Padrão Base</span>
              </button>
            </div>
            <textarea
              ref={corpoRef}
              name="corpoHtml"
              rows={9}
              required
              defaultValue={templateEmEdicao?.corpoHtml ?? ""}
              className="w-full border border-line bg-surface-sunken p-3 text-small text-ink outline-none focus:border-primary rounded-md leading-relaxed font-mono text-xs"
              placeholder={"<p>O(a) CONTRATADO(A) {{nome}}, CPF {{cpf}}, com endereço em {{endereco}}...</p>"}
            />
            <div className="mt-2 space-y-1">
              <span className="text-[0.7rem] text-ink-muted block font-mono">
                Clique nos marcadores abaixo para inserir na posição do cursor:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MARCADORES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => inserirMarcador(m)}
                    className="px-2 py-0.5 bg-surface border border-line text-[0.7rem] font-mono text-primary hover:border-primary hover:bg-primary/5 cursor-pointer rounded-xs transition-colors"
                  >
                    + {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
}
