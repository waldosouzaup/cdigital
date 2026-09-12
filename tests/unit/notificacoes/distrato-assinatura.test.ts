import { describe, it, expect } from "vitest";
import { renderizarEmailDistratoEnviado } from "@/emails/distrato-enviado";
import { renderizarEmailDistratoAssinado } from "@/emails/distrato-assinado";

/**
 * O distrato passou a ser assinado eletronicamente (migration 0035). Antes, o
 * aviso de rescisão era terminal: informava e encerrava o assunto. Agora ele é
 * um pedido de ação, e existe um segundo aviso que entrega a via assinada.
 *
 * O caminho presencial continua válido — quando não há token, o e-mail volta a
 * ser o informativo de antes, sem prometer uma assinatura que ninguém vai pedir.
 */
const base = {
  primeiroNome: "Maria",
  objeto: "Militância e Mobilização de Rua",
  dataDistrato: "12/08/2026",
  periodoTrabalhado: "01/08/2026 a 12/08/2026 (12/31 dias)",
  valorProporcional: "R$ 580,65",
  motivo: "acordo entre as partes",
};

describe("e-mail de distrato enviado", () => {
  it("pede a assinatura quando há link", async () => {
    const url = "https://exemplo.com/assinar-distrato/abc123";
    const { subject, html, text } = await renderizarEmailDistratoEnviado({
      ...base,
      urlAssinatura: url,
    });

    expect(subject).toBe("Assine o Termo de Distrato do seu contrato");
    expect(html).toContain("Ler e assinar o termo de distrato");
    expect(html).toContain(url);
    expect(html).toContain("só é considerada concluída depois da sua assinatura");
    // O link precisa sobreviver na versão texto: cliente que bloqueia HTML
    // ainda tem de conseguir assinar.
    expect(text).toContain(url);
  });

  it("volta ao aviso informativo quando não há link", async () => {
    const { subject, html } = await renderizarEmailDistratoEnviado(base);

    expect(subject).toBe("Formalização do Termo de Distrato Contratual");
    expect(html).not.toContain("assinar-distrato");
    expect(html).not.toContain("Ler e assinar");
  });

  it("mantém o resumo da rescisão nos dois casos", async () => {
    for (const params of [base, { ...base, urlAssinatura: "https://exemplo.com/a/b" }]) {
      const { html } = await renderizarEmailDistratoEnviado(params);
      expect(html).toContain("R$ 580,65");
      expect(html).toContain("acordo entre as partes");
    }
  });
});

describe("e-mail de distrato assinado", () => {
  it("entrega o link da via assinada e o comprovante", async () => {
    const { subject, html, text } = await renderizarEmailDistratoAssinado({
      primeiroNome: "Maria",
      objeto: "Militância e Mobilização de Rua",
      dataAssinatura: "12/08/2026 às 14:22",
      periodoTrabalhado: "01/08/2026 a 12/08/2026 (12/31 dias)",
      valorProporcional: "R$ 580,65",
      urlTermoAssinado: "https://exemplo.com/assinar-distrato/abc123",
      urlDownloadPdf: "https://exemplo.com/api/distratos/publico/abc123/pdf?download=1",
      urlContato: "https://exemplo.com",
    });

    expect(subject).toBe("Distrato assinado — sua via em PDF");
    expect(html).toContain("Visualizar e baixar o termo assinado");
    expect(html).toContain("assinar-distrato/abc123");
    expect(html).toContain("download=1");
    expect(html).toContain("12/08/2026 às 14:22");
    expect(html).toContain("R$ 580,65");
    expect(text).toContain("assinar-distrato/abc123");
  });

  it("funciona sem o link de download direto", async () => {
    const { html } = await renderizarEmailDistratoAssinado({
      primeiroNome: "Maria",
      objeto: "Objeto",
      dataAssinatura: "12/08/2026",
      periodoTrabalhado: "12/31 dias",
      valorProporcional: "R$ 1,00",
      urlTermoAssinado: "https://exemplo.com/assinar-distrato/abc",
    });
    expect(html).toContain("assinar-distrato/abc");
    expect(html).not.toContain("baixe o PDF diretamente");
  });
});
