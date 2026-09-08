import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { generateValidCpf } from "@/lib/documentos/cpf";
import { lerPlanilhaPessoas } from "@/lib/pessoas/ler-planilha";
import { analisarLinhas } from "@/lib/pessoas/analisar-planilha";

/**
 * Fase 4, item 7 — gate: "Importação de planilha com 2 CPFs repetidos sinaliza os
 * 2 antes de gravar."
 *
 * Exercita o caminho real de ponta a ponta sem a Server Action (que precisa de
 * `cookies()`): monta um .xlsx de verdade, lê com `lerPlanilhaPessoas`, e analisa
 * com `analisarLinhas` usando os CPFs realmente já cadastrados no Supabase. Nada
 * é gravado.
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const cpfRepetido = generateValidCpf("12312312");
const cpfUnico = generateValidCpf("45645645");
const cpfInvalido = "111.111.111-11";

let orgId: string;
let pessoaExistenteId: string;
let cpfJaCadastrado: string;

beforeAll(async () => {
  const { data: org } = await admin
    .from("organizacoes")
    .select("id")
    .eq("nome", "Comitê Michelle — Eleição 2026")
    .single();
  orgId = org!.id;

  cpfJaCadastrado = generateValidCpf("78978978");
  const { data: pessoa } = await admin
    .from("pessoas")
    .insert({
      organizacao_id: orgId,
      nome_completo: "Pessoa Já Cadastrada Import",
      cpf: cpfJaCadastrado.replace(/\D/g, ""),
    })
    .select("id")
    .single();
  pessoaExistenteId = pessoa!.id;
});

afterAll(async () => {
  await admin.from("pessoas").delete().eq("id", pessoaExistenteId);
});

async function montarPlanilha(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("cadastro");
  ws.addRow(["Nome Completo", "CPF", "Região"]);
  ws.addRow(["Ana Primeira", cpfRepetido, "Gama"]);
  ws.addRow(["Bruno Único", cpfUnico, "Gama"]);
  ws.addRow(["Ana De Novo", cpfRepetido, "Gama"]); // MESMO CPF da linha 2
  ws.addRow(["Carlos Ilegível", cpfInvalido, "Gama"]);
  ws.addRow(["Dora Já Existe", cpfJaCadastrado, "Gama"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("Fase 4 — importação de planilha em lote", () => {
  it("sinaliza AS DUAS linhas do CPF repetido, a ilegível e a já cadastrada — antes de gravar", async () => {
    const linhas = await lerPlanilhaPessoas(await montarPlanilha());
    expect(linhas.map((l) => l.linha)).toEqual([2, 3, 4, 5, 6]);

    const { data: existentes } = await admin
      .from("pessoas")
      .select("cpf")
      .eq("organizacao_id", orgId);
    const cpfsExistentes = new Set((existentes ?? []).map((p) => p.cpf.replace(/\D/g, "")));

    const r = analisarLinhas(linhas, cpfsExistentes);

    // As duas ocorrências do CPF repetido (linhas 2 e 4) são sinalizadas.
    expect(r.duplicatas.map((l) => l.linha).sort()).toEqual([2, 4, 6]);
    expect(r.duplicatas.filter((l) => l.linha === 2 || l.linha === 4)).toHaveLength(2);

    // A já cadastrada (linha 6) também é duplicata, por outro motivo.
    expect(r.duplicatas.find((l) => l.linha === 6)?.motivo).toMatch(/já cadastrad/i);

    // A ilegível (linha 5) fica separada.
    expect(r.invalidos.map((l) => l.linha)).toEqual([5]);

    // Só a linha 3 (CPF único e válido) está pronta para gravar.
    expect(r.validos.map((l) => l.linha)).toEqual([3]);

    // Nada foi gravado: a contagem de pessoas com esses CPFs novos é zero.
    const { count } = await admin
      .from("pessoas")
      .select("id", { count: "exact", head: true })
      .in("cpf", [cpfRepetido.replace(/\D/g, ""), cpfUnico.replace(/\D/g, "")]);
    expect(count ?? 0).toBe(0);
  }, 30000);
});
