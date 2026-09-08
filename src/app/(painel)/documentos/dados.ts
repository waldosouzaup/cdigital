/**
 * Leitura de documentos para a mesa de triagem — Fase 2, item 6. Sempre pelo
 * cliente com RLS do usuário (`server.ts`); isolamento por organização/região vem
 * de graça da policy (`documentos_organizacao_regiao`, Fase 1).
 */
import { createClient } from "@/lib/supabase/server";

export interface DocumentoListado {
  id: string;
  pessoaId: string;
  pessoaNome: string;
  pessoaCpf: string;
  tipo: string;
  nomeOriginal: string;
  caminhoStorage: string;
  larguraPx: number | null;
  alturaPx: number | null;
  bytes: number | null;
  hashSha256: string;
  status: "pendente" | "aprovado" | "rejeitado";
  motivoRejeicao: string | null;
  versao: number;
  criadoEm: string;
}

interface LinhaDocumento {
  id: string;
  pessoa_id: string;
  tipo: string;
  nome_original: string;
  caminho_storage: string;
  largura_px: number | null;
  altura_px: number | null;
  bytes: number | null;
  hash_sha256: string;
  status: "pendente" | "aprovado" | "rejeitado";
  motivo_rejeicao: string | null;
  versao: number;
  criado_em: string;
  pessoas: { nome_completo: string; cpf: string } | null;
}

export async function listarDocumentos(): Promise<DocumentoListado[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documentos")
    .select(
      "id, pessoa_id, tipo, nome_original, caminho_storage, largura_px, altura_px, bytes, hash_sha256, status, motivo_rejeicao, versao, criado_em, pessoas ( nome_completo, cpf )",
    )
    .order("criado_em", { ascending: false })
    .returns<LinhaDocumento[]>();

  if (error) throw new Error("Não foi possível carregar os documentos.");

  return (data ?? []).map((linha) => ({
    id: linha.id,
    pessoaId: linha.pessoa_id,
    pessoaNome: linha.pessoas?.nome_completo ?? "—",
    pessoaCpf: linha.pessoas?.cpf ?? "—",
    tipo: linha.tipo,
    nomeOriginal: linha.nome_original,
    caminhoStorage: linha.caminho_storage,
    larguraPx: linha.largura_px,
    alturaPx: linha.altura_px,
    bytes: linha.bytes,
    hashSha256: linha.hash_sha256,
    status: linha.status,
    motivoRejeicao: linha.motivo_rejeicao,
    versao: linha.versao,
    criadoEm: linha.criado_em,
  }));
}
