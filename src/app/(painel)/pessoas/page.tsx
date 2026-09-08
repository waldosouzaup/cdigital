/**
 * Fase 2, item 1 — CRUD de pessoas ligado ao Supabase real (RLS do usuário logado,
 * via `server.ts`). Server Component: busca dado real e passa para o Client Component
 * que cuida só de interação (busca, filtro, modais).
 */
import { listarPessoas, listarRegioes } from "./dados";
import { PessoasCliente } from "./pessoas-cliente";

export default async function PessoasPage() {
  const [pessoas, regioes] = await Promise.all([listarPessoas(), listarRegioes()]);

  return <PessoasCliente pessoasIniciais={pessoas} regioes={regioes} />;
}
