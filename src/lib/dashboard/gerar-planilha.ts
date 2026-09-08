/**
 * Exportação em XLSX (base nominal) — Fase 3, item 7.
 *
 * Decisão registrada em CONSULTAS.md: `exceljs` no lugar de `xlsx`/SheetJS — a
 * versão publicada no npm de `xlsx` tem duas vulnerabilidades sem correção
 * disponível pelo próprio npm (Prototype Pollution, ReDoS).
 */
import ExcelJS from "exceljs";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";

export interface PessoaParaPlanilha {
  nomeCompleto: string;
  cpf: string;
  funcao: string | null;
  regiaoNome: string | null;
  apta: boolean;
  statusContrato: ContractStatus | null;
}

const ROTULO_STATUS: Partial<Record<ContractStatus, string>> = {
  rascunho: "Rascunho",
  emitido: "Emitido",
  enviado: "Enviado",
  assinado: "Assinado",
  distratado: "Distratado",
  distrato_assinado: "Distrato assinado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export async function gerarXlsxNominal(pessoas: PessoaParaPlanilha[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Comitê Digital";
  workbook.created = new Date();

  const planilha = workbook.addWorksheet("Base Nominal");
  planilha.columns = [
    { header: "Nome Completo", key: "nome", width: 32 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Função", key: "funcao", width: 28 },
    { header: "Região", key: "regiao", width: 20 },
    { header: "Documentação", key: "documentacao", width: 16 },
    { header: "Status do Contrato", key: "statusContrato", width: 18 },
  ];
  planilha.getRow(1).font = { bold: true };

  for (const p of pessoas) {
    planilha.addRow({
      nome: p.nomeCompleto,
      cpf: p.cpf,
      // Célula em branco em vez de "null"/"undefined" literal — nenhuma fórmula
      // quebrada quando o Excel abre uma linha sem função/região cadastrada.
      funcao: p.funcao ?? "",
      regiao: p.regiaoNome ?? "",
      documentacao: p.apta ? "Aprovada" : "Pendente",
      statusContrato: p.statusContrato ? (ROTULO_STATUS[p.statusContrato] ?? p.statusContrato) : "Sem contrato",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
