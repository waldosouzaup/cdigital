import { describe, it, expect } from "vitest";
import { extrairSugestoesDocumento } from "@/lib/documentos/extrair-rg-cnh";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Fase 4, item 3 — "OCR sugerindo nome e CPF a partir de RG/CNH, sempre com
 * confirmação humana antes de gravar". Lógica pura: recebe o texto bruto do
 * tesseract.js e devolve *sugestões*. Nada aqui grava — quem grava é a Server
 * Action de cadastro, depois que a pessoa confirma.
 */
const CPF_VALIDO = generateValidCpf("12345678"); // 11 dígitos válidos
const CPF_FORMATADO = CPF_VALIDO.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

describe("extrairSugestoesDocumento", () => {
  it("extrai nome e CPF de um texto típico de RG", () => {
    const texto = [
      "REPÚBLICA FEDERATIVA DO BRASIL",
      "CARTEIRA DE IDENTIDADE",
      "NOME",
      "MARIA APARECIDA DOS SANTOS",
      `CPF ${CPF_FORMATADO}`,
      "DOC. ORIGEM: CERTIDÃO DE NASCIMENTO",
    ].join("\n");

    const s = extrairSugestoesDocumento(texto);
    expect(s.nome).toBe("MARIA APARECIDA DOS SANTOS");
    expect(s.cpf).toBe(CPF_FORMATADO);
    expect(s.confianca).toBe("alta");
  });

  it("acha o CPF mesmo sem pontuação e o devolve formatado", () => {
    const s = extrairSugestoesDocumento(`Nome JOAO PEREIRA LIMA\nCPF: ${CPF_VALIDO}`);
    expect(s.cpf).toBe(CPF_FORMATADO);
    expect(s.nome).toBe("JOAO PEREIRA LIMA");
  });

  it("ignora um número com cara de CPF cujo dígito verificador não fecha", () => {
    const s = extrairSugestoesDocumento("CPF 111.111.111-11\nFULANO DE TAL SOUZA");
    expect(s.cpf).toBeNull();
    expect(s.nome).toBe("FULANO DE TAL SOUZA");
    expect(s.confianca).toBe("media");
  });

  it("não confunde linhas de cabeçalho do documento com o nome", () => {
    const texto = [
      "REPÚBLICA FEDERATIVA DO BRASIL",
      "MINISTÉRIO DA INFRAESTRUTURA",
      "CARTEIRA NACIONAL DE HABILITAÇÃO",
      "ANA BEATRIZ RODRIGUES",
    ].join("\n");
    expect(extrairSugestoesDocumento(texto).nome).toBe("ANA BEATRIZ RODRIGUES");
  });

  it("pega o nome na linha seguinte quando a anterior é só o rótulo 'NOME'", () => {
    expect(extrairSugestoesDocumento("2 - NOME\nCARLOS EDUARDO MENEZES\n3 - DOC").nome).toBe(
      "CARLOS EDUARDO MENEZES",
    );
  });

  it("devolve confiança baixa quando não acha nem nome nem CPF", () => {
    const s = extrairSugestoesDocumento("=== \n ||| \n 8O8O8O");
    expect(s).toEqual({ nome: null, cpf: null, confianca: "baixa" });
  });

  it("colapsa espaços repetidos do OCR no nome", () => {
    expect(extrairSugestoesDocumento("NOME\nPEDRO   HENRIQUE    ALVES").nome).toBe(
      "PEDRO HENRIQUE ALVES",
    );
  });
});
