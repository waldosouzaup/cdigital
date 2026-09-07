/**
 * Log de auditoria — Fase 1, item 10: "gravando em toda leitura de documento e toda
 * escrita em pessoas e contratos". Somente inserção (a tabela não tem policy de
 * update/delete — ver src/db/schema.ts).
 *
 * Escreve pelo cliente Supabase de quem chama (server.ts, com RLS do próprio
 * usuário), não pelo admin — a policy de `log_auditoria` já permite insert dentro
 * da própria organização, então não há motivo para bypassar RLS aqui.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

interface RegistrarAuditoriaParams {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
}

async function registrarAuditoria({
  supabase,
  organizationId,
  userId,
  action,
  entity,
  entityId = null,
  ip = null,
}: RegistrarAuditoriaParams): Promise<void> {
  const { error } = await supabase.from("log_auditoria").insert({
    organizacao_id: organizationId,
    usuario_id: userId,
    acao: action,
    entidade: entity,
    entidade_id: entityId,
    ip,
  });

  if (error) {
    // Regra 7: nada sensível na mensagem — nunca incluir dado da linha auditada aqui.
    throw new Error("Não foi possível registrar o log de auditoria.");
  }
}

export async function registerDocumentAccess(params: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  entity: string;
  documentId: string;
}): Promise<void> {
  await registrarAuditoria({
    supabase: params.supabase,
    organizationId: params.organizationId,
    userId: params.userId,
    action: "leitura_documento",
    entity: params.entity,
    entityId: params.documentId,
  });
}

export async function registerPersonWrite(params: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  personId: string;
  action: "criacao" | "edicao";
}): Promise<void> {
  await registrarAuditoria({
    supabase: params.supabase,
    organizationId: params.organizationId,
    userId: params.userId,
    action: params.action,
    entity: "pessoas",
    entityId: params.personId,
  });
}

export async function registerContractWrite(params: {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string | null;
  contractId: string;
  action: string;
}): Promise<void> {
  await registrarAuditoria({
    supabase: params.supabase,
    organizationId: params.organizationId,
    userId: params.userId,
    action: params.action,
    entity: "contratos",
    entityId: params.contractId,
  });
}
