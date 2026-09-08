import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Fase 2, item 1: "CPF duplicado na mesma organização exibe o registro existente em
 * vez de criar outro." A Server Action (`(painel)/pessoas/acoes.ts`) faz a checagem
 * prévia por SELECT — o teste aqui prova a rede de segurança final contra corrida:
 * o índice único `(organizacao_id, cpf)` (Seção 5) recusa a segunda linha com erro
 * tratado (código 23505), não com um 500/stack trace.
 *
 * Roda com a service_role direto contra a tabela porque o que se quer provar é a
 * constraint do banco, não RLS — isolamento por organização já é coberto em
 * `rls-isolamento.test.ts`.
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

describe("Fase 2 — CPF duplicado na mesma organização", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string | undefined;
  // Determinístico e improvável de colidir com o CPF sintético de alguém do seed real.
  const cpfTeste = generateValidCpf("99988877");

  afterAll(async () => {
    if (pessoaId) await admin.from("pessoas").delete().eq("id", pessoaId);
  });

  it("insere a primeira pessoa com este CPF normalmente", async () => {
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

    const { data, error } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Pessoa Teste Duplicata (Fase 2)",
        cpf: cpfTeste,
        regiao_id: regiaoId,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    pessoaId = data?.id;
  });

  it("recusa o mesmo CPF na mesma organização com erro tratado, não stack trace", async () => {
    const { data, error } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Outra Pessoa Com o Mesmo CPF",
        cpf: cpfTeste,
        regiao_id: regiaoId,
      })
      .select("id")
      .single();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // 23505 = unique_violation no Postgres — é este código que a Server Action lê
    // para devolver "duplicada" em vez de deixar o erro genérico subir.
    expect(error?.code).toBe("23505");
  });
});
