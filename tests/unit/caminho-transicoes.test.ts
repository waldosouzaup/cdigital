import { describe, it, expect } from "vitest";
import { buildTransitionPath } from "@/lib/contratos/caminho-transicoes";
import { canTransition, type ContractStatus } from "@/lib/contratos/maquina-estados";

// Usado pelo seed (Seção 11) para avançar um contrato recém-criado até o status
// final, gravando um evento por transição intermediária — igual à aplicação real.
describe("buildTransitionPath", () => {
  it("constrói o caminho direto para emitido", () => {
    expect(buildTransitionPath("rascunho", "emitido")).toEqual(["emitido"]);
  });

  it("constrói o caminho completo até assinado", () => {
    expect(buildTransitionPath("rascunho", "assinado")).toEqual(["emitido", "enviado", "assinado"]);
  });

  it("inclui o estado intermediário 'distratado' ao ir para distrato_assinado", () => {
    // Bug real que este teste existe para prevenir: pular "distratado" e ir direto
    // de "assinado" para "distrato_assinado" é uma transição inválida na máquina de
    // estados (Seção 7) — foi pego ao revisar o seed.ts antes de rodar o gate.
    expect(buildTransitionPath("rascunho", "distrato_assinado")).toEqual([
      "emitido",
      "enviado",
      "assinado",
      "distratado",
      "distrato_assinado",
    ]);
  });

  it("todo passo do caminho gerado é uma transição válida segundo canTransition", () => {
    const alvos: ContractStatus[] = ["emitido", "enviado", "assinado", "distrato_assinado"];
    for (const alvo of alvos) {
      const caminho = buildTransitionPath("rascunho", alvo);
      let atual: ContractStatus = "rascunho";
      for (const proximo of caminho) {
        expect(canTransition(atual, proximo)).toBe(true);
        atual = proximo;
      }
    }
  });

  it("retorna caminho vazio quando origem já é o destino", () => {
    expect(buildTransitionPath("emitido", "emitido")).toEqual([]);
  });

  it("lança erro para alvo não suportado pelo seed (cancelado/encerrado)", () => {
    expect(() => buildTransitionPath("rascunho", "cancelado")).toThrow();
    expect(() => buildTransitionPath("assinado", "encerrado")).toThrow();
  });
});
