import { describe, expect, it } from "vitest";
import { DOCUMENTOS_OBRIGATORIOS, pessoaEstaApta } from "@/lib/pessoas/aptidao";

/**
 * Fase 2, item 6: "Documentação completa e aprovada marca a pessoa como apta."
 * Função pura e testada separadamente porque a lista de tipos obrigatórios só
 * cresce com o tempo (hoje é 1 tipo; a regra "todos aprovados, nenhum pendente/
 * rejeitado" precisa continuar certa quando virarem 3 ou 4).
 */
describe("pessoaEstaApta", () => {
  it("não está apta sem nenhum documento", () => {
    expect(pessoaEstaApta([])).toBe(false);
  });

  it("está apta quando todos os tipos obrigatórios estão aprovados", () => {
    const documentos = DOCUMENTOS_OBRIGATORIOS.map((tipo) => ({ tipo, status: "aprovado" as const }));
    expect(pessoaEstaApta(documentos)).toBe(true);
  });

  it("não está apta se algum tipo obrigatório ainda está pendente", () => {
    const documentos = DOCUMENTOS_OBRIGATORIOS.map((tipo) => ({ tipo, status: "pendente" as const }));
    expect(pessoaEstaApta(documentos)).toBe(false);
  });

  it("não está apta se algum tipo obrigatório foi rejeitado", () => {
    const documentos = DOCUMENTOS_OBRIGATORIOS.map((tipo) => ({ tipo, status: "rejeitado" as const }));
    expect(pessoaEstaApta(documentos)).toBe(false);
  });

  it("considera só a versão mais recente de cada tipo, não versões antigas rejeitadas", () => {
    const documentos = [
      ...DOCUMENTOS_OBRIGATORIOS.map((tipo) => ({ tipo, status: "aprovado" as const, versao: 2 })),
      { tipo: DOCUMENTOS_OBRIGATORIOS[0], status: "rejeitado" as const, versao: 1 },
    ];
    expect(pessoaEstaApta(documentos)).toBe(true);
  });

  it("ignora tipo de documento que não é obrigatório", () => {
    const documentos = [
      ...DOCUMENTOS_OBRIGATORIOS.map((tipo) => ({ tipo, status: "aprovado" as const })),
      { tipo: "documento_nao_exigido", status: "rejeitado" as const },
    ];
    expect(pessoaEstaApta(documentos)).toBe(true);
  });

  it("não está apta se documento de identidade está aprovado mas comprovante de residência está pendente", () => {
    const documentos = [
      { tipo: "documento_identidade", status: "aprovado" as const },
      { tipo: "comprovante_endereco", status: "pendente" as const },
    ];
    expect(pessoaEstaApta(documentos)).toBe(false);
  });

  it("não está apta se documento de identidade está aprovado mas comprovante de residência foi rejeitado", () => {
    const documentos = [
      { tipo: "documento_identidade", status: "aprovado" as const },
      { tipo: "comprovante_endereco", status: "rejeitado" as const },
    ];
    expect(pessoaEstaApta(documentos)).toBe(false);
  });

  it("não está apta se documento de identidade está aprovado mas comprovante de residência não foi enviado", () => {
    const documentos = [
      { tipo: "documento_identidade", status: "aprovado" as const },
    ];
    expect(pessoaEstaApta(documentos)).toBe(false);
  });

  it("está apta somente quando AMBOS identidade e comprovante de residência estão aprovados", () => {
    const documentos = [
      { tipo: "documento_identidade", status: "aprovado" as const },
      { tipo: "comprovante_endereco", status: "aprovado" as const },
    ];
    expect(pessoaEstaApta(documentos)).toBe(true);
  });
});
