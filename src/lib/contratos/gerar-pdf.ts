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

/** Reconhece o rodapé legado ou simplificado e normaliza para blocos estruturados. */
export function normalizarCorpoContrato(corpo: string): string {
  return corpo
    .replace(/\r\n?/g, "\n")
    .replace(
      /(?:^|\n)_{5,}[\s\S]*?CONTRATANTE[\s\S]*?CONTRATADO[^\n]*\n+([^\n]+)/gi,
      "\n\nASSINATURAS DAS PARTES\n$1",
    )
    .replace(
      /(?:^|\n)Testemunhas?\s*1:?[\s\S]*?Testemunha\s*2:?[\s\S]*?_{5,}[\s\S]*?(?:CPF|NOME)[\s\S]*?(?=\n\s*\n|DADOS PARA CONTATO|$)/gi,
      "\n\nTESTEMUNHAS\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Quebra texto respeitando palavras e quebrando caracteres longos sem espaço. */
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
const MARGEM = 44;
const UTIL = LARGURA - MARGEM * 2;
const FONTE = 9.5;
const LINHA = 13.5;
const TOPO = ALTURA - MARGEM;
const BASE = MARGEM + 16;
const CAPACIDADE = TOPO - BASE;
const COLUNA = (UTIL - 24) / 2;

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

  const escrever = (
    texto: string,
    x: number,
    altura: number,
    fonte = regular,
    tamanho = FONTE,
    cor = rgb(0.12, 0.12, 0.12),
  ) => {
    pagina.drawText(texto, { x, y: altura, font: fonte, size: tamanho, color: cor });
  };

  const garantir = (altura: number) => {
    if (y - Math.min(altura, CAPACIDADE) < BASE) {
      pagina = doc.addPage([LARGURA, ALTURA]);
      y = TOPO;
    }
  };

  const linhas = (texto: string, largura = UTIL, fonte = regular, tamanho = FONTE) =>
    texto.split("\n").flatMap((linha) => quebrarLinha(linha, largura, fonte, tamanho));

  // Título do Contrato
  for (const linha of linhas(params.titulo, UTIL, negrito, 12.5)) {
    garantir(18);
    escrever(linha, MARGEM + (UTIL - negrito.widthOfTextAtSize(linha, 12.5)) / 2, y, negrito, 12.5);
    y -= 18;
  }
  y -= 10;

  const paragrafos = corpo.split(/\n\s*\n/).filter((p) => p.trim());

  // Extrai informações do Contratante do preâmbulo (se presente) para o bloco de assinatura
  let contratanteNome = "ELEICAO 2026 MICHELLE DE PAULA FIRMO REINALDO BOLSONARO";
  let contratanteDoc = "CNPJ sob o nº 68.608.523/0001-59";
  const mContratante = corpo.match(/CONTRATANTE:\s*([^,\n]+)(?:[^]*?inscrito\s+no\s+CNPJ\s+sob\s+o\s+nº\s*([0-9./-]+))?/i);
  if (mContratante) {
    if (mContratante[1]?.trim()) contratanteNome = mContratante[1].trim();
    if (mContratante[2]?.trim()) contratanteDoc = `CNPJ sob o nº ${mContratante[2].trim()}`;
  }

  let contratadoNome = "CONTRATADO";
  let contratadoDoc = "";

  for (let i = 0; i < paragrafos.length; i++) {
    const p = paragrafos[i].trim();

    if (p.startsWith("ASSINATURAS DAS PARTES")) {
      const match = p.match(/(?:ASSINATURAS DAS PARTES\s*\n)?([^\n—–]+)(?:\s+[—–]\s+CPF\s*([0-9.-]+))?/);
      if (match) {
        if (match[1]?.trim()) contratadoNome = match[1].trim();
        if (match[2]?.trim()) contratadoDoc = `CPF nº ${match[2].trim()}`;
      }

      // Garante espaço para Assinaturas (70) + Testemunhas (68) + Contato (74) coesos
      garantir(216);

      escrever("ASSINATURAS DAS PARTES", MARGEM, y, negrito, 9.5);
      y -= 38;

      // Linhas vetoriais de assinatura
      pagina.drawLine({
        start: { x: MARGEM, y },
        end: { x: MARGEM + COLUNA, y },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
      });
      pagina.drawLine({
        start: { x: MARGEM + COLUNA + 24, y },
        end: { x: MARGEM + UTIL, y },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
      });

      y -= 12;
      escrever("CONTRATANTE", MARGEM, y, negrito, 8.5);
      escrever("CONTRATADO", MARGEM + COLUNA + 24, y, negrito, 8.5);

      y -= 11;
      const linhasContratante = linhas(contratanteNome, COLUNA, regular, 7.5);
      const linhasContratado = linhas(contratadoNome, COLUNA, regular, 8);
      const maxLinhasNome = Math.max(linhasContratante.length, linhasContratado.length);

      for (let k = 0; k < maxLinhasNome; k++) {
        if (linhasContratante[k]) escrever(linhasContratante[k], MARGEM, y - k * 9.5, regular, 7.5);
        if (linhasContratado[k]) escrever(linhasContratado[k], MARGEM + COLUNA + 24, y - k * 9.5, regular, 8);
      }
      y -= maxLinhasNome * 9.5;

      escrever(contratanteDoc, MARGEM, y, regular, 7.5);
      if (contratadoDoc) escrever(contratadoDoc, MARGEM + COLUNA + 24, y, regular, 8);

      y -= 22;
      continue;
    }

    if (p.startsWith("TESTEMUNHAS")) {
      garantir(75);
      escrever("TESTEMUNHAS", MARGEM, y, negrito, 9.5);
      y -= 34;

      pagina.drawLine({
        start: { x: MARGEM, y },
        end: { x: MARGEM + COLUNA, y },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
      });
      pagina.drawLine({
        start: { x: MARGEM + COLUNA + 24, y },
        end: { x: MARGEM + UTIL, y },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
      });

      y -= 12;
      escrever("Testemunha 1", MARGEM, y, negrito, 8.5);
      escrever("Testemunha 2", MARGEM + COLUNA + 24, y, negrito, 8.5);

      y -= 11;
      escrever("Nome: ____________________________________", MARGEM, y, regular, 8);
      escrever("Nome: ____________________________________", MARGEM + COLUNA + 24, y, regular, 8);

      y -= 10;
      escrever("CPF:  ____________________________________", MARGEM, y, regular, 8);
      escrever("CPF:  ____________________________________", MARGEM + COLUNA + 24, y, regular, 8);

      y -= 20;
      continue;
    }

    if (p.startsWith("DADOS PARA CONTATO E PAGAMENTO")) {
      garantir(85);

      const extrair = (chave: string) => {
        const m = p.match(new RegExp(`${chave}:\\s*([^\\n]+)`, "i"));
        return m ? m[1].trim() : "não informado";
      };
      const email = extrair("E-mail");
      const telefone = extrair("Telefone");
      const banco = extrair("Banco");
      const agencia = extrair("Agência");
      const conta = extrair("Conta");
      const chavePix = extrair("Chave Pix");

      const cardAltura = 72;
      const cardY = y - cardAltura;

      // Fundo e borda do card
      pagina.drawRectangle({
        x: MARGEM,
        y: cardY,
        width: UTIL,
        height: cardAltura,
        color: rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.8, 0.83, 0.88),
        borderWidth: 0.6,
      });

      // Cabeçalho do card
      pagina.drawRectangle({
        x: MARGEM,
        y: y - 18,
        width: UTIL,
        height: 18,
        color: rgb(0.92, 0.94, 0.97),
      });
      escrever("DADOS PARA CONTATO E PAGAMENTO", MARGEM + 10, y - 13, negrito, 8, rgb(0.1, 0.15, 0.2));

      // Linha 1: Contato
      const yL1 = y - 32;
      escrever("E-mail: ", MARGEM + 10, yL1, negrito, 7.5);
      escrever(email, MARGEM + 45, yL1, regular, 7.5);

      escrever("Telefone: ", MARGEM + COLUNA + 24, yL1, negrito, 7.5);
      escrever(telefone, MARGEM + COLUNA + 70, yL1, regular, 7.5);

      // Linha 2: Banco, Agência, Conta
      const yL2 = y - 46;
      escrever("Banco: ", MARGEM + 10, yL2, negrito, 7.5);
      escrever(banco, MARGEM + 45, yL2, regular, 7.5);

      escrever("Agência: ", MARGEM + 240, yL2, negrito, 7.5);
      escrever(agencia, MARGEM + 280, yL2, regular, 7.5);

      escrever("Conta: ", MARGEM + 340, yL2, negrito, 7.5);
      escrever(conta, MARGEM + 372, yL2, regular, 7.5);

      // Linha 3: Chave Pix
      const yL3 = y - 60;
      escrever("Chave Pix: ", MARGEM + 10, yL3, negrito, 7.5);
      escrever(chavePix, MARGEM + 58, yL3, regular, 7.5);

      y = cardY - 14;
      continue;
    }

    // Parágrafos de texto regular
    const tituloSecao = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s.]+$/.test(p) && p.length < 90;
    const fonte = tituloSecao ? negrito : regular;
    const tam = tituloSecao ? 9.5 : FONTE;
    const textoLinhas = linhas(p, UTIL, fonte, tam);

    let reserva = textoLinhas.length * LINHA + 6;
    if (tituloSecao) reserva += 12;
    // Evita separar o fecho ("E, por estarem assim justos...") da data e assinaturas
    if (paragrafos[i + 1]?.startsWith("Brasília") || paragrafos[i + 2]?.startsWith("ASSINATURAS")) {
      reserva += 160;
    }

    garantir(reserva);

    for (let j = 0; j < textoLinhas.length; j++) {
      escrever(textoLinhas[j], MARGEM, y, fonte, tam);
      y -= LINHA;
    }
    y -= tituloSecao ? 6 : 4;
  }

  // Rodapé em todas as páginas
  const paginas = doc.getPages();
  for (const [idx, folha] of paginas.entries()) {
    folha.drawLine({
      start: { x: MARGEM, y: 34 },
      end: { x: LARGURA - MARGEM, y: 34 },
      thickness: 0.4,
      color: rgb(0.75, 0.75, 0.75),
    });
    const rodape = `Página ${idx + 1} de ${paginas.length}`;
    folha.drawText(rodape, {
      x: LARGURA - MARGEM - regular.widthOfTextAtSize(rodape, 8),
      y: 22,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return doc.save();
}
