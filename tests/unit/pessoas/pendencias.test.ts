import { describe, expect, it } from "vitest";
import { calcularPendencias } from "@/lib/pessoas/pendencias";

/**
 * Fase 2, item 14: "Checklist de pendências por pessoa." Função pura — a mesma
 * regra que decide o quadro precisa poder ser testada sem depender do banco, e
 * reaproveita a mesma lista de tipos obrigatórios de `pessoaEstaApta`
 * (src/lib/pessoas/aptidao.ts) — nunca duplica a lista em outro lugar.
 */
describe("calcularPendencias — documentação", () => {
  it("sem nenhum documento: pendência crítica de documento ausente", () => {
    const pendencias = calcularPendencias({ documentos: [], apta: false, contratoStatus: null });
    const ausente = pendencias.find((p) => p.codigo.startsWith("documento_ausente"));
    expect(ausente).toBeDefined();
    expect(ausente?.severidade).toBe("critica");
  });

  it("documento pendente de conferência: pendência de atenção, não crítica", () => {
    const pendencias = calcularPendencias({
      documentos: [{ tipo: "documento_identidade", status: "pendente" }],
      apta: false,
      contratoStatus: null,
    });
    const pendente = pendencias.find((p) => p.codigo.startsWith("documento_pendente"));
    expect(pendente).toBeDefined();
    expect(pendente?.severidade).toBe("atencao");
  });

  it("documento rejeitado: pendência crítica de reenvio", () => {
    const pendencias = calcularPendencias({
      documentos: [{ tipo: "documento_identidade", status: "rejeitado" }],
      apta: false,
      contratoStatus: null,
    });
    const rejeitado = pendencias.find((p) => p.codigo.startsWith("documento_rejeitado"));
    expect(rejeitado).toBeDefined();
    expect(rejeitado?.severidade).toBe("critica");
  });

  it("documento aprovado: nenhuma pendência de documentação", () => {
    const pendencias = calcularPendencias({
      documentos: [{ tipo: "documento_identidade", status: "aprovado" }],
      apta: true,
      contratoStatus: null,
    });
    expect(pendencias.some((p) => p.codigo.startsWith("documento_"))).toBe(false);
  });

  it("considera só a versão mais recente — rejeitada v1 não conta se v2 está aprovada", () => {
    const pendencias = calcularPendencias({
      documentos: [
        { tipo: "documento_identidade", status: "rejeitado", versao: 1 },
        { tipo: "documento_identidade", status: "aprovado", versao: 2 },
      ],
      apta: true,
      contratoStatus: null,
    });
    expect(pendencias.some((p) => p.codigo.startsWith("documento_"))).toBe(false);
  });
});

describe("calcularPendencias — contrato", () => {
  it("pessoa apta sem nenhum contrato: pendência de atenção", () => {
    const pendencias = calcularPendencias({
      documentos: [{ tipo: "documento_identidade", status: "aprovado" }],
      apta: true,
      contratoStatus: null,
    });
    expect(pendencias.find((p) => p.codigo === "contrato_nao_emitido")).toBeDefined();
  });

  it("pessoa NÃO apta sem contrato: não é pendência (ainda não chegou a vez do contrato)", () => {
    const pendencias = calcularPendencias({ documentos: [], apta: false, contratoStatus: null });
    expect(pendencias.some((p) => p.codigo.startsWith("contrato_"))).toBe(false);
  });

  it("contrato emitido mas não enviado: pendência de atenção", () => {
    const pendencias = calcularPendencias({
      documentos: [{ tipo: "documento_identidade", status: "aprovado" }],
      apta: true,
      contratoStatus: "emitido",
    });
    expect(pendencias.find((p) => p.codigo === "contrato_nao_enviado")).toBeDefined();
  });

  it("contrato enviado mas não assinado: pendência de atenção", () => {
    const pendencias = calcularPendencias({
      documentos: [{ tipo: "documento_identidade", status: "aprovado" }],
      apta: true,
      contratoStatus: "enviado",
    });
    expect(pendencias.find((p) => p.codigo === "contrato_nao_assinado")).toBeDefined();
  });

  it("contrato assinado: nenhuma pendência", () => {
    const pendencias = calcularPendencias({
      documentos: [{ tipo: "documento_identidade", status: "aprovado" }],
      apta: true,
      contratoStatus: "assinado",
    });
    expect(pendencias).toHaveLength(0);
  });
});
