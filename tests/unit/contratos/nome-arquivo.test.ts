import { describe, expect, it } from "vitest";
import { nomeArquivoContrato } from "@/lib/contratos/nome-arquivo";

describe("nomeArquivoContrato", () => {
  it("padroniza o nome do arquivo gerado com o nome do usuário", () => {
    expect(nomeArquivoContrato("Guilherme Ribeiro", "123")).toBe("Contrato - Guilherme Ribeiro.pdf");
  });

  it("padroniza o nome do arquivo assinado", () => {
    expect(nomeArquivoContrato("Guilherme Ribeiro", "123", "assinado")).toBe(
      "Contrato - Guilherme Ribeiro (Assinado).pdf",
    );
  });

  it("padroniza o nome do termo de distrato", () => {
    expect(nomeArquivoContrato("Guilherme Ribeiro", "123", "distrato")).toBe(
      "Distrato - Guilherme Ribeiro.pdf",
    );
  });

  it("sanitiza caracteres inválidos para sistemas de arquivos", () => {
    expect(nomeArquivoContrato("João / Silva : Teste *", "123")).toBe("Contrato - Joao Silva Teste.pdf");
  });

  it("usa fallback Colaborador quando nome for nulo ou vazio", () => {
    expect(nomeArquivoContrato(null, "123")).toBe("Contrato - Colaborador.pdf");
    expect(nomeArquivoContrato("", "123")).toBe("Contrato - Colaborador.pdf");
  });
});

/**
 * A rescisão passou a ser assinada eletronicamente (migration 0035), então o
 * termo existe em duas versões — a emitida e a assinada — e quem baixa precisa
 * distinguir uma da outra pelo nome do arquivo, sem abrir.
 */
describe("nomeArquivoContrato — termo de distrato assinado", () => {
  it("marca a via assinada do distrato", () => {
    expect(nomeArquivoContrato("Guilherme Ribeiro", undefined, "distrato_assinado")).toBe(
      "Distrato - Guilherme Ribeiro (Assinado).pdf",
    );
  });

  it("mantém o termo emitido sem a marcação", () => {
    expect(nomeArquivoContrato("Guilherme Ribeiro", undefined, "distrato")).toBe(
      "Distrato - Guilherme Ribeiro.pdf",
    );
  });

  it("aplica a mesma limpeza de acento e caractere reservado", () => {
    // Caractere reservado de filesystem e removido, nao trocado por espaco —
    // comportamento ja existente, aqui so confirmado para a nova versao.
    expect(nomeArquivoContrato('Ana "Çé" Sá/Lima', undefined, "distrato_assinado")).toBe(
      "Distrato - Ana Ce SaLima (Assinado).pdf",
    );
  });
});
