import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

/**
 * Seção 12 (Integração): "RLS com anon key + JWT real: organização A não lê nada de
 * B" e "RLS: coord_regiao da região X não lê pessoa da região Y".
 *
 * Precisa do Custom Access Token Hook habilitado no projeto (Authentication → Hooks)
 * — sem isso o JWT sai sem as claims organizacao_id/papel/regiao_id e todo mundo cai
 * na negação padrão (RLS nega tudo, o que mascararia um teste real de isolamento
 * como um falso positivo). Por isso o teste também afirma que pelo menos uma consulta
 * enxerga alguma coisa — provando que a negação vem da policy, não da ausência da claim.
 */

const SENHA_TESTE = "SenhaDeTeste!123456";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

let orgAId: string;
let orgBId: string;
let regiaoAguasClarasId: string;
let regiaoParanoaId: string;
let pessoaOrgBId: string;
let userAId: string; // auditor, org A
let userBId: string; // auditor, org B
let userCId: string; // coord_regiao, org A, região Águas Claras
let userDId: string; // gestor, org A, SEM TOTP cadastrado (Seção 12: "login sem TOTP recusado para gestor")

async function criarUsuario(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA_TESTE,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar usuário ${email}: ${error?.message}`);
  return data.user.id;
}

async function signIn(email: string) {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: SENHA_TESTE });
  if (error || !data.session) throw new Error(`Falha ao logar ${email}: ${error?.message}`);
  return client;
}

beforeAll(async () => {
  // Organização A: a já semeada (Seção 11).
  const { data: orgA } = await admin
    .from("organizacoes")
    .select("id")
    .eq("nome", "Comitê Michelle — Eleição 2026")
    .single();
  orgAId = orgA!.id;

  const { data: regioes } = await admin
    .from("regioes")
    .select("id, nome")
    .eq("organizacao_id", orgAId);
  regiaoAguasClarasId = regioes!.find((r) => r.nome === "Águas Claras")!.id;
  regiaoParanoaId = regioes!.find((r) => r.nome === "Paranoá")!.id;

  // Organização B: criada só para este teste.
  const { data: orgB } = await admin
    .from("organizacoes")
    .insert({ nome: "RLS Test Org B — descartável", ativa: true })
    .select("id")
    .single();
  orgBId = orgB!.id;

  const { data: regiaoB } = await admin
    .from("regioes")
    .insert({ organizacao_id: orgBId, nome: "Região B" })
    .select("id")
    .single();

  const { data: pessoaB } = await admin
    .from("pessoas")
    .insert({
      organizacao_id: orgBId,
      nome_completo: "Pessoa da Organização B",
      cpf: "52998224725",
      regiao_id: regiaoB!.id,
      apta: true,
    })
    .select("id")
    .single();
  pessoaOrgBId = pessoaB!.id;

  // Três usuários de teste.
  userAId = await criarUsuario("rls-teste-user-a@exemplo.invalid");
  userBId = await criarUsuario("rls-teste-user-b@exemplo.invalid");
  userCId = await criarUsuario("rls-teste-user-c@exemplo.invalid");
  userDId = await criarUsuario("rls-teste-user-d@exemplo.invalid");

  // "auditor" de propósito, não "gestor": gestor/coord_comite exigem aal2 (MFA) pela
  // policy restritiva (Seção 3.1) — um login só de senha, sem desafio de TOTP, cairia
  // nela e negaria tudo, inclusive o próprio dado da organização, misturando o teste
  // de MFA com o de isolamento de organização (que é o que este teste quer isolar).
  await admin.from("usuarios").insert([
    {
      id: userAId,
      organizacao_id: orgAId,
      nome: "Usuário A",
      email: "rls-teste-user-a@exemplo.invalid",
      papel: "auditor",
    },
    {
      id: userBId,
      organizacao_id: orgBId,
      nome: "Usuário B",
      email: "rls-teste-user-b@exemplo.invalid",
      papel: "auditor",
    },
    {
      id: userCId,
      organizacao_id: orgAId,
      nome: "Usuário C",
      email: "rls-teste-user-c@exemplo.invalid",
      papel: "coord_regiao",
      regiao_id: regiaoAguasClarasId,
    },
    {
      id: userDId,
      organizacao_id: orgAId,
      nome: "Usuário D",
      email: "rls-teste-user-d@exemplo.invalid",
      papel: "gestor",
    },
  ]);
}, 30000);

afterAll(async () => {
  await admin
    .from("usuarios")
    .delete()
    .in("id", [userAId, userBId, userCId, userDId].filter(Boolean));
  await admin.auth.admin.deleteUser(userAId).catch(() => {});
  await admin.auth.admin.deleteUser(userBId).catch(() => {});
  await admin.auth.admin.deleteUser(userCId).catch(() => {});
  await admin.auth.admin.deleteUser(userDId).catch(() => {});
  // Sem ON DELETE CASCADE de organizacoes para pessoas/regioes (Seção 5 não pede) —
  // precisa apagar os filhos antes, senão a FK bloqueia o delete da organização.
  if (orgBId) {
    await admin.from("pessoas").delete().eq("organizacao_id", orgBId);
    await admin.from("regioes").delete().eq("organizacao_id", orgBId);
    await admin.from("organizacoes").delete().eq("id", orgBId);
  }
}, 30000);

describe("RLS — isolamento por organização (anon key + JWT real)", () => {
  it("usuário da organização A não lê nenhuma linha da organização B", async () => {
    const clientA = await signIn("rls-teste-user-a@exemplo.invalid");

    const { data: pessoasVisiveis, error } = await clientA.from("pessoas").select("id");
    expect(error).toBeNull();

    const idsVisiveis = (pessoasVisiveis ?? []).map((p) => p.id);
    expect(idsVisiveis).not.toContain(pessoaOrgBId);

    // Prova que a negação vem da policy de organização, não da ausência de claim:
    // o usuário A precisa enxergar alguma coisa da própria organização.
    expect(idsVisiveis.length).toBeGreaterThan(0);
  });

  it("usuário da organização B não lê nenhuma linha da organização A", async () => {
    const clientB = await signIn("rls-teste-user-b@exemplo.invalid");

    const { data: pessoasVisiveis, error } = await clientB.from("pessoas").select("id");
    expect(error).toBeNull();

    const idsVisiveis = (pessoasVisiveis ?? []).map((p) => p.id);
    expect(idsVisiveis).toEqual([pessoaOrgBId]);
  });
});

describe("RLS — coord_regiao só enxerga a própria região", () => {
  it("coord_regiao da região Águas Claras não lê pessoa de Paranoá", async () => {
    const clientC = await signIn("rls-teste-user-c@exemplo.invalid");

    const { data: pessoasVisiveis, error } = await clientC.from("pessoas").select("id, regiao_id");
    expect(error).toBeNull();

    const regioesVisiveis = new Set((pessoasVisiveis ?? []).map((p) => p.regiao_id));
    expect(regioesVisiveis.has(regiaoParanoaId)).toBe(false);

    // Prova que a negação vem da policy de região, não da ausência de claim: o
    // usuário C precisa enxergar alguma pessoa da própria região.
    expect(regioesVisiveis.has(regiaoAguasClarasId)).toBe(true);
  });
});

describe('RLS — MFA obrigatório para gestor (Seção 12: "login sem TOTP recusado")', () => {
  it("gestor sem TOTP cadastrado (aal1) não lê nenhuma linha, nem da própria organização", async () => {
    const clientD = await signIn("rls-teste-user-d@exemplo.invalid");

    const { data: pessoasVisiveis, error } = await clientD.from("pessoas").select("id");
    expect(error).toBeNull();

    // A policy restritiva de MFA nega tudo para gestor/coord_comite sem aal2 — mesmo
    // dado da própria organização fica invisível até o TOTP ser verificado.
    expect(pessoasVisiveis).toEqual([]);
  });
});
