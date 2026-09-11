/** PDF A4 com paginação por blocos e áreas próprias para assinatura. */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/** Converte o conteúdo do modelo, sem executar HTML nem interpretar suas instruções. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<\/t[dh]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (entidade, codigo: string) => {
      const nomes: Record<string, string> = {
        nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
      };
      if (!codigo.startsWith("#")) return nomes[codigo.toLowerCase()] ?? entidade;
      const numero = /^#x/i.test(codigo) ? parseInt(codigo.slice(2), 16) : Number(codigo.slice(1));
      return numero > 0 && numero <= 0x10ffff && !(numero >= 0xd800 && numero <= 0xdfff)
        ? String.fromCodePoint(numero) : "";
    })
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n").map((linha) => linha.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

/** Reconhece o rodapé legado sem alterar cláusulas ou modelos personalizados. */
export function normalizarCorpoContrato(corpo: string): string {
  return corpo.replace(/\r\n?/g, "\n")
    .replace(
      /(^|\n)_{5,}[ \t]+_{5,}[ \t]+CONTRATANTE[ \t\n]+CONTRATADO[ \t]*\n([^\n]+)/g,
      "$1ASSINATURAS DAS PARTES\n$2",
    )
    .replace(
      /Testemunhas?\s*1:\s*Testemunha\s*2:\s*_{5,}\s+_{5,}\s+NOME:\s*NOME:\s*CPF:\s*CPF:?/gi,
      "TESTEMUNHAS\nTestemunha 1 — Nome: ____________________ — CPF: ____________________\nTestemunha 2 — Nome: ____________________ — CPF: ____________________",
    );
}

/** Também quebra identificadores, e-mails e chaves longas sem espaços. */
export function quebrarLinha(texto: string, largura: number, fonte: PDFFont, tamanho: number): string[] {
  if (!texto) return [""];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
      atual = tentativa;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = "";
    for (const caractere of palavra) {
      if (atual && fonte.widthOfTextAtSize(atual + caractere, tamanho) > largura) {
        linhas.push(atual);
        atual = "";
      }
      atual += caractere;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 56;
const UTIL = LARGURA - MARGEM * 2;
const FONTE = 10.5;
const LINHA = 15;
const TOPO = ALTURA - MARGEM;
const BASE = MARGEM + 12;
const CAPACIDADE = TOPO - BASE;
const COLUNA = (UTIL - 32) / 2;

export async function gerarPdfContrato(params: { titulo: string; corpo: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const corpo = normalizarCorpoContrato(params.corpo);
  doc.setTitle(params.titulo);
  doc.setSubject(corpo);
  doc.setLanguage("pt-BR");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  let pagina = doc.addPage([LARGURA, ALTURA]);
  let y = TOPO;

  const escrever = (texto: string, x: number, altura: number, fonte = regular, tamanho = FONTE) => {
    pagina.drawText(texto, { x, y: altura, font: fonte, size: tamanho, color: rgb(0.12, 0.12, 0.12) });
  };
  const garantir = (altura: number) => {
    if (y - Math.min(altura, CAPACIDADE) < BASE) {
      pagina = doc.addPage([LARGURA, ALTURA]);
      y = TOPO;
    }
  };
  const linhas = (texto: string, largura = UTIL, fonte = regular, tamanho = FONTE) =>
    texto.split("\n").flatMap((linha) => quebrarLinha(linha, largura, fonte, tamanho));

  for (const linha of linhas(params.titulo, UTIL, negrito, 14)) {
    garantir(20);
    escrever(linha, MARGEM + (UTIL - negrito.widthOfTextAtSize(linha, 14)) / 2, y, negrito, 14);
    y -= 20;
  }
  y -= 16;

  const paragrafos = corpo.split(/\n\s*\n/).filter((p) => p.trim());
  for (let i = 0; i < paragrafos.length; i++) {
    const paragrafo = paragrafos[i].trim();
    if (paragrafo.startsWith("ASSINATURAS DAS PARTES\n")) {
      const identificacao = linhas(paragrafo.split("\n").slice(1).join("\n").replace(/\s+[—–]\s+CPF\s*/g, "\nCPF: "), COLUNA);
      const comTestemunhas = paragrafos[i + 1]?.startsWith("TESTEMUNHAS\n");
      const alturaPartes = 86 + Math.max(2, identificacao.length) * LINHA;
      garantir(alturaPartes + (comTestemunhas ? 126 : 0));
      escrever("ASSINATURAS DAS PARTES", MARGEM, y, negrito, 10);
      y -= 52;
      for (const x of [MARGEM, MARGEM + COLUNA + 32]) {
        pagina.drawLine({ start: { x, y }, end: { x: x + COLUNA, y }, thickness: 0.6 });
      }
      y -= 17;
      escrever("CONTRATANTE", MARGEM, y, negrito, 9);
      escrever("CONTRATADO", MARGEM + COLUNA + 32, y, negrito, 9);
      y -= LINHA;
      for (const linha of identificacao) {
        escrever(linha, MARGEM + COLUNA + 32, y);
        y -= LINHA;
      }
      y -= 20;
      continue;
    }
    if (paragrafo.startsWith("TESTEMUNHAS\n")) {
      garantir(126);
      escrever("TESTEMUNHAS", MARGEM, y, negrito, 10);
      y -= 46;
      for (const [indice, x] of [MARGEM, MARGEM + COLUNA + 32].entries()) {
        pagina.drawLine({ start: { x, y }, end: { x: x + COLUNA, y }, thickness: 0.6 });
        escrever(`Testemunha ${indice + 1}`, x, y - 17, negrito, 9);
        escrever("Nome: __________________________________", x, y - 35, regular, 9);
        escrever("CPF: ___________________________________", x, y - 53, regular, 9);
      }
      y -= 80;
      continue;
    }
    const contato = paragrafo.startsWith("DADOS PARA CONTATO E PAGAMENTO\n");
    const tituloSecao = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s.]+$/.test(paragrafo) && paragrafo.length < 90;
    const fonte = tituloSecao ? negrito : regular;
    const textoLinhas = linhas(paragrafo, UTIL, fonte);
    let reserva = textoLinhas.length * LINHA + 9;
    if (tituloSecao) reserva += LINHA * 2;
    // A data de encerramento acompanha as assinaturas, sem ficar isolada na página anterior.
    if (paragrafos[i + 1]?.startsWith("ASSINATURAS DAS PARTES\n")) reserva += 260;
    garantir(reserva);
    for (let j = 0; j < textoLinhas.length; j++) {
      garantir(LINHA);
      escrever(textoLinhas[j], MARGEM, y, contato && j === 0 ? negrito : fonte);
      y -= LINHA;
      if (contato && j === 0) y -= 6;
    }
    y -= contato ? 14 : 9;
  }

  const paginas = doc.getPages();
  for (const [indice, folha] of paginas.entries()) {
    folha.drawLine({ start: { x: MARGEM, y: 44 }, end: { x: LARGURA - MARGEM, y: 44 }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
    const rodape = `Página ${indice + 1} de ${paginas.length}`;
    folha.drawText(rodape, { x: LARGURA - MARGEM - regular.widthOfTextAtSize(rodape, 8), y: 30, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) });
  }
  return doc.save();
}
