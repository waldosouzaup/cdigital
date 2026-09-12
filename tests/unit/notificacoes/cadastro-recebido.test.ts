import { describe, it, expect } from "vitest";
import { renderizarEmailCadastroRecebido } from "@/emails/cadastro-recebido";

describe("E-mail de Confirmação de Cadastro e Envio de Documentos (cadastro_recebido)", () => {
  it("renderiza o assunto contendo o protocolo gerado e a organização", async () => {
    const { subject } = await renderizarEmailCadastroRecebido({
      primeiroNome: "Guilherme",
      organizacaoNome: "Campanha 2026 - Majoritária",
      protocolo: "REC-53C1855D",
      dataEnvio: "11/09/2026 às 11:30",
      identidadeEnviada: true,
      enderecoEnviado: true,
    });

    expect(subject).toBe("Comprovante de Envio — Protocolo: REC-53C1855D — Campanha 2026 - Majoritária");
    expect(subject).not.toContain("CPF");
    expect(subject).not.toContain("PIX");
  });

  it("renderiza o corpo HTML com os detalhes do protocolo e status dos 2 documentos", async () => {
    const { html } = await renderizarEmailCadastroRecebido({
      primeiroNome: "Guilherme",
      organizacaoNome: "Coordenação Geral",
      protocolo: "REC-53C1855D",
      dataEnvio: "11/09/2026 às 11:30",
      identidadeEnviada: true,
      enderecoEnviado: true,
    });

    expect(html).toContain("Guilherme");
    expect(html).toContain("REC-53C1855D");
    expect(html).toContain("Coordenação Geral");
    expect(html).toContain("11/09/2026 às 11:30");
    expect(html).toContain("Documento de identidade");
    expect(html).toContain("Comprovante de residência");
    expect(html).toContain("✓ Recebido");
    expect(html).toContain("Conferência técnica");
    expect(html).toContain("Emissão do contrato");
  });

  it("renderiza a versão em texto simples com o protocolo e comprovante", async () => {
    const { text } = await renderizarEmailCadastroRecebido({
      primeiroNome: "Lucas",
      organizacaoNome: "Comitê Central",
      protocolo: "REC-99AABBCC",
      dataEnvio: "11/09/2026 às 12:00",
      identidadeEnviada: true,
      enderecoEnviado: false,
    });

    expect(text).toContain("Lucas");
    expect(text).toContain("REC-99AABBCC");
    expect(text).toContain("Comitê Central");
    expect(text).toContain("Não enviado");
  });
});
