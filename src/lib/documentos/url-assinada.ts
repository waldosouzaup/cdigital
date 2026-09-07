/**
 * URL assinada de Storage — Seção 3.1 e Seção 10: "sempre assinadas, validade
 * máxima de 15 minutos, gerada no servidor após a checagem de permissão."
 *
 * Não recebe o cliente Supabase por acaso: quem chama decide se é o cliente do
 * usuário (server.ts, respeitando RLS) ou o admin (admin.ts, só nos casos
 * permitidos pela Seção 3.1) — esta função não escolhe isso por conta própria.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerDocumentAccess } from "@/lib/auditoria/registrar";

export const VALIDADE_MAXIMA_SEGUNDOS = 900; // 15 minutos (Seção 3.1 / Seção 10)

export interface ParametrosUrlAssinada {
  supabase: SupabaseClient;
  bucket: "documentos" | "contratos";
  caminho: string;
  /** id da linha em `documentos` (ou `contratos`), para o log de auditoria. */
  documentId: string;
  organizationId: string;
  userId: string | null;
  expiraEmSegundos?: number;
}

export async function criarUrlAssinada({
  supabase,
  bucket,
  caminho,
  documentId,
  organizationId,
  userId,
  expiraEmSegundos = VALIDADE_MAXIMA_SEGUNDOS,
}: ParametrosUrlAssinada): Promise<string> {
  if (expiraEmSegundos > VALIDADE_MAXIMA_SEGUNDOS) {
    throw new Error(
      `Validade de URL assinada não pode passar de ${VALIDADE_MAXIMA_SEGUNDOS} segundos.`,
    );
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(caminho, expiraEmSegundos);

  if (error || !data) {
    // Nunca incluir `caminho` na mensagem de erro (Regra 7: nada sensível em log
    // ou mensagem de erro — o caminho contém pessoa_id).
    throw new Error("Não foi possível gerar a URL de acesso ao documento.");
  }

  // "Log de auditoria gravando em toda leitura de documento" (Fase 1, item 10).
  await registerDocumentAccess({ supabase, organizationId, userId, entity: bucket, documentId });

  return data.signedUrl;
}
