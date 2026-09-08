/**
 * Mesa de triagem — Fase 2, item 6: aprovar/rejeitar documento e marcar pessoa
 * apta. Server Component busca dado real; o Client Component cuida só de filtro e
 * modal de rejeição.
 */
import { listarDocumentos } from "./dados";
import { DocumentosCliente } from "./documentos-cliente";

export default async function DocumentosPage() {
  const documentos = await listarDocumentos();

  return <DocumentosCliente documentosIniciais={documentos} />;
}
