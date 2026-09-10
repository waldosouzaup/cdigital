import { describe, expect, it, vi } from "vitest";
import {
  buscarEnderecoPorCep,
  formatarCep,
  limparCep,
} from "@/lib/cep/viacep";

describe("limparCep", () => {
  it("remove caracteres não numéricos", () => {
    expect(limparCep("70.040-010")).toBe("70040010");
    expect(limparCep("01001-000")).toBe("01001000");
    expect(limparCep("abc12345xyz")).toBe("12345");
  });
});

describe("formatarCep", () => {
  it("formata CEP com 8 dígitos no padrão 00000-000", () => {
    expect(formatarCep("70040010")).toBe("70040-010");
    expect(formatarCep("01001000")).toBe("01001-000");
  });

  it("retorna apenas os números se tiver menos de 5 dígitos", () => {
    expect(formatarCep("700")).toBe("700");
  });

  it("limita a 8 dígitos", () => {
    expect(formatarCep("70040010999")).toBe("70040-010");
  });
});

describe("buscarEnderecoPorCep", () => {
  it("recusa CEP com tamanho diferente de 8 dígitos", async () => {
    const resultado = await buscarEnderecoPorCep("123");
    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toMatch(/8 dígitos/);
  });

  it("retorna endereço formatado quando o ViaCEP responde com sucesso", async () => {
    const mockRespostaViaCep = {
      cep: "01001-000",
      logradouro: "Praça da Sé",
      bairro: "Sé",
      localidade: "São Paulo",
      uf: "SP",
    };

    const fetchOriginal = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRespostaViaCep,
    } as Response);

    try {
      const resultado = await buscarEnderecoPorCep("01001-000");
      expect(resultado.sucesso).toBe(true);
      expect(resultado.dados?.logradouro).toBe("Praça da Sé");
      expect(resultado.dados?.bairro).toBe("Sé");
      expect(resultado.dados?.cidade).toBe("São Paulo");
      expect(resultado.dados?.uf).toBe("SP");
      expect(resultado.dados?.enderecoFormatado).toBe("Praça da Sé, nº , Sé, São Paulo - SP");
    } finally {
      global.fetch = fetchOriginal;
    }
  });

  it("identifica erro quando o ViaCEP retorna erro: true", async () => {
    const fetchOriginal = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ erro: "true" }),
    } as Response);

    try {
      const resultado = await buscarEnderecoPorCep("99999-999");
      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toBe("CEP não encontrado.");
    } finally {
      global.fetch = fetchOriginal;
    }
  });

  it("trata falha de rede graciosamente", async () => {
    const fetchOriginal = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network offline"));

    try {
      const resultado = await buscarEnderecoPorCep("70040-010");
      expect(resultado.sucesso).toBe(false);
      expect(resultado.erro).toMatch(/Falha de conexão/);
    } finally {
      global.fetch = fetchOriginal;
    }
  });
});
