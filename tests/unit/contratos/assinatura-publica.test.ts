import { describe, expect, it } from "vitest";
import { renderizarEmailContratoEnviado } from "@/emails/contrato-enviado";
import { randomBytes } from "node:crypto";

describe("Fluxo de Assinatura Pública de Contrato", () => {
  it("renderiza e-mail com link e botão de assinatura quando urlAssinatura é fornecida", async () => {
    const urlAssinatura = "https://app.comitedigital.org/assinar/test-token-123456";
    const { subject, html, text } = await renderizarEmailContratoEnviado({
      primeiroNome: "Waldo",
      objeto: "Administrativo e Montagem de Material",
      urlAssinatura,
      urlContato: "https://app.comitedigital.org",
    });

    expect(subject).toContain("contrato");
    expect(html).toContain("Visualizar e Assinar Contrato");
    expect(html).toContain(urlAssinatura);
    expect(text).toContain(urlAssinatura);
  });

  it("renderiza e-mail em modo de espera quando urlAssinatura não é fornecida", async () => {
    const { subject, html } = await renderizarEmailContratoEnviado({
      primeiroNome: "Waldo",
      objeto: "Administrativo e Montagem de Material",
      urlContato: "https://app.comitedigital.org",
    });

    expect(subject).toBe("Seu contrato foi emitido");
    expect(html).toContain("coordenação da sua região entrará em contato");
  });

  it("gera token de assinatura criptográfico de alta entropia", () => {
    const token = randomBytes(24).toString("hex");
    expect(token).toHaveLength(48);
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^[0-9a-f]+$/);
  });
});
