import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Feature A — Gestão de Acessos (migration 0016).
 *
 * Verifica no banco real:
 *   - `usuarios_select`: um não-gestor da organização continua LENDO usuarios
 *     (o custom_access_token_hook e o disparo de `pessoa_apta` dependem disso);
 *   - `usuarios_update_gestor` / `usuarios_insert_gestor`: um não-gestor NÃO
 *     escreve usuarios (antes da 0016 a policy era `FOR ALL` sem trava de papel);
 *   - o hook passa a filtrar `ativo IS TRUE`: usuário desativado loga mas recebe
 *     um JWT sem claims e não enxerga nada.
 *
 * Precisa do Custom Access Token Hook habilitado no projeto. Papéis de teste são
 * `auditor`/`coord_regiao` (aal1) — `gestor` cairia na restritiva de MFA e
 * confundiria o teste (ver tests/integration/rls-isolamento.test.ts).
 */
const SENHA_TESTE = "SenhaDeTeste!123456";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

let orgId: string;
let auditorId: string;
let coordId: string;
let inativoId: string;

async function criarAuth(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA_TESTE,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar ${email}: ${error?.message}`);
  return data.user.id;
}

async function signIn(email: string) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: SENHA_TESTE });
  if (error || !data.session) throw new Error(`Falha ao logar ${email}: ${error?.message}`);
  return client;
}

beforeAll(async () => {
  const { data: org } = await admin
    .from("organizacoes")
    .select("id")
    .eq("nome", "Comitê Michelle — Eleição 2026")
    .single();
  orgId = org!.id;

  auditorId = await criarAuth("acessos-teste-auditor@exemplo.invalid");
  coordId = await criarAuth("acessos-teste-coord@exemplo.invalid");
  inativoId = await criarAuth("acessos-teste-inativo@exemplo.invalid");

  const { data: regioes } = await admin.from("regioes").select("id").eq("organizacao_id", orgId);

  // `ativo` explícito em TODAS as linhas: no insert em lote o PostgREST usa a união
  // das chaves e manda `null` para as que não a têm — e `usuarios.ativo` é NOT NULL
  // (migration 0016), o que faria o lote inteiro falhar.
  const { error: erroInsert } = await admin.from("usuarios").insert([
    {
      id: auditorId,
      organizacao_id: orgId,
      nome: "Acessos Auditor",
      email: "acessos-teste-auditor@exemplo.invalid",
      papel: "auditor",
      regiao_id: null,
      ativo: true,
    },
    {
      id: coordId,
      organizacao_id: orgId,
      nome: "Acessos Coord",
      email: "acessos-teste-coord@exemplo.invalid",
      papel: "coord_regiao",
      regiao_id: regioes![0].id,
      ativo: true,
    },
    {
      id: inativoId,
      organizacao_id: orgId,
      nome: "Acessos Inativo",
      email: "acessos-teste-inativo@exemplo.invalid",
      papel: "auditor",
      regiao_id: null,
      ativo: false,
    },
  ]);
  if (erroInsert) throw new Error(`Falha ao inserir usuarios de teste: ${erroInsert.message}`);
}, 30000);

afterAll(async () => {
  await admin.from("usuarios").delete().in("id", [auditorId, coordId, inativoId].filter(Boolean));
  for (const id of [auditorId, coordId, inativoId]) {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}, 30000);

describe("usuarios — leitura preservada para todos da organização", () => {
  it("um auditor lê usuarios da própria organização (usuarios_select)", async () => {
    const client = await signIn("acessos-teste-auditor@exemplo.invalid");
    const { data, error } = await client.from("usuarios").select("id, papel");
    expect(error).toBeNull();
    const ids = (data ?? []).map((u) => u.id);
    expect(ids).toContain(auditorId);
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe("usuarios — escrita exclusiva do gestor", () => {
  it("um auditor NÃO consegue alterar uma linha de usuarios", async () => {
    const client = await signIn("acessos-teste-auditor@exemplo.invalid");
    const { data } = await client
      .from("usuarios")
      .update({ nome: "NOME ALTERADO INDEVIDAMENTE" })
      .eq("id", coordId)
      .select("id");
    // A policy de UPDATE só passa para gestor — a RLS filtra a linha e nada muda.
    expect(data ?? []).toHaveLength(0);

    const { data: conferido } = await admin
      .from("usuarios")
      .select("nome")
      .eq("id", coordId)
      .single();
    expect(conferido!.nome).toBe("Acessos Coord");
  });

  it("um coord_regiao NÃO consegue inserir usuarios", async () => {
    const client = await signIn("acessos-teste-coord@exemplo.invalid");
    const { error } = await client.from("usuarios").insert({
      id: coordId, // id qualquer — a RLS recusa antes de qualquer efeito
      organizacao_id: orgId,
      nome: "Intruso",
      email: "intruso@exemplo.invalid",
      papel: "gestor",
    });
    expect(error).not.toBeNull();
  });
});

describe("hook do access token — usuario desativado", () => {
  it("usuário com ativo=false loga mas recebe JWT sem claims e não lê nada", async () => {
    const client = await signIn("acessos-teste-inativo@exemplo.invalid");

    const { data: claimsData } = await client.auth.getClaims();
    const claims = (claimsData?.claims ?? {}) as Record<string, unknown>;
    expect(claims.papel).toBeUndefined();
    expect(claims.organizacao_id).toBeUndefined();

    const { data: usuarios } = await client.from("usuarios").select("id");
    expect(usuarios ?? []).toHaveLength(0);

    const { data: pessoas } = await client.from("pessoas").select("id");
    expect(pessoas ?? []).toHaveLength(0);
  });
});
