/**
 * Dashboard — Fase 3. Server Component carrega tudo de uma vez (item: "carrega
 * em menos de 2s com 500 pessoas e 2.000 contratos"); o Client Component cuida
 * da assinatura Realtime, do detalhamento progressivo e da exportação.
 */
import { buscarDadosDashboard } from "./dados";
import { DashboardCliente } from "./dashboard-cliente";

export default async function DashboardPage() {
  const dados = await buscarDadosDashboard();

  return <DashboardCliente dadosIniciais={dados} />;
}
