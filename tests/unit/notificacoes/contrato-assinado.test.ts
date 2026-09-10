import { describe, it, expect } from "vitest";
import { renderizarEmailContratoAssinado } from "@/emails/contrato-assinado";

describe("E-mail de Confirmação de Contrato Assinado (contrato_assinado)", () => {
  it("renderiza o assunto correto sem expor dados sensíveis", async () => {
    const { subject } = await renderizarEmailContratoAssinado({
      primeiroNome: "Waldo",
      objeto: "Coordenador Regional",
      dataAssinatura: "10/09/2026 às 20:15",
      urlContratoAssinado: "https://comitedigital.org.br/assinar/testtoken123",
      urlDownloadPdf: "https://comitedigital.org.br/api/contratos/publico/testtoken123/pdf",
    });

    expect(subject).toBe("Seu contrato foi assinado com sucesso");
    expect(subject).not.toContain("CPF");
    expect(subject).not.toContain("R$");
  });

  it("renderiza o HTML com a identidade visual e o link para o contrato assinado", async () => {
    const urlContrato = "https://comitedigital.org.br/assinar/abcdef1234567890abcdef1234567890";
    const { html } = await renderizarEmailContratoAssinado({
      primeiroNome: "Fernanda",
      objeto: "Administrativo e Montagem de Material",
      dataAssinatura: "10/09/2026 às 19:40",
      urlContratoAssinado: urlContrato,
      urlContato: "https://comitedigital.org.br",
    });

    expect(html).toContain("Fernanda");
    expect(html).toContain("Administrativo e Montagem de Material");
    expect(html).toContain("10/09/2026 às 19:40");
    expect(html).toContain(urlContrato);
    expect(html).toContain("Visualizar e Baixar Cópia do Contrato");
    expect(html).toContain("#1FA871");
  });

  it("renderiza a versão em texto puro para clientes sem suporte a HTML", async () => {
    const urlContrato = "https://comitedigital.org.br/assinar/testtoken123456";
    const { text } = await renderizarEmailContratoAssinado({
      primeiroNome: "Lucas",
      objeto: "Social Media",
      dataAssinatura: "10/09/2026 às 20:00",
      urlContratoAssinado: urlContrato,
    });

    expect(text).toContain("LUCAS");
    expect(text).toContain("Social Media");
    expect(text).toContain(urlContrato);
  });
});
