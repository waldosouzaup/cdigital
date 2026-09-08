import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { generateValidCpf } from "@/lib/documentos/cpf";
import { jobVigenciaAVencer } from "@/lib/cron/jobs";
import { negarCronNaoAutorizado } from "@/lib/cron/rota";
import { CRON_RESUMO_DIARIO } from "@/lib/cron/agenda";
import type { EmailTransport } from "@/lib/notificacoes/transporte";

/**
 * Gate da Fase 4 — item 4 (pg_cron + jobs):
 *  - "Rodar o job de vigência duas vezes no mesmo dia envia um único e-mail por contrato."
 *  - "Rota de cron sem CRON_SECRET responde 401."
 *  - "Fuso horário correto: o resumo das 8h de Brasília não sai às 5h nem às 11h."
 *
 * Usa um transporte de e-mail falso (Seção 6, regra 7: não enviar de verdade em
 * teste) e o Supabase real para provar a idempotência de ponta a ponta.
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function transporteFalso(): EmailTransport & { chamadas: number } {
  const obj = {
    chamadas: 0,
    send: vi.fn(async () => {
      obj.chamadas += 1;
      return { ok: true as const, id: `stub-${obj.chamadas}` };
    }),
  };
  return obj as EmailTransport & { chamadas: number };
}

function daqui(dias: number): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(d);
}

const hojeSaoPaulo = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
  new Date(),
);

describe("Fase 4 — gate do item 4 (pg_cron + jobs)", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let contratoId: string;
  let gestorId: string;
  const gestorEmail = "gate-fase4-gestor@exemplo.invalid";

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizacoes")
      .select("id")
      .eq("nome", "Comitê Michelle — Eleição 2026")
      .single();
    orgId = org!.id;

    const { data: regiao } = await admin
      .from("regioes")
      .select("id")
      .eq("organizacao_id", orgId)
      .limit(1)
      .single();
    regiaoId = regiao!.id;

    // Gestor limpo para receber o alerta (não depende de haver gestor no seed).
    const { data: authUser } = await admin.auth.admin.createUser({
      email: gestorEmail,
      password: "SenhaDeTeste!123456",
      email_confirm: true,
    });
    gestorId = authUser!.user!.id;
    await admin.from("usuarios").insert({
      id: gestorId,
      organizacao_id: orgId,
      nome: "Gestor Gate Fase 4",
      email: gestorEmail,
      papel: "gestor",
    });

    const { data: pessoa } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Pessoa Gate Fase 4",
        cpf: generateValidCpf("99887766"),
        regiao_id: regiaoId,
        apta: true,
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    // Contrato assinado que vence em exatamente 7 dias a partir de hoje (São Paulo).
    const { data: contrato } = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        regiao_id: regiaoId,
        objeto: "Gate Fase 4 — vigência",
        valor: "1500.00",
        valor_extenso: "um mil e quinhentos reais",
        vigencia_inicio: hojeSaoPaulo,
        vigencia_fim: daqui(7),
        status: "assinado",
      })
      .select("id")
      .single();
    contratoId = contrato!.id;
  }, 30000);

  afterAll(async () => {
    await admin.from("notificacoes").delete().eq("entidade_id", contratoId);
    await admin.from("contratos").delete().eq("id", contratoId);
    await admin.from("pessoas").delete().eq("id", pessoaId);
    await admin.from("usuarios").delete().eq("id", gestorId);
    await admin.auth.admin.deleteUser(gestorId).catch(() => {});
  }, 30000);

  // Escopo pelo e-mail do gestor de teste: outros arquivos de teste de integração
  // criam/removem usuários na mesma organização em paralelo, então contar "todos
  // os destinatários" seria instável. O que o gate exige — "um único e-mail por
  // contrato, mesmo rodando o job duas vezes" — é provado por destinatário.
  async function notifsDoGestor() {
    const { data } = await admin
      .from("notificacoes")
      .select("id, chave_idempotencia, status")
      .eq("entidade_id", contratoId)
      .eq("tipo", "vigencia_a_vencer")
      .eq("destinatario_email", gestorEmail);
    return data ?? [];
  }

  it("rodar o job de vigência duas vezes no mesmo dia gera um único e-mail por contrato", async () => {
    const transport = transporteFalso();

    const r1 = await jobVigenciaAVencer({ supabase: admin, transport, hoje: hojeSaoPaulo });
    const apos1 = await notifsDoGestor();

    const r2 = await jobVigenciaAVencer({ supabase: admin, transport, hoje: hojeSaoPaulo });
    const apos2 = await notifsDoGestor();

    // A 1ª execução criou exatamente 1 linha para este contrato+gestor.
    expect(apos1).toHaveLength(1);
    expect(r1.enviados).toBeGreaterThanOrEqual(1);

    // A 2ª execução, no mesmo dia, NÃO cria nada novo para este contrato+gestor.
    expect(apos2).toHaveLength(1);
    expect(apos2[0].id).toBe(apos1[0].id);

    // A chave é única por (contrato, prazo, destinatário) e o segundo run a viu como duplicata.
    expect(apos2[0].chave_idempotencia).toMatch(/^vigencia_a_vencer:.+:7d:.+@/);
    expect(r2.duplicados).toBeGreaterThanOrEqual(1);

    // O contrato não muda de estado por causa do alerta.
    const { data: c } = await admin.from("contratos").select("status").eq("id", contratoId).single();
    expect(c!.status).toBe("assinado");
  }, 30000);

  it("rota de cron sem CRON_SECRET responde 401 (JSON, não redirect)", async () => {
    const { POST } = await import("@/app/api/cron/vigencia/route");
    const resposta = await POST(
      new Request("http://localhost/api/cron/vigencia", { method: "POST" }) as never,
    );
    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("content-type")).toContain("application/json");

    // Com o Bearer certo, a barreira deixa passar.
    const segredo = process.env.CRON_SECRET;
    expect(segredo && segredo.length).toBeGreaterThan(0);
    const req = new Request("http://localhost/api/cron/vigencia", {
      method: "POST",
      headers: { authorization: `Bearer ${segredo}` },
    });
    expect(negarCronNaoAutorizado(req)).toBeNull();
  });

  it("fuso: o resumo das 8h de Brasília é agendado para 11:00 UTC — não 5h, não 8h", async () => {
    expect(CRON_RESUMO_DIARIO).toBe("0 11 * * 1-5");

    // E o pg_cron real tem exatamente essa expressão gravada.
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
    try {
      const rows = await sql`SELECT schedule FROM cron.job WHERE jobname = 'comite_resumo_diario'`;
      expect(rows[0]?.schedule).toBe("0 11 * * 1-5");
    } finally {
      await sql.end();
    }
  }, 20000);
});
