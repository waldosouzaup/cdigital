/**
 * Fase 4, item 1 — "registro de atividade em no máximo 3 toques a partir da tela
 * inicial". Server Component: busca contexto real (pessoas, regiões, últimos
 * registros) com a RLS do usuário e entrega ao Client Component, que cuida do
 * fluxo de campo (uma mão, 360 px).
 */
import { RegistrarServiceWorker } from "@/components/registrar-service-worker";
import { listarContextoAtividades } from "./dados";
import { AtividadesCliente } from "./atividades-cliente";

export default async function AtividadesPage() {
  const { regioes, pessoas, registros } = await listarContextoAtividades();
  return (
    <>
      <RegistrarServiceWorker />
      <AtividadesCliente regioes={regioes} pessoas={pessoas} registros={registros} />
    </>
  );
}
