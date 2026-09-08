/**
 * Geração de PDF do contrato — Fase 2, item 8.
 *
 * Decisão registrada em CONSULTAS.md: usa `pdf-lib` (puro JS, sem binário externo)
 * em vez de um navegador headless (Puppeteer/Chromium), pensando na hospedagem
 * serverless (Netlify). Como consequência, o `corpo_html` do template não é
 * renderizado com CSS de verdade — é convertido para texto simples primeiro
 * (`htmlParaTexto`), e o PDF é montado com quebra de linha manual.
 */
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

/** Remove tags HTML e normaliza quebras de parágrafo/linha, decodificando as
 * entidades mais comuns. Não tenta ser um parser de HTML completo — os templates
 * de contrato são parágrafos simples, não layout complexo (Seção 5: `corpo_html`
 * existe para permitir <strong>/<em>/<p>, não colunas nem tabelas). */
export function htmlParaTexto(html: string): string {
  const semTags = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return semTags
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function quebrarLinha(texto: string, larguraMaxima: number, fonte: PDFFont, tamanho: number): string[] {
  if (!texto) return [""];

  const palavras = texto.split(" ");
  const linhas: string[] = [];
  let atual = "";

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && fonte.widthOfTextAtSize(tentativa, tamanho) > larguraMaxima) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// A4 em pontos (1/72 polegada), margem de ~2 cm.
const LARGURA_PAGINA = 595.28;
const ALTURA_PAGINA = 841.89;
const MARGEM = 56;
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2;
const TAMANHO_FONTE = 11;
const ALTURA_LINHA = 16;
const TAMANHO_TITULO = 14;

export async function gerarPdfContrato(params: { titulo: string; corpo: string }): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonteRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
  let y = ALTURA_PAGINA - MARGEM;

  function garantirEspaco() {
    if (y < MARGEM + ALTURA_LINHA) {
      page = pdfDoc.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
      y = ALTURA_PAGINA - MARGEM;
    }
  }

  for (const linha of quebrarLinha(params.titulo, LARGURA_UTIL, fonteNegrito, TAMANHO_TITULO)) {
    garantirEspaco();
    const larguraTexto = fonteNegrito.widthOfTextAtSize(linha, TAMANHO_TITULO);
    page.drawText(linha, {
      x: MARGEM + Math.max(0, (LARGURA_UTIL - larguraTexto) / 2),
      y,
      size: TAMANHO_TITULO,
      font: fonteNegrito,
    });
    y -= 20;
  }
  y -= 10;

  for (const paragrafo of params.corpo.split("\n\n")) {
    if (!paragrafo.trim()) {
      y -= ALTURA_LINHA / 2;
      continue;
    }
    const linhasDoParagrafo = paragrafo
      .split("\n")
      .flatMap((linha) => quebrarLinha(linha, LARGURA_UTIL, fonteRegular, TAMANHO_FONTE));

    for (const linha of linhasDoParagrafo) {
      garantirEspaco();
      page.drawText(linha, { x: MARGEM, y, size: TAMANHO_FONTE, font: fonteRegular });
      y -= ALTURA_LINHA;
    }
    y -= ALTURA_LINHA / 2;
  }

  return pdfDoc.save();
}
