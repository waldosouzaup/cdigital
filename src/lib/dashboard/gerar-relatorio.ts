/**
 * Relatório institucional em PDF — Fase 3, item 7. Mesma engine do PDF de
 * contrato (`pdf-lib`, decisão registrada em CONSULTAS.md), texto monoespaçado
 * para as tabelas (colunas alinhadas por espaço, sem depender de HTML/CSS).
 */
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";
import type { Funil, MatrizObjetoStatus } from "./agregacoes";

export interface DadosRelatorio {
  organizacaoNome: string;
  geradoEm: Date;
  funil: Funil;
  matriz: MatrizObjetoStatus;
  regioes: {
    nome: string;
    totalPessoas: number;
    pessoasAptas: number;
    contratosAssinados: number;
    coberturaDocumentalPct: number | null;
  }[];
}

const LARGURA_PAGINA = 595.28;
const ALTURA_PAGINA = 841.89;
const MARGEM = 48;
const TAMANHO_CORPO = 9;
const TAMANHO_TITULO = 16;
const TAMANHO_SECAO = 12;
const ALTURA_LINHA = 13;

function formatarValor(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function colunas(...celulas: { texto: string; largura: number }[]): string {
  return celulas.map((c) => c.texto.slice(0, c.largura).padEnd(c.largura)).join(" ");
}

export async function gerarPdfRelatorio(dados: DadosRelatorio): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonteRegular = await pdfDoc.embedFont(StandardFonts.Courier);
  const fonteNegrito = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fonteTitulo = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
  let y = ALTURA_PAGINA - MARGEM;

  function novaPaginaSeNecessario() {
    if (y < MARGEM + ALTURA_LINHA * 2) {
      page = pdfDoc.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
      y = ALTURA_PAGINA - MARGEM;
    }
  }

  function escrever(texto: string, opcoes: { fonte?: PDFFont; tamanho?: number } = {}) {
    novaPaginaSeNecessario();
    page.drawText(texto, {
      x: MARGEM,
      y,
      size: opcoes.tamanho ?? TAMANHO_CORPO,
      font: opcoes.fonte ?? fonteRegular,
    });
    y -= (opcoes.tamanho ?? TAMANHO_CORPO) + 4;
  }

  function espaco(altura = ALTURA_LINHA) {
    y -= altura;
  }

  // Cabeçalho institucional
  page.drawText(dados.organizacaoNome, { x: MARGEM, y, size: TAMANHO_TITULO, font: fonteTitulo });
  y -= TAMANHO_TITULO + 6;
  escrever(
    `Relatório consolidado — gerado em ${dados.geradoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
  );
  espaco(10);

  // Funil
  escrever("FUNIL DE CONVERSÃO", { fonte: fonteNegrito, tamanho: TAMANHO_SECAO });
  espaco(4);
  const etapasFunil: [string, number][] = [
    ["Cadastrados", dados.funil.cadastrado],
    ["Aptos", dados.funil.apto],
    ["Contrato emitido", dados.funil.emitido],
    ["Contrato enviado", dados.funil.enviado],
    ["Contrato assinado", dados.funil.assinado],
  ];
  for (const [rotulo, valor] of etapasFunil) {
    escrever(colunas({ texto: rotulo, largura: 28 }, { texto: String(valor), largura: 8 }));
  }
  espaco(10);

  // Matriz objeto × status
  escrever("MATRIZ POR OBJETO CONTRATUAL", { fonte: fonteNegrito, tamanho: TAMANHO_SECAO });
  espaco(4);
  escrever(
    colunas(
      { texto: "Objeto", largura: 32 },
      { texto: "Emitido", largura: 9 },
      { texto: "Enviado", largura: 9 },
      { texto: "Assinado", largura: 9 },
      { texto: "Total", largura: 7 },
      { texto: "Valor", largura: 14 },
    ),
    { fonte: fonteNegrito },
  );
  for (const linha of dados.matriz.linhas) {
    const porStatus = (s: ContractStatus) => String(linha.porStatus[s] ?? 0);
    escrever(
      colunas(
        { texto: linha.objeto, largura: 32 },
        { texto: porStatus("emitido"), largura: 9 },
        { texto: porStatus("enviado"), largura: 9 },
        { texto: porStatus("assinado"), largura: 9 },
        { texto: String(linha.total), largura: 7 },
        { texto: formatarValor(linha.valorTotal), largura: 14 },
      ),
    );
  }
  escrever(
    colunas(
      { texto: "TOTAL GERAL", largura: 32 },
      { texto: "", largura: 9 },
      { texto: "", largura: 9 },
      { texto: "", largura: 9 },
      { texto: String(dados.matriz.totalGeral), largura: 7 },
      { texto: formatarValor(dados.matriz.valorTotalGeral), largura: 14 },
    ),
    { fonte: fonteNegrito },
  );
  espaco(10);

  // Visão regional
  escrever("COBERTURA POR REGIÃO", { fonte: fonteNegrito, tamanho: TAMANHO_SECAO });
  espaco(4);
  escrever(
    colunas(
      { texto: "Região", largura: 22 },
      { texto: "Pessoas", largura: 9 },
      { texto: "Aptas", largura: 8 },
      { texto: "Assinados", largura: 10 },
      { texto: "Cobertura", largura: 10 },
    ),
    { fonte: fonteNegrito },
  );
  for (const r of dados.regioes) {
    escrever(
      colunas(
        { texto: r.nome, largura: 22 },
        { texto: String(r.totalPessoas), largura: 9 },
        { texto: String(r.pessoasAptas), largura: 8 },
        { texto: String(r.contratosAssinados), largura: 10 },
        // "não informado", nunca 0%, quando a região não tem pessoa (Seção 11).
        { texto: r.coberturaDocumentalPct === null ? "não informado" : `${r.coberturaDocumentalPct}%`, largura: 10 },
      ),
    );
  }

  return pdfDoc.save();
}
