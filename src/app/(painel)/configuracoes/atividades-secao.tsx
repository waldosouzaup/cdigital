"use client";

import { RegistrarServiceWorker } from "@/components/registrar-service-worker";
import { AtividadesCliente } from "../atividades/atividades-cliente";
import type {
  PessoaOpcao,
  RegiaoOpcao,
  RegistroAtividadeListado,
} from "../atividades/dados";

export function AtividadesSecao({
  regioes,
  pessoas,
  registros,
}: {
  regioes: RegiaoOpcao[];
  pessoas: PessoaOpcao[];
  registros: RegistroAtividadeListado[];
}) {
  return (
    <div className="space-y-6">
      <RegistrarServiceWorker />

      {/* Banner Informativo de Governança de Campo */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-ink-muted">
        <div className="flex items-center gap-2 font-semibold text-ink mb-1">
          <span>📌</span>
          <span>Apontamento Rápido de Campo &amp; Prestação de Contas</span>
        </div>
        <p>
          Módulo de registro em 3 toques para equipes e coordenadores de rua. Opera com sincronização
          em tempo real e suporte offline completo (PWA): as ações registradas sem internet entram
          na fila local e sobem automaticamente assim que a conexão for restabelecida.
        </p>
      </div>

      <AtividadesCliente
        regioes={regioes}
        pessoas={pessoas}
        registros={registros}
      />
    </div>
  );
}
