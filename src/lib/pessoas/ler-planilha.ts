/**
 * Leitura da planilha de cadastro em lote — Fase 4, item 7.
 *
 * Aceita .xlsx (via exceljs, a mesma lib já usada na exportação da Fase 3). O
 * mapeamento de colunas é por cabeçalho, sem distinção de acento/caixa. O número
 * da linha é o da planilha (cabeçalho = 1) para a tela de conferência apontar
 * exatamente onde está cada problema.
 */
import ExcelJS from "exceljs";
import type { LinhaPlanilha } from "./analisar-planilha";

// nome do campo -> aceitáveis no cabeçalho (já normalizados: minúsculo, sem acento)
const COLUNAS: Record<keyof Omit<LinhaPlanilha, "linha">, string[]> = {
  nomeCompleto: ["nome completo", "nome", "nome civil", "colaborador"],
  cpf: ["cpf", "documento"],
  telefone: ["telefone", "celular", "whatsapp", "fone"],
  regiao: ["regiao", "localidade", "area"],
  funcao: ["funcao", "objeto", "cargo"],
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function celulaTexto(valor: ExcelJS.CellValue): string {
  if (valor == null) return "";
  if (typeof valor === "object" && "text" in valor) return String(valor.text ?? "").trim();
  if (typeof valor === "object" && "result" in valor) return String(valor.result ?? "").trim();
  return String(valor).trim();
}

export async function lerPlanilhaPessoas(conteudo: ArrayBuffer | Buffer): Promise<LinhaPlanilha[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(conteudo as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("A planilha não tem nenhuma aba com dados.");

  // Mapa: índice da coluna -> campo.
  const campoPorColuna = new Map<number, keyof Omit<LinhaPlanilha, "linha">>();
  const cabecalho = sheet.getRow(1);
  cabecalho.eachCell((cell, col) => {
    const nome = normalizar(celulaTexto(cell.value));
    for (const [campo, aceitos] of Object.entries(COLUNAS) as [
      keyof Omit<LinhaPlanilha, "linha">,
      string[],
    ][]) {
      if (aceitos.includes(nome)) campoPorColuna.set(col, campo);
    }
  });

  const temNome = [...campoPorColuna.values()].includes("nomeCompleto");
  const temCpf = [...campoPorColuna.values()].includes("cpf");
  if (!temNome && !temCpf) {
    throw new Error(
      "Não encontrei as colunas no cabeçalho. A primeira linha precisa ter ao menos 'nome' e 'cpf'.",
    );
  }

  const linhas: LinhaPlanilha[] = [];
  sheet.eachRow((row, numero) => {
    if (numero === 1) return;

    const registro: LinhaPlanilha = { linha: numero, nomeCompleto: "", cpf: "" };
    let algumValor = false;
    campoPorColuna.forEach((campo, col) => {
      const texto = celulaTexto(row.getCell(col).value);
      if (texto) algumValor = true;
      registro[campo] = texto;
    });

    if (algumValor) linhas.push(registro);
  });

  return linhas;
}
