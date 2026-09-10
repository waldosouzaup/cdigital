import { describe, it, expect } from "vitest";
import { renderizarEmailDistratoEnviado } from "@/emails/distrato-enviado";

describe("E-mail de Notificação de Distrato (distrato_enviado)", () => {
  it("renderiza o assunto correto sem expor dados sensíveis", async () => {
    const { subject } = await renderizarEmailDistratoEnviado({
      primeiroNome: "Carlos",
      objeto: "Coordenador de Mobilização",
      dataDistrato: "10/09/2026",
      periodoTrabalhado: "01/09/2026 a 10/09/2026 (10 dias)",
      valorProporcional: "R$ 1.076,67",
    });

    expect(subject).toBe("Formalização do Termo de Distrato Contratual");
    // Regra 7: sem CPF no assunto
    expect(subject).not.toContain("CPF");
    expect(subject).not.toContain("R$");
  });

  it("renderiza o HTML com a identidade visual e os dados da rescisão", async () => {
    const { html } = await renderizarEmailDistratoEnviado({
      primeiroNome: "Mariana",
      objeto: "Apoio Operacional",
      dataDistrato: "07/09/2026",
      periodoTrabalhado: "01/09/2026 a 07/09/2026 (7 de 33 dias)",
      valorProporcional: "R$ 753,67",
      motivo: "Ajuste operacional de equipe",
      urlContato: "https://comitedigital.org.br",
    });

    expect(html).toContain("Mariana");
    expect(html).toContain("Apoio Operacional");
    expect(html).toContain("07/09/2026");
    expect(html).toContain("01/09/2026 a 07/09/2026 (7 de 33 dias)");
    expect(html).toContain("R$ 753,67");
    expect(html).toContain("Ajuste operacional de equipe");
    expect(html).toContain("https://comitedigital.org.br");
    expect(html).toContain("#1FA871");
  });

  it("renderiza a versão em texto puro para clientes de e-mail sem HTML", async () => {
    const { text } = await renderizarEmailDistratoEnviado({
      primeiroNome: "João",
      objeto: "Social Media",
      dataDistrato: "10/09/2026",
      periodoTrabalhado: "10 dias",
      valorProporcional: "R$ 1.000,00",
    });

    expect(text).toContain("JOÃO");
    expect(text).toContain("Social Media");
    expect(text).toContain("R$ 1.000,00");
  });
});
