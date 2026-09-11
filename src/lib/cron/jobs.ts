/**
 * Núcleo dos jobs de `pg_cron` (Fase 4, item 4), com `supabase` e `transport`
 * injetados — mesmo desenho de `sendNotification`/`reprocessarNotificacoesFalhas`.
 * As rotas `/api/cron/*` são cascas finas: checam a `CRON_SECRET`, montam o
 * cliente admin + o transporte real e chamam uma destas funções.
 *
 * Testável contra o Supabase real com um transporte de e-mail falso — é assim que
 * o gate ("job de vigência duas vezes = um único e-mail por contrato") é provado
 * sem enviar e-mail de verdade (Seção 6, regra 7).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailTransport } from "@/lib/notificacoes/transporte";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { contratosAVencer, contratosParaLembrete, ehDiaUtil } from "./selecao";
import { baseUrlApp, primeiroNome } from "./rota";
import { renderizarEmailVigenciaAVencer } from "@/emails/vigencia-a-vencer";
import { renderizarEmailLembreteAssinatura } from "@/emails/lembrete-assinatura";
import { renderizarEmailResumoDiario } from "@/emails/resumo-diario";

const PRAZOS_VIGENCIA_DIAS = [7, 3];
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Soma (ou subtrai) dias a uma data YYYY-MM-DD, devolvendo YYYY-MM-DD (UTC). */
function somarDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

interface DepsBase {
  supabase: SupabaseClient;
  transport: EmailTransport;
}

// ---------------------------------------------------------------------------
// manter_banco_ativo
// ---------------------------------------------------------------------------

export interface ResultadoManterBancoAtivo {
  ok: true;
  verificadoEm: string;
}

/**
 * Não envia nada, não tem regra de negócio — o único propósito deste job é
 * gerar, todo dia, uma chamada real à API do Supabase vinda de fora do banco
 * (via `/api/cron/*`, mesmo caminho dos outros jobs). `pg_cron`/`pg_net`
 * sozinhos, de dentro do Postgres, não contam como "atividade" para o
 * Supabase decidir não pausar o projeto por inatividade — só uma requisição
 * externa conta. `head: true` evita trazer qualquer linha: é a consulta mais
 * barata que ainda é, de fato, uma chamada à API.
 */
export async function jobManterBancoAtivo(deps: {
  supabase: SupabaseClient;
}): Promise<ResultadoManterBancoAtivo> {
  const { error } = await deps.supabase
    .from("organizacoes")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error("falha ao pingar o banco");

  return { ok: true, verificadoEm: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// vigencia_a_vencer
// ---------------------------------------------------------------------------

export interface ResultadoVigencia {
  referencia: string;
  contratosAVencer: number;
  enviados: number;
  duplicados: number;
  semDestinatario: number;
}

export async function jobVigenciaAVencer(
  deps: DepsBase & { hoje: string },
): Promise<ResultadoVigencia> {
  const { supabase, transport, hoje } = deps;

  // Janela estreita: só interessa quem vence dentro do maior prazo. Sem isso a
  // consulta traria milhares de contratos ativos e bateria no teto de linhas do
  // PostgREST.
  const janelaFim = somarDias(hoje, Math.max(...PRAZOS_VIGENCIA_DIAS));
  const { data: contratos, error } = await supabase
    .from("contratos")
    .select("id, organizacao_id, objeto, status, vigencia_fim")
    .in("status", ["emitido", "enviado", "assinado"])
    .gte("vigencia_fim", hoje)
    .lte("vigencia_fim", janelaFim);
  if (error) throw new Error("falha ao ler contratos");

  const aVencer = contratosAVencer(
    (contratos ?? []).map((c) => ({ id: c.id, status: c.status, vigenciaFim: c.vigencia_fim })),
    hoje,
    PRAZOS_VIGENCIA_DIAS,
  );

  const { data: destinatarios } = await supabase
    .from("usuarios")
    .select("email, organizacao_id, papel")
    .in("papel", ["gestor", "coord_comite"]);

  const urlLista = `${baseUrlApp()}/contratos`;
  let enviados = 0;
  let duplicados = 0;
  let semDestinatario = 0;

  for (const { contratoId, prazo } of aVencer) {
    const contrato = (contratos ?? []).find((c) => c.id === contratoId)!;
    const alvos = (destinatarios ?? []).filter(
      (u) => u.organizacao_id === contrato.organizacao_id && u.email,
    );
    if (alvos.length === 0) {
      semDestinatario += 1;
      continue;
    }

    const email = await renderizarEmailVigenciaAVencer({
      objeto: contrato.objeto,
      diasRestantes: prazo,
      urlLista,
    });

    for (const alvo of alvos) {
      const r = await sendNotification({
        supabase,
        transport,
        organizationId: contrato.organizacao_id,
        type: "vigencia_a_vencer",
        recipientEmail: alvo.email,
        entity: "contratos",
        entityId: contratoId,
        idempotencyKey: idempotencyKey("vigencia_a_vencer", contratoId, `${prazo}d`, alvo.email),
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (r.sent) enviados += 1;
      else if (r.reason === "duplicate") duplicados += 1;
    }
  }

  return {
    referencia: hoje,
    contratosAVencer: aVencer.length,
    enviados,
    duplicados,
    semDestinatario,
  };
}

// ---------------------------------------------------------------------------
// lembrete_assinatura
// ---------------------------------------------------------------------------

export interface ResultadoLembrete {
  referencia: string;
  lembretes: number;
  enviadosContratado: number;
  enviadosCoordenador: number;
  duplicados: number;
}

export async function jobLembreteAssinatura(
  deps: DepsBase & { hoje: string },
): Promise<ResultadoLembrete> {
  const { supabase, transport, hoje } = deps;

  // Só quem está em `enviado` há ~3 dias interessa — janela curta evita o teto de
  // linhas do PostgREST sobre todos os contratos enviados da base.
  const janelaInicio = `${somarDias(hoje, -5)}T00:00:00Z`;
  const janelaFim = `${somarDias(hoje, -2)}T23:59:59Z`;
  const { data: contratos, error } = await supabase
    .from("contratos")
    .select(
      "id, organizacao_id, objeto, status, enviado_em, regiao_id, pessoas ( nome_completo, email )",
    )
    .eq("status", "enviado")
    .gte("enviado_em", janelaInicio)
    .lte("enviado_em", janelaFim);
  if (error) throw new Error("falha ao ler contratos");

  const idsParaLembrar = new Set(
    contratosParaLembrete(
      (contratos ?? []).map((c) => ({ id: c.id, status: c.status, enviadoEm: c.enviado_em })),
      hoje,
    ),
  );

  const urlContato = baseUrlApp();
  const urlLista = `${baseUrlApp()}/contratos`;
  let enviadosContratado = 0;
  let enviadosCoordenador = 0;
  let duplicados = 0;

  for (const contrato of contratos ?? []) {
    if (!idsParaLembrar.has(contrato.id)) continue;

    const pessoaBruta = contrato.pessoas as unknown;
    const pessoa = (Array.isArray(pessoaBruta) ? pessoaBruta[0] : pessoaBruta) as
      { nome_completo: string; email: string | null } | null | undefined;
    const nome = primeiroNome(pessoa?.nome_completo);

    if (pessoa?.email) {
      const email = await renderizarEmailLembreteAssinatura({
        primeiroNome: nome,
        objeto: contrato.objeto,
        urlContato,
      });
      const r = await sendNotification({
        supabase,
        transport,
        organizationId: contrato.organizacao_id,
        type: "lembrete_assinatura",
        recipientEmail: pessoa.email,
        entity: "contratos",
        entityId: contrato.id,
        idempotencyKey: idempotencyKey("lembrete_assinatura", contrato.id),
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (r.sent) enviadosContratado += 1;
      else if (r.reason === "duplicate") duplicados += 1;
    }

    const { data: coords } = await supabase
      .from("usuarios")
      .select("email, papel, regiao_id")
      .eq("organizacao_id", contrato.organizacao_id)
      .in("papel", ["coord_regiao", "coord_comite"]);

    const coord =
      (coords ?? []).find(
        (u) => u.papel === "coord_regiao" && u.regiao_id === contrato.regiao_id,
      ) ?? (coords ?? []).find((u) => u.papel === "coord_comite");

    if (coord?.email) {
      const email = await renderizarEmailLembreteAssinatura({
        primeiroNome: nome,
        objeto: contrato.objeto,
        urlContato: urlLista,
        paraCoordenador: true,
      });
      const r = await sendNotification({
        supabase,
        transport,
        organizationId: contrato.organizacao_id,
        type: "lembrete_assinatura",
        recipientEmail: coord.email,
        entity: "contratos",
        entityId: contrato.id,
        idempotencyKey: idempotencyKey("lembrete_assinatura", contrato.id, "coord"),
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (r.sent) enviadosCoordenador += 1;
      else if (r.reason === "duplicate") duplicados += 1;
    }
  }

  return {
    referencia: hoje,
    lembretes: idsParaLembrar.size,
    enviadosContratado,
    enviadosCoordenador,
    duplicados,
  };
}

// ---------------------------------------------------------------------------
// resumo_diario
// ---------------------------------------------------------------------------

export interface ResultadoResumo {
  referencia: string;
  pulado?: string;
  enviados: number;
  duplicados: number;
}

async function contarDesde(
  supabase: SupabaseClient,
  tabela: string,
  organizacaoId: string,
  coluna: string,
  desdeIso: string,
): Promise<number> {
  const { count } = await supabase
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .eq("organizacao_id", organizacaoId)
    .gte(coluna, desdeIso);
  return count ?? 0;
}

export async function jobResumoDiario(deps: DepsBase & { agora: Date }): Promise<ResultadoResumo> {
  const { supabase, transport, agora } = deps;
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);

  if (!ehDiaUtil(hoje)) {
    return { referencia: hoje, pulado: "fim de semana", enviados: 0, duplicados: 0 };
  }

  const desde = new Date(agora.getTime() - MS_POR_DIA).toISOString();
  const urlPainel = `${baseUrlApp()}/dashboard`;

  const { data: orgs, error } = await supabase.from("organizacoes").select("id").eq("ativa", true);
  if (error) throw new Error("falha ao ler organizações");

  let enviados = 0;
  let duplicados = 0;

  for (const org of orgs ?? []) {
    const [pessoasNovas, contratosEmitidos, contratosAssinados] = await Promise.all([
      contarDesde(supabase, "pessoas", org.id, "criado_em", desde),
      contarDesde(supabase, "contratos", org.id, "emitido_em", desde),
      contarDesde(supabase, "contratos", org.id, "assinado_em", desde),
    ]);

    const { count: transicoesCount } = await supabase
      .from("eventos_contrato")
      .select("id, contratos!inner(organizacao_id)", { count: "exact", head: true })
      .eq("contratos.organizacao_id", org.id)
      .gte("ocorrido_em", desde);

    const { count: notificacoesComFalha } = await supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("organizacao_id", org.id)
      .eq("status", "falhou");

    const { data: gestores } = await supabase
      .from("usuarios")
      .select("email")
      .eq("organizacao_id", org.id)
      .eq("papel", "gestor");
    if (!gestores || gestores.length === 0) continue;

    const email = await renderizarEmailResumoDiario({
      dataReferencia: hoje,
      numeros: {
        pessoasNovas,
        contratosEmitidos,
        contratosAssinados,
        transicoes: transicoesCount ?? 0,
        notificacoesComFalha: notificacoesComFalha ?? 0,
      },
      urlPainel,
    });

    for (const gestor of gestores) {
      if (!gestor.email) continue;
      const r = await sendNotification({
        supabase,
        transport,
        organizationId: org.id,
        type: "resumo_diario",
        recipientEmail: gestor.email,
        entity: "organizacoes",
        entityId: org.id,
        idempotencyKey: idempotencyKey("resumo_diario", org.id, hoje, gestor.email),
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (r.sent) enviados += 1;
      else if (r.reason === "duplicate") duplicados += 1;
    }
  }

  return { referencia: hoje, enviados, duplicados };
}
