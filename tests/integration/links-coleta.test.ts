import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { gerarTokenColeta } from "@/lib/coleta/token";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Fase 2, item 2: "/coleta/[token] — sem login, validade configurável, expiração no
 * uso." As duas funções SECURITY DEFINER (migration 0005) são chamadas aqui pelo
 * cliente **anon**, exatamente como a página pública faz — sem sessão, sem JWT com
 * organizacao_id. Se elas dependessem de RLS comum, este teste veria tudo negado.
 */
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

interface ResultadoValidarLink {
  pessoa_id: string;
  primeiro_nome: string;
  organizacao_nome: string;
  expira_em: string;
}

describe("Fase 2 — links_coleta (acesso público via SECURITY DEFINER)", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let tokenValido: string;
  let tokenExpirado: string;

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

    const { data: pessoa } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Fulano de Tal Teste Coleta",
        cpf: generateValidCpf("11223344"),
        regiao_id: regiaoId,
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    tokenValido = gerarTokenColeta();
    tokenExpirado = gerarTokenColeta();

    await admin.from("links_coleta").insert([
      {
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        token: tokenValido,
        expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        token: tokenExpirado,
        expira_em: new Date(Date.now() - 1000).toISOString(), // já expirado
      },
    ]);
  }, 30000);

  afterAll(async () => {
    await admin.from("links_coleta").delete().in("token", [tokenValido, tokenExpirado]);
    if (pessoaId) await admin.from("pessoas").delete().eq("id", pessoaId);
  }, 30000);

  it("valida um token válido e devolve só o primeiro nome + organização", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .rpc("validar_link_coleta", { p_token: tokenValido })
      .maybeSingle<ResultadoValidarLink>();

    expect(error).toBeNull();
    expect(data?.primeiro_nome).toBe("Fulano");
    expect(data?.organizacao_nome).toBe("Comitê Michelle — Eleição 2026");
  });

  it("recusa um token expirado", async () => {
    const anon = anonClient();
    const { data } = await anon
      .rpc("validar_link_coleta", { p_token: tokenExpirado })
      .maybeSingle<ResultadoValidarLink>();

    expect(data).toBeNull();
  });

  it("recusa um token inexistente", async () => {
    const anon = anonClient();
    const { data } = await anon
      .rpc("validar_link_coleta", { p_token: "token-que-nunca-existiu" })
      .maybeSingle<ResultadoValidarLink>();

    expect(data).toBeNull();
  });

  it("grava os dados complementares e marca o link como usado", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("enviar_dados_coleta", {
      p_token: tokenValido,
      p_telefone: "(61) 99999-0000",
      p_endereco: "Rua Teste, 123",
      p_cep: "70000-000",
      p_rg: "1234567",
      p_data_nascimento: "1990-01-01",
      p_chave_pix: "fulano-pix@exemplo.invalid",
      p_email: "fulano-teste-coleta@exemplo.invalid",
    });

    expect(error).toBeNull();
    expect(data).toBe(true);

    const { data: pessoaAtualizada } = await admin
      .from("pessoas")
      .select("telefone, chave_pix")
      .eq("id", pessoaId)
      .single();
    expect(pessoaAtualizada?.telefone).toBe("(61) 99999-0000");
    expect(pessoaAtualizada?.chave_pix).toBe("fulano-pix@exemplo.invalid");
  });

  it("recusa reenvio pelo mesmo link (expiração no uso)", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("enviar_dados_coleta", {
      p_token: tokenValido,
      p_telefone: "(61) 98888-1111",
      p_endereco: null,
      p_cep: null,
      p_rg: null,
      p_data_nascimento: null,
      p_chave_pix: null,
      p_email: null,
    });

    expect(error).toBeNull();
    expect(data).toBe(false);

    // Prova que o segundo envio não sobrescreveu o telefone do primeiro.
    const { data: pessoaFinal } = await admin
      .from("pessoas")
      .select("telefone")
      .eq("id", pessoaId)
      .single();
    expect(pessoaFinal?.telefone).toBe("(61) 99999-0000");
  });
});
