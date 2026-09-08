import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";
import { validarRegistroAtividade } from "@/lib/atividades/registro-rapido";

/**
 * Fase 4, item 1 — grava em `registros_atividade` com a RLS do usuário.
 *
 * Prova algo que nenhum teste anterior exercia: a policy de
 * `registros_atividade` (`organizationAndRegionPolicy`, Fase 1) de fato permite
 * INSERT/SELECT por um `coord_regiao` na própria região e **recusa** gravar na
 * região alheia — item de gate transversal ("coord_regiao nunca vê/mexe em outra
 * região, por nenhum caminho").
 */
const SENHA = "SenhaDeTeste!123456";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

describe("Fase 4 — registro de atividade com RLS por região", () => {
  let orgId: string;
  let regiaoAId: string;
  let regiaoBId: string;
  let pessoaAId: string;
  let pessoaBId: string;
  let coordId: string;
  const coordEmail = "fase4-atividade-coord@exemplo.invalid";
  const registrosCriados: string[] = [];

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizacoes")
      .select("id")
      .eq("nome", "Comitê Michelle — Eleição 2026")
      .single();
    orgId = org!.id;

    const { data: regioes } = await admin
      .from("regioes")
      .select("id, nome")
      .eq("organizacao_id", orgId)
      .order("nome")
      .limit(2);
    regiaoAId = regioes![0].id;
    regiaoBId = regioes![1].id;

    const inserirPessoa = async (regiaoId: string, sufixo: string) => {
      const { data } = await admin
        .from("pessoas")
        .insert({
          organizacao_id: orgId,
          nome_completo: `Pessoa Atividade ${sufixo}`,
          cpf: generateValidCpf(`5566778${sufixo}`),
          regiao_id: regiaoId,
          apta: true,
        })
        .select("id")
        .single();
      return data!.id as string;
    };
    pessoaAId = await inserirPessoa(regiaoAId, "1");
    pessoaBId = await inserirPessoa(regiaoBId, "2");

    const { data: authUser } = await admin.auth.admin.createUser({
      email: coordEmail,
      password: SENHA,
      email_confirm: true,
    });
    coordId = authUser!.user!.id;
    await admin.from("usuarios").insert({
      id: coordId,
      organizacao_id: orgId,
      nome: "Coord Região A (teste)",
      email: coordEmail,
      papel: "coord_regiao",
      regiao_id: regiaoAId,
    });
  }, 30000);

  afterAll(async () => {
    if (registrosCriados.length) {
      await admin.from("registros_atividade").delete().in("id", registrosCriados);
    }
    await admin.from("log_auditoria").delete().eq("usuario_id", coordId);
    await admin.from("pessoas").delete().in("id", [pessoaAId, pessoaBId]);
    await admin.from("usuarios").delete().eq("id", coordId);
    await admin.auth.admin.deleteUser(coordId).catch(() => {});
  }, 30000);

  it("a validação pura aceita o registro que a tela envia", () => {
    const r = validarRegistroAtividade(
      { pessoaId: pessoaAId, regiaoId: regiaoAId, tipo: "Panfletagem", quantidade: "800", data: "2026-09-08" },
      "2026-09-08",
    );
    expect(r.ok).toBe(true);
  });

  it("coord_regiao grava atividade na própria região", async () => {
    const cli = anon();
    await cli.auth.signInWithPassword({ email: coordEmail, password: SENHA });

    const { data, error } = await cli
      .from("registros_atividade")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaAId,
        regiao_id: regiaoAId,
        data: "2026-09-08",
        tipo: "Panfletagem",
        quantidade: 800,
        sincronizado_em: new Date().toISOString(),
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    if (data?.id) registrosCriados.push(data.id);
  });

  it("coord_regiao NÃO consegue gravar atividade em outra região (RLS with check)", async () => {
    const cli = anon();
    await cli.auth.signInWithPassword({ email: coordEmail, password: SENHA });

    const { data, error } = await cli
      .from("registros_atividade")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaBId,
        regiao_id: regiaoBId,
        data: "2026-09-08",
        tipo: "Mobilização de feira",
        quantidade: 300,
        sincronizado_em: new Date().toISOString(),
      })
      .select("id");

    expect(error).not.toBeNull(); // violação de RLS
    expect(data).toBeNull();
  });

  it("coord_regiao só enxerga na leitura as atividades da própria região", async () => {
    // semeia uma atividade na região B pelo admin (bypassa RLS)
    const { data: regB } = await admin
      .from("registros_atividade")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaBId,
        regiao_id: regiaoBId,
        data: "2026-09-08",
        tipo: "Caminhada / bandeiraço",
        quantidade: 120,
      })
      .select("id")
      .single();
    registrosCriados.push(regB!.id);

    const cli = anon();
    await cli.auth.signInWithPassword({ email: coordEmail, password: SENHA });
    const { data } = await cli.from("registros_atividade").select("id, regiao_id");

    const regioesVistas = new Set((data ?? []).map((r) => r.regiao_id));
    expect(regioesVistas.has(regiaoBId)).toBe(false);
  });
});
