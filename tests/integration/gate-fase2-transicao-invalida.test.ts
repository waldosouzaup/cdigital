import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Gate de saída da Fase 2: "Transição inválida (ex.: emitido → assinado) é
 * rejeitada com erro explicativo."
 *
 * A validação em `canTransition` (src/lib/contratos/maquina-estados.ts) já
 * impede isso na camada de aplicação, antes de qualquer chamada de rede — mas
 * achado real ao verificar o gate: a RPC `gravar_transicao_contrato` **por si só**
 * não validava o grafo, só a trava otimista de status. Corrigido na migration 0009
 * (grafo duplicado dentro da própria função SQL) — este teste existe para que essa
 * correção nunca regrida silenciosamente.
 *
 * As chamadas usam `admin` (service_role): desde a migration 0016 a escrita em
 * `contratos` exige `gestor`/`coord_comite` (e portanto `aal2`), então o antigo
 * "usuário autenticado comum" não consegue mais chamar a RPC — a trava de papel é
 * coberta em `gestao-acessos.test.ts`. Aqui o alvo é o grafo de transições.
 */
const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

describe("Gate Fase 2 — a RPC de transição recusa pular estados, mesmo chamada direto", () => {
  let orgId: string;
  let pessoaId: string;
  let contratoId: string;

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizacoes")
      .select("id")
      .eq("nome", "Comitê Michelle — Eleição 2026")
      .single();
    orgId = org!.id;

    const { data: regiao } = await admin.from("regioes").select("id").eq("organizacao_id", orgId).limit(1).single();

    const { data: pessoa } = await admin
      .from("pessoas")
      .insert({ organizacao_id: orgId, nome_completo: "Pessoa Gate Transição", cpf: generateValidCpf("99911122"), regiao_id: regiao!.id })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    const { data: contrato } = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        objeto: "Teste Gate Transição",
        valor: "1500.00",
        valor_extenso: "mil e quinhentos reais",
        vigencia_inicio: "2026-09-01",
        vigencia_fim: "2026-10-03",
        status: "emitido",
      })
      .select("id")
      .single();
    contratoId = contrato!.id;
  }, 30000);

  afterAll(async () => {
    await admin.from("eventos_contrato").delete().eq("contrato_id", contratoId);
    await admin.from("contratos").delete().eq("id", contratoId);
    await admin.from("pessoas").delete().eq("id", pessoaId);
  }, 30000);

  it("recusa emitido -> assinado (pulando 'enviado') com erro explicativo, sem gravar evento nem mudar o status", async () => {
    const { error } = await admin.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "emitido",
      p_status_novo: "assinado",
      p_observacao: "Tentativa de pular estados.",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/[Tt]ransição inválida/);
    expect(error?.message).toMatch(/emitido/);
    expect(error?.message).toMatch(/assinado/);

    const { data: contrato } = await admin.from("contratos").select("status").eq("id", contratoId).single();
    expect(contrato?.status).toBe("emitido");

    const { data: eventos } = await admin.from("eventos_contrato").select("id").eq("contrato_id", contratoId);
    expect(eventos).toHaveLength(0);
  });

  it("a transição válida correspondente (emitido -> enviado) continua funcionando", async () => {
    const { error } = await admin.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "emitido",
      p_status_novo: "enviado",
      p_observacao: "Transição válida.",
    });
    expect(error).toBeNull();

    const { data: contrato } = await admin.from("contratos").select("status").eq("id", contratoId).single();
    expect(contrato?.status).toBe("enviado");
  });
});
