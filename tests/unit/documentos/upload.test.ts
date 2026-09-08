import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  calcularHashSha256,
  DIMENSAO_MINIMA_PX,
  extensaoPorMime,
  validarDimensaoImagem,
  validarTipoETamanho,
} from "@/lib/documentos/upload";

/**
 * Fase 2, item 3: "menor dimensão da imagem >= 800px, senão rejeita informando o
 * motivo em linguagem simples" e "tipos JPG, PNG, PDF; limite de 20 MB". Gate:
 * "Upload de imagem 72×72 px é recusado com mensagem compreensível."
 */
function imagemDeTeste(largura: number, altura: number) {
  return sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe("validarTipoETamanho", () => {
  it("aceita JPG, PNG e PDF dentro do limite de tamanho", () => {
    expect(validarTipoETamanho("image/jpeg", 1000).ok).toBe(true);
    expect(validarTipoETamanho("image/png", 1000).ok).toBe(true);
    expect(validarTipoETamanho("application/pdf", 1000).ok).toBe(true);
  });

  it("rejeita tipo não autorizado", () => {
    const resultado = validarTipoETamanho("image/gif", 1000);
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toMatch(/JPG|PNG|PDF/);
  });

  it("rejeita arquivo maior que 20 MB", () => {
    const resultado = validarTipoETamanho("image/jpeg", 21 * 1024 * 1024);
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toMatch(/20 ?MB/);
  });
});

describe("validarDimensaoImagem", () => {
  it("recusa imagem 72×72 px (o caso real do acervo, 6 vezes)", async () => {
    const buffer = await imagemDeTeste(72, 72);
    const resultado = await validarDimensaoImagem(buffer, "image/png");
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toMatch(/72/);
  });

  it(`aceita imagem exatamente no limite (${DIMENSAO_MINIMA_PX}px no menor lado)`, async () => {
    const buffer = await imagemDeTeste(DIMENSAO_MINIMA_PX, 1200);
    const resultado = await validarDimensaoImagem(buffer, "image/png");
    expect(resultado.ok).toBe(true);
    expect(resultado.largura).toBe(DIMENSAO_MINIMA_PX);
  });

  it("recusa quando só a altura é pequena, mesmo com largura grande", async () => {
    const buffer = await imagemDeTeste(1600, 500);
    const resultado = await validarDimensaoImagem(buffer, "image/png");
    expect(resultado.ok).toBe(false);
  });

  it("não aplica a regra de dimensão a PDF", async () => {
    const resultado = await validarDimensaoImagem(Buffer.from("não é uma imagem"), "application/pdf");
    expect(resultado.ok).toBe(true);
  });
});

describe("calcularHashSha256", () => {
  it("é determinístico: mesmo buffer, mesmo hash", () => {
    const buffer = Buffer.from("conteúdo de teste");
    expect(calcularHashSha256(buffer)).toBe(calcularHashSha256(Buffer.from("conteúdo de teste")));
  });

  it("buffers diferentes geram hashes diferentes", () => {
    expect(calcularHashSha256(Buffer.from("a"))).not.toBe(calcularHashSha256(Buffer.from("b")));
  });
});

describe("extensaoPorMime", () => {
  it("mapeia os 3 tipos aceitos para a extensão correta", () => {
    expect(extensaoPorMime("image/jpeg")).toBe("jpg");
    expect(extensaoPorMime("image/png")).toBe("png");
    expect(extensaoPorMime("application/pdf")).toBe("pdf");
  });

  it("devolve null para tipo não mapeado — nunca inventa extensão", () => {
    expect(extensaoPorMime("image/gif")).toBeNull();
  });
});
