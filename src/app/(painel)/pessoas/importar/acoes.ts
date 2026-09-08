/**
 * Server Actions da importação de planilha em lote — Fase 4, item 7.
 *
 * `conferirImportacao` só classifica (não grava). `gravarImportacao` re-classifica
 * no servidor (não confia na lista que o cliente diz ser "válida") e insere via
 * o cliente com RLS do usuário — um `coord_regiao` só consegue gravar pessoas da
 * própria região, a policy barra o resto.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterContextoUsuario } from "@/lib/supabase/contexto-usuario";
import { registerPersonWrite } from "@/lib/auditoria/registrar";
import { stripCpf } from "@/lib/documentos/cpf";
import {
  analisarLinhas,
  type LinhaPlanilha,
  type ResultadoAnalise,
} from "@/lib/pessoas/analisar-planilha";

async function cpfsJaCadastrados(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Set<string>> {
  const { data } = await supabase.from("pessoas").select("cpf");
  return new Set((data ?? []).map((p) => stripCpf(p.cpf)));
}

export interface EstadoConferencia {
  status: "ok" | "erro";
  resultado?: ResultadoAnalise;
  mensagem?: string;
}

export async function conferirImportacao(linhas: LinhaPlanilha[]): Promise<EstadoConferencia> {
  const supabase = await createClient();
  const { organizationId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };

  const resultado = analisarLinhas(linhas, await cpfsJaCadastrados(supabase));
  return { status: "ok", resultado };
}

export interface EstadoGravacao {
  status: "ok" | "erro";
  gravados?: number;
  falhas?: { linha: number; motivo: string }[];
  mensagem?: string;
}

export async function gravarImportacao(linhas: LinhaPlanilha[]): Promise<EstadoGravacao> {
  const supabase = await createClient();
  const { organizationId, userId } = await obterContextoUsuario(supabase);
  if (!organizationId) return { status: "erro", mensagem: "Sessão inválida — faça login de novo." };

  // Re-classifica no servidor — a gravação nunca confia no que o cliente marcou.
  const { validos } = analisarLinhas(linhas, await cpfsJaCadastrados(supabase));

  const { data: regioes } = await supabase.from("regioes").select("id, nome");
  const regiaoPorNome = new Map(
    (regioes ?? []).map((r) => [r.nome.trim().toLowerCase(), r.id]),
  );

  let gravados = 0;
  const falhas: { linha: number; motivo: string }[] = [];

  for (const l of validos) {
    const regiaoId = l.regiao ? (regiaoPorNome.get(l.regiao.trim().toLowerCase()) ?? null) : null;

    const { data, error } = await supabase
      .from("pessoas")
      .insert({
        organizacao_id: organizationId,
        nome_completo: l.nomeCompleto.trim(),
        cpf: l.cpfNormalizado,
        telefone: l.telefone?.trim() || null,
        regiao_id: regiaoId,
        funcao: l.funcao?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      falhas.push({
        linha: l.linha,
        motivo: error?.code === "23505" ? "CPF já cadastrado" : "Não foi possível gravar esta linha",
      });
      continue;
    }

    gravados += 1;
    await registerPersonWrite({
      supabase,
      organizationId,
      userId,
      personId: data.id,
      action: "criacao",
    });
  }

  revalidatePath("/pessoas");
  return { status: "ok", gravados, falhas };
}
