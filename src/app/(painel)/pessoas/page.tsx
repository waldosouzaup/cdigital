/**
 * Fase 2, item 1 — CRUD de pessoas ligado ao Supabase real (RLS do usuário logado,
 * via `server.ts`). Server Component: busca dado real e passa para o Client Component
 * que cuida só de interação (busca, filtro, modais).
 */
import Link from "next/link";
import { Alerta } from "@/components/alerta";
import { contarAutoinscritosPendentes, listarPessoas, listarRegioes } from "./dados";
import { PessoasCliente } from "./pessoas-cliente";

export default async function PessoasPage() {
  const [pessoas, regioes, autoinscritosPendentes] = await Promise.all([
    listarPessoas(),
    listarRegioes(),
    contarAutoinscritosPendentes(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      {autoinscritosPendentes > 0 && (
        <Alerta
          tom="atencao"
          titulo={`${autoinscritosPendentes} cadastro(s) por autoinscrição aguardando triagem`}
          acao={
            <Link href="/documentos" className="text-small font-medium underline underline-offset-4">
              Ir para a conferência →
            </Link>
          }
        >
          Novos colaboradores se inscreveram pelo link público e precisam entrar no fluxo de
          aprovação. Use o filtro “Somente autoinscritos” abaixo para vê-los.
        </Alerta>
      )}
      <PessoasCliente pessoasIniciais={pessoas} regioes={regioes} />
    </div>
  );
}
