/**
 * Mesa de triagem — Fase 2, item 6: aprovar/rejeitar documento e marcar pessoa
 * apta. Server Component busca dado real; o Client Component cuida só de filtro e
 * modal de rejeição.
 */
import Link from "next/link";
import { Alerta } from "@/components/alerta";
import { listarDocumentos } from "./dados";
import { contarAutoinscritosPendentes } from "../pessoas/dados";
import { DocumentosCliente } from "./documentos-cliente";

export default async function DocumentosPage() {
  const [documentos, autoinscritosPendentes] = await Promise.all([
    listarDocumentos(),
    contarAutoinscritosPendentes(),
  ]);

  return (
    <div className="space-y-6">
      {autoinscritosPendentes > 0 && (
        <Alerta
          tom="atencao"
          titulo={`${autoinscritosPendentes} cadastro(s) por autoinscrição aguardando aprovação`}
          acao={
            <Link href="/pessoas" className="text-small font-medium underline underline-offset-4">
              Ver no quadro de pessoas →
            </Link>
          }
        >
          Colaboradores que se inscreveram pelo link público. Aprove os documentos abaixo para
          liberá-los para a emissão do contrato.
        </Alerta>
      )}
      <DocumentosCliente documentosIniciais={documentos} />
    </div>
  );
}
