import { describe, expect, it } from "vitest";
import {
  computarFunil,
  computarMatrizObjetoStatus,
  computarResumoRegional,
} from "@/lib/dashboard/agregacoes";

/**
 * Fase 3, item 1: "Painel consolidado reproduzindo a matriz categoria × status...
 * com totais." Item "Funil: cadastrado → apto → emitido → enviado → assinado."
 *
 * Funções puras — a mesma lógica que monta o dashboard precisa poder ser
 * verificada sem banco, e o gate exige que "números do dashboard conferem com
 * SELECT direto no banco": esta é a peça que decide os números.
 */
describe("computarMatrizObjetoStatus", () => {
  it("agrupa por objeto e status, com totais por objeto e total geral", () => {
    const contratos = [
      { objeto: "Militância", status: "assinado" as const, valor: "1500" },
      { objeto: "Militância", status: "enviado" as const, valor: "1500" },
      { objeto: "Militância", status: "assinado" as const, valor: "1500" },
      { objeto: "Administrativo", status: "emitido" as const, valor: "3553" },
    ];

    const matriz = computarMatrizObjetoStatus(contratos);

    const militancia = matriz.linhas.find((l) => l.objeto === "Militância");
    expect(militancia?.total).toBe(3);
    expect(militancia?.porStatus.assinado).toBe(2);
    expect(militancia?.porStatus.enviado).toBe(1);
    expect(militancia?.porStatus.emitido ?? 0).toBe(0);

    const administrativo = matriz.linhas.find((l) => l.objeto === "Administrativo");
    expect(administrativo?.total).toBe(1);

    expect(matriz.totalGeral).toBe(4);
    expect(matriz.totalPorStatus.assinado).toBe(2);
  });

  it("distratos não entram no total (Seção 7: nunca contam no quadro ativo)", () => {
    const contratos = [
      { objeto: "Militância", status: "assinado" as const, valor: "1500" },
      { objeto: "Militância", status: "distratado" as const, valor: "1500" },
      { objeto: "Militância", status: "distrato_assinado" as const, valor: "1500" },
    ];

    const matriz = computarMatrizObjetoStatus(contratos);
    const militancia = matriz.linhas.find((l) => l.objeto === "Militância");
    expect(militancia?.total).toBe(1);
    expect(matriz.totalGeral).toBe(1);
  });

  it("lista vazia produz matriz vazia, não erro", () => {
    const matriz = computarMatrizObjetoStatus([]);
    expect(matriz.linhas).toEqual([]);
    expect(matriz.totalGeral).toBe(0);
  });
});

describe("computarFunil", () => {
  it("cadastrado >= apto >= emitido >= enviado >= assinado (funil monotônico)", () => {
    const pessoas = [
      { apta: true, statusContrato: "assinado" as const },
      { apta: true, statusContrato: "enviado" as const },
      { apta: true, statusContrato: "emitido" as const },
      { apta: true, statusContrato: null },
      { apta: false, statusContrato: null },
    ];

    const funil = computarFunil(pessoas);

    expect(funil.cadastrado).toBe(5);
    expect(funil.apto).toBe(4);
    expect(funil.emitido).toBe(3); // emitido, enviado, assinado contam (alcançaram >= emitido)
    expect(funil.enviado).toBe(2); // enviado, assinado
    expect(funil.assinado).toBe(1);
  });

  it("contrato distratado depois de assinado ainda conta como tendo alcançado 'assinado' no funil histórico", () => {
    // O funil mede "chegou a esse estágio alguma vez", não o estado atual — um
    // contrato distratado passou por assinado antes (Seção 7: a cadeia sempre
    // atravessa assinado -> distratado, nunca pula).
    const pessoas = [{ apta: true, statusContrato: "distratado" as const }];
    const funil = computarFunil(pessoas);
    expect(funil.assinado).toBe(1);
  });

  it("sem nenhuma pessoa: todos os estágios zerados", () => {
    expect(computarFunil([])).toEqual({ cadastrado: 0, apto: 0, emitido: 0, enviado: 0, assinado: 0 });
  });
});

describe("computarResumoRegional", () => {
  it("conta PESSOAS distintas e o % de conclusão pelo contrato mais recente", () => {
    const r = computarResumoRegional([
      { apta: true, statusContrato: "assinado" },
      { apta: true, statusContrato: "assinado" },
      { apta: true, statusContrato: "enviado" },
      { apta: false, statusContrato: null },
    ]);
    expect(r.totalPessoas).toBe(4);
    expect(r.pessoasAptas).toBe(3);
    expect(r.pessoasComContratoAtivo).toBe(3); // 2 assinado + 1 enviado
    expect(r.pessoasComContratoAssinado).toBe(2);
    expect(r.conclusaoPct).toBe(50); // 2/4
  });

  it("100% aptas mas contrato não assinado NÃO é 100% de conclusão", () => {
    const r = computarResumoRegional([
      { apta: true, statusContrato: "emitido" },
      { apta: true, statusContrato: "enviado" },
    ]);
    expect(r.pessoasAptas).toBe(2);
    expect(r.pessoasComContratoAssinado).toBe(0);
    expect(r.conclusaoPct).toBe(0);
  });

  it("contrato distratado (mais recente) não conta como assinado", () => {
    const r = computarResumoRegional([
      { apta: true, statusContrato: "distratado" },
      { apta: true, statusContrato: "assinado" },
    ]);
    expect(r.pessoasComContratoAssinado).toBe(1);
    expect(r.conclusaoPct).toBe(50);
  });

  it("região sem ninguém: conclusaoPct é null, não 0 (Seção 11)", () => {
    expect(computarResumoRegional([])).toEqual({
      totalPessoas: 0,
      pessoasAptas: 0,
      pessoasComContratoAtivo: 0,
      pessoasComContratoAssinado: 0,
      conclusaoPct: null,
    });
  });
});
