/**
 * Item 2 — cadastro de Região de Atuação. Server Component: busca as regiões (com
 * a contagem de pessoas) e entrega ao Client Component.
 */
import { listarRegioesComContagem } from "./dados";
import { RegioesCliente } from "./regioes-cliente";

export const metadata = { title: "Regiões de Atuação — Comitê Digital" };

export default async function RegioesPage() {
  const regioes = await listarRegioesComContagem();
  return <RegioesCliente regioesIniciais={regioes} />;
}
