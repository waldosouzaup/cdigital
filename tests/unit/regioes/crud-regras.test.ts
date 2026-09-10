import { describe, it, expect } from "vitest";
import { validarFuncaoPretendida } from "@/lib/regioes/validacao-funcao";
import { validarNomeRegiao } from "@/lib/regioes/validacao";

describe("Regras de negócio de Regiões e Funções Pretendidas", () => {
  describe("Regiões - Validação e Regras de Exclusão", () => {
    it("não permite criar região com nome repetido (mesmo com variação de maiúsculas/acentos)", () => {
      const regioesExistentes = ["Plano Piloto", "Ceilândia", "Taguatinga"];
      const res = validarNomeRegiao("plano piloto", regioesExistentes);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.erro).toContain("Já existe uma região com esse nome");
      }
    });

    it("permite renomear para um nome não utilizado", () => {
      const regioesExistentes = ["Plano Piloto", "Ceilândia"];
      const res = validarNomeRegiao("Águas Claras", regioesExistentes, "Plano Piloto");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.nome).toBe("Águas Claras");
      }
    });

    it("simula bloqueio de exclusão quando existem vínculos cadastrados", () => {
      function podeExcluirRegiao(contagens: { pessoas: number; contratos: number; usuarios: number; atividades: number }) {
        const total = contagens.pessoas + contagens.contratos + contagens.usuarios + contagens.atividades;
        if (total > 0) {
          return {
            pode: false,
            motivo: `Existem ${total} registros vinculados à região.`,
          };
        }
        return { pode: true };
      }

      expect(podeExcluirRegiao({ pessoas: 3, contratos: 0, usuarios: 0, atividades: 0 }).pode).toBe(false);
      expect(podeExcluirRegiao({ pessoas: 0, contratos: 1, usuarios: 0, atividades: 0 }).pode).toBe(false);
      expect(podeExcluirRegiao({ pessoas: 0, contratos: 0, usuarios: 0, atividades: 0 }).pode).toBe(true);
    });
  });

  describe("Funções Pretendidas - Validação e Catálogo", () => {
    it("valida campos obrigatórios e comprimento máximo", () => {
      const semNome = validarFuncaoPretendida("", "desc", []);
      expect(semNome.ok).toBe(false);

      const nomeLongo = validarFuncaoPretendida("a".repeat(81), "desc", []);
      expect(nomeLongo.ok).toBe(false);

      const descLonga = validarFuncaoPretendida("Nome Válido", "b".repeat(256), []);
      expect(descLonga.ok).toBe(false);

      const valida = validarFuncaoPretendida("Coordenador de Equipe", "Responsável pelas ações de rua", []);
      expect(valida.ok).toBe(true);
    });

    it("impede duplicação no catálogo de funções", () => {
      const existentes = ["Militância e Mobilização de Rua", "Administrativo Homeoffice"];
      const res = validarFuncaoPretendida("militancia e mobilizacao de rua", "", existentes);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.erro).toContain("Já existe uma função pretendida com esse nome");
      }
    });

    it("permite salvar edição mantendo o mesmo nome da própria função", () => {
      const existentes = ["Militância e Mobilização de Rua", "Administrativo Homeoffice"];
      const res = validarFuncaoPretendida(
        "Militância e Mobilização de Rua",
        "Nova descrição atualizada",
        existentes,
        "Militância e Mobilização de Rua",
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.descricao).toBe("Nova descrição atualizada");
      }
    });
  });
});
