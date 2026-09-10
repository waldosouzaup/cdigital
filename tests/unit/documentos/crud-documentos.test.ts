import { describe, it, expect } from "vitest";
import { validarTipoETamanho, TIPOS_DOCUMENTO_VALIDOS } from "@/lib/documentos/upload";
import { pessoaEstaApta } from "@/lib/pessoas/aptidao";

describe("CRUD de Documentos - Regras de Negócio e Validações", () => {
  describe("Validação de Arquivo e Tipos de Documento", () => {
    it("aceita JPG, PNG e PDF dentro do limite de 20 MB", () => {
      expect(validarTipoETamanho("image/jpeg", 5 * 1024 * 1024).ok).toBe(true);
      expect(validarTipoETamanho("image/png", 10 * 1024 * 1024).ok).toBe(true);
      expect(validarTipoETamanho("application/pdf", 19 * 1024 * 1024).ok).toBe(true);
    });

    it("recusa tipos não suportados (ex: docx, txt, zip)", () => {
      const res = validarTipoETamanho("text/plain", 1000);
      expect(res.ok).toBe(false);
      expect(res.motivo).toContain("Envie uma foto em JPG ou PNG, ou um arquivo PDF");
    });

    it("recusa arquivos maiores que 20 MB", () => {
      const res = validarTipoETamanho("application/pdf", 21 * 1024 * 1024);
      expect(res.ok).toBe(false);
      expect(res.motivo).toContain("maior que o limite de 20 MB");
    });

    it("reconhece os tipos de documentos cadastráveis", () => {
      expect(TIPOS_DOCUMENTO_VALIDOS).toContain("documento_identidade");
      expect(TIPOS_DOCUMENTO_VALIDOS).toContain("comprovante_endereco");
    });
  });

  describe("Impacto de Status (Aprovar, Marcar Pendente, Rejeitar, Excluir) na Aptidão", () => {
    it("marca pessoa como apta quando possui identidade e comprovante aprovados", () => {
      const docs = [
        { tipo: "documento_identidade", status: "aprovado" as const, versao: 1 },
        { tipo: "comprovante_endereco", status: "aprovado" as const, versao: 1 },
      ];
      expect(pessoaEstaApta(docs)).toBe(true);
    });

    it("revoga aptidão se um dos documentos voltar para pendente (reabertura)", () => {
      const docs = [
        { tipo: "documento_identidade", status: "pendente" as const, versao: 1 },
        { tipo: "comprovante_endereco", status: "aprovado" as const, versao: 1 },
      ];
      expect(pessoaEstaApta(docs)).toBe(false);
    });

    it("revoga aptidão se um documento for rejeitado", () => {
      const docs = [
        { tipo: "documento_identidade", status: "rejeitado" as const, versao: 1 },
        { tipo: "comprovante_endereco", status: "aprovado" as const, versao: 1 },
      ];
      expect(pessoaEstaApta(docs)).toBe(false);
    });

    it("revoga aptidão se o documento obrigatório (identidade) for excluído", () => {
      // Após excluir documento_identidade, sobra apenas comprovante_endereco
      const docsAposExclusao = [
        { tipo: "comprovante_endereco", status: "aprovado" as const, versao: 1 },
      ];
      expect(pessoaEstaApta(docsAposExclusao)).toBe(false);
    });

    it("considera sempre a versão mais recente em caso de reenvio ou substituição", () => {
      const docsComSubstituicao = [
        { tipo: "documento_identidade", status: "rejeitado" as const, versao: 1 },
        { tipo: "documento_identidade", status: "aprovado" as const, versao: 2 },
        { tipo: "comprovante_endereco", status: "aprovado" as const, versao: 1 },
      ];
      expect(pessoaEstaApta(docsComSubstituicao)).toBe(true);
    });
  });
});
