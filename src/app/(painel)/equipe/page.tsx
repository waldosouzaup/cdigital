/**
 * Gestão de Acessos (Feature A) — o gestor cadastra e administra usuários de todos
 * os papéis. Server Component: busca dado real com a RLS do usuário e passa para o
 * Client Component.
 */
import { listarEquipe } from "./dados";
import { listarRegioes } from "../pessoas/dados";
import { EquipeCliente } from "./equipe-cliente";

export const metadata = { title: "Equipe & Acessos — Comitê Digital" };

export default async function EquipePage() {
  const [membros, regioes] = await Promise.all([listarEquipe(), listarRegioes()]);
  return <EquipeCliente membrosIniciais={membros} regioes={regioes} />;
}
