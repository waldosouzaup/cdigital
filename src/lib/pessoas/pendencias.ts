/**
 * Checklist de pendências por pessoa — Fase 2, item 14. Função pura: transforma o
 * estado atual (documentos + aptidão + status do contrato) numa lista do que ainda
 * falta, para o coordenador saber o que cobrar sem precisar interpretar badges
 * espalhados. Reaproveita `DOCUMENTOS_OBRIGATORIOS` de `aptidao.ts` — nunca duplica
 * a lista de tipos exigidos em outro lugar.
 */
import { DOCUMENTOS_OBRIGATORIOS } from "./aptidao";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";

export type SeveridadePendencia = "critica" | "atencao";

export interface Pendencia {
  codigo: string;
  descricao: string;
  severidade: SeveridadePendencia;
}

export interface DocumentoParaPendencia {
  tipo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  versao?: number;
}

export interface FatosPessoa {
  documentos: DocumentoParaPendencia[];
  apta: boolean;
  contratoStatus: ContractStatus | null;
}

const ROTULO_TIPO_DOCUMENTO: Record<string, string> = {
  documento_identidade: "Documento de identidade",
  comprovante_endereco: "Comprovante de residência",
};

function rotuloTipo(tipo: string): string {
  return ROTULO_TIPO_DOCUMENTO[tipo] ?? tipo;
}

export function calcularPendencias(fatos: FatosPessoa): Pendencia[] {
  const pendencias: Pendencia[] = [];

  for (const tipoObrigatorio of DOCUMENTOS_OBRIGATORIOS) {
    const doTipo = fatos.documentos.filter((d) => d.tipo === tipoObrigatorio);

    if (doTipo.length === 0) {
      pendencias.push({
        codigo: `documento_ausente:${tipoObrigatorio}`,
        descricao: `${rotuloTipo(tipoObrigatorio)} não enviado`,
        severidade: "critica",
      });
      continue;
    }

    const maisRecente = doTipo.reduce((maior, atual) =>
      (atual.versao ?? 1) > (maior.versao ?? 1) ? atual : maior,
    );

    if (maisRecente.status === "pendente") {
      pendencias.push({
        codigo: `documento_pendente:${tipoObrigatorio}`,
        descricao: `${rotuloTipo(tipoObrigatorio)} aguardando conferência`,
        severidade: "atencao",
      });
    } else if (maisRecente.status === "rejeitado") {
      pendencias.push({
        codigo: `documento_rejeitado:${tipoObrigatorio}`,
        descricao: `${rotuloTipo(tipoObrigatorio)} rejeitado — aguardando reenvio`,
        severidade: "critica",
      });
    }
  }

  // Pendência de contrato só faz sentido depois que a pessoa está apta — antes
  // disso, "sem contrato" não é uma pendência, é a ordem natural das coisas.
  if (fatos.apta) {
    if (fatos.contratoStatus === null || fatos.contratoStatus === "rascunho") {
      pendencias.push({
        codigo: "contrato_nao_emitido",
        descricao: "Apto(a) para contrato, mas nenhum contrato foi emitido ainda",
        severidade: "atencao",
      });
    } else if (fatos.contratoStatus === "emitido") {
      pendencias.push({
        codigo: "contrato_nao_enviado",
        descricao: "Contrato emitido, aguardando envio",
        severidade: "atencao",
      });
    } else if (fatos.contratoStatus === "enviado") {
      pendencias.push({
        codigo: "contrato_nao_assinado",
        descricao: "Contrato enviado, aguardando assinatura",
        severidade: "atencao",
      });
    }
  }

  return pendencias;
}
