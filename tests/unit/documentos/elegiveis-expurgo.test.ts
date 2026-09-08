import { describe, it, expect } from "vitest";
import { documentosParaExpurgo, dataLiberacaoExpurgo } from "@/lib/documentos/elegiveis-expurgo";

/**
 * Fase 4, item 6 — "política de retenção com expurgo de documentos pessoais ao
 * fim da campanha". Lógica pura: dado o fim da campanha e uma carência (retenção
 * legal/fiscal), diz quais documentos já podem ser expurgados hoje. A ação de
 * expurgo em si (delete no Storage + registro) usa isto para saber o que apagar.
 */
const FIM_CAMPANHA = "2026-10-03";

function doc(id: string, expurgadoEm: string | null = null) {
  return { id, criadoEm: "2026-09-10T12:00:00Z", expurgadoEm };
}

describe("dataLiberacaoExpurgo", () => {
  it("é o fim da campanha somado à carência", () => {
    expect(dataLiberacaoExpurgo("2026-10-03", 180)).toBe("2027-04-01");
    expect(dataLiberacaoExpurgo("2026-10-03", 0)).toBe("2026-10-03");
  });
});

describe("documentosParaExpurgo", () => {
  it("não libera nada antes de a carência terminar", () => {
    const res = documentosParaExpurgo([doc("a"), doc("b")], FIM_CAMPANHA, 180, "2026-12-01");
    expect(res).toEqual([]);
  });

  it("libera todos os documentos não expurgados na data de liberação ou depois", () => {
    const res = documentosParaExpurgo(
      [doc("a"), doc("b"), doc("c")],
      FIM_CAMPANHA,
      180,
      "2027-04-01",
    );
    expect(res).toEqual(["a", "b", "c"]);
  });

  it("nunca re-expurga um documento já expurgado", () => {
    const res = documentosParaExpurgo(
      [doc("a"), doc("b", "2027-04-02T09:00:00Z")],
      FIM_CAMPANHA,
      180,
      "2027-05-01",
    );
    expect(res).toEqual(["a"]);
  });

  it("carência zero libera exatamente no dia do fim da campanha", () => {
    expect(documentosParaExpurgo([doc("a")], FIM_CAMPANHA, 0, "2026-10-03")).toEqual(["a"]);
    expect(documentosParaExpurgo([doc("a")], FIM_CAMPANHA, 0, "2026-10-02")).toEqual([]);
  });
});
