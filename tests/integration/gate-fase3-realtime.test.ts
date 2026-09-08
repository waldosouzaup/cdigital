import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAdminClient, createClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Gate de saída da Fase 3:
 * - "Teste e2e com duas sessões: alteração numa aparece na outra em menos de 3s."
 * - "Um coord_regiao assinado no Realtime não recebe evento de outra região —
 *   verifique no socket, não só na tela."
 *
 * Os dois exigem uma conexão WebSocket real (não dá pra provar só olhando o
 * banco) — os testes abrem um canal de verdade, contra o Supabase real, e
 * esperam o evento chegar pelo `on('postgres_changes', ...)`, cronometrando.
 */
const SENHA_TESTE = "SenhaDeTeste!123456";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function aguardarStatus(canal: RealtimeChannel, statusEsperado: string, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cronometro = setTimeout(() => reject(new Error(`Timeout esperando status ${statusEsperado}`)), timeoutMs);
    canal.subscribe((status) => {
      if (status === statusEsperado) {
        clearTimeout(cronometro);
        resolve();
      }
    });
  });
}

function aguardarCondicao(condicao: () => boolean, timeoutMs: number, intervaloMs = 50): Promise<boolean> {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const verificar = () => {
      if (condicao()) return resolve(true);
      if (Date.now() - inicio >= timeoutMs) return resolve(false);
      setTimeout(verificar, intervaloMs);
    };
    verificar();
  });
}

describe("Gate Fase 3 — Realtime (propagação <3s, isolamento por região no socket)", () => {
  let orgId: string;
  let regiaoAId: string;
  let regiaoBId: string;
  let pessoaGenericaId: string;
  let pessoaRegiaoAId: string;
  let pessoaRegiaoBId: string;
  let auditorUserId: string;
  let coordRegiaoUserId: string;
  const emailAuditor = "gate-fase3-realtime-auditor@exemplo.invalid";
  const emailCoordRegiao = "gate-fase3-realtime-coord@exemplo.invalid";

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizacoes")
      .select("id")
      .eq("nome", "Comitê Michelle — Eleição 2026")
      .single();
    orgId = org!.id;

    const { data: regioes } = await admin.from("regioes").select("id, nome").eq("organizacao_id", orgId).limit(2);
    regiaoAId = regioes![0].id;
    regiaoBId = regioes![1].id;

    const { data: pessoaGenerica } = await admin
      .from("pessoas")
      .insert({ organizacao_id: orgId, nome_completo: "Pessoa Teste Realtime Geral", cpf: generateValidCpf("55511122"), regiao_id: regiaoAId })
      .select("id")
      .single();
    pessoaGenericaId = pessoaGenerica!.id;

    const { data: pessoaA } = await admin
      .from("pessoas")
      .insert({ organizacao_id: orgId, nome_completo: "Pessoa Teste Região A", cpf: generateValidCpf("55522233"), regiao_id: regiaoAId })
      .select("id")
      .single();
    pessoaRegiaoAId = pessoaA!.id;

    const { data: pessoaB } = await admin
      .from("pessoas")
      .insert({ organizacao_id: orgId, nome_completo: "Pessoa Teste Região B", cpf: generateValidCpf("55533344"), regiao_id: regiaoBId })
      .select("id")
      .single();
    pessoaRegiaoBId = pessoaB!.id;

    const { data: authAuditor } = await admin.auth.admin.createUser({ email: emailAuditor, password: SENHA_TESTE, email_confirm: true });
    auditorUserId = authAuditor!.user!.id;
    await admin.from("usuarios").insert({ id: auditorUserId, organizacao_id: orgId, nome: "Auditor Realtime", email: emailAuditor, papel: "auditor" });

    // coord_regiao não é restrito pela policy de MFA (só gestor/coord_comite são) —
    // funciona autenticado só com senha, sem TOTP, mesmo padrão de
    // rls-isolamento.test.ts.
    const { data: authCoord } = await admin.auth.admin.createUser({ email: emailCoordRegiao, password: SENHA_TESTE, email_confirm: true });
    coordRegiaoUserId = authCoord!.user!.id;
    await admin
      .from("usuarios")
      .insert({ id: coordRegiaoUserId, organizacao_id: orgId, nome: "Coord Região A Realtime", email: emailCoordRegiao, papel: "coord_regiao", regiao_id: regiaoAId });
  }, 30000);

  afterAll(async () => {
    await admin.from("usuarios").delete().in("id", [auditorUserId, coordRegiaoUserId]);
    await admin.auth.admin.deleteUser(auditorUserId).catch(() => {});
    await admin.auth.admin.deleteUser(coordRegiaoUserId).catch(() => {});
    await admin.from("pessoas").delete().in("id", [pessoaGenericaId, pessoaRegiaoAId, pessoaRegiaoBId]);
  }, 30000);

  it(
    "uma alteração feita por uma sessão aparece via socket em outra sessão em menos de 3s",
    async () => {
      const ouvinte = anonClient();
      await ouvinte.auth.signInWithPassword({ email: emailAuditor, password: SENHA_TESTE });

      let eventoRecebido: { new: { telefone: string | null } } | null = null;
      const canal = ouvinte.channel("teste-propagacao-3s").on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pessoas", filter: `id=eq.${pessoaGenericaId}` },
        (payload) => {
          eventoRecebido = payload as unknown as { new: { telefone: string | null } };
        },
      );

      await aguardarStatus(canal, "SUBSCRIBED");
      // Pequena folga entre o ack de SUBSCRIBED e o listener de replicação do
      // Postgres estar de fato pronto do lado do servidor Realtime — sem isso, uma
      // mudança disparada logo após o ack pode chegar antes do registro completar
      // (achado ao rodar este teste pela primeira vez: falhava sem esta folga).
      await new Promise((resolve) => setTimeout(resolve, 500));

      const inicio = Date.now();
      await admin.from("pessoas").update({ telefone: "(61) 99999-0000" }).eq("id", pessoaGenericaId);

      const chegou = await aguardarCondicao(() => eventoRecebido !== null, 3000);
      const duracaoMs = Date.now() - inicio;

      ouvinte.removeChannel(canal);

      expect(chegou).toBe(true);
      expect(duracaoMs).toBeLessThan(3000);
      expect(eventoRecebido!.new.telefone).toBe("(61) 99999-0000");
    },
    15000,
  );

  it(
    "coord_regiao assinado no Realtime NÃO recebe evento de outra região, mas recebe da própria",
    async () => {
      const ouvinte = anonClient();
      await ouvinte.auth.signInWithPassword({ email: emailCoordRegiao, password: SENHA_TESTE });

      const eventosRecebidos: { pessoaId: string }[] = [];
      const canal = ouvinte.channel("teste-isolamento-regiao").on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pessoas" },
        (payload) => {
          const novo = (payload as unknown as { new: { id: string } }).new;
          eventosRecebidos.push({ pessoaId: novo.id });
        },
      );

      await aguardarStatus(canal, "SUBSCRIBED");

      // Atualiza a pessoa da região B primeiro — o coord_regiao de A não deveria
      // nem ver a linha (RLS aplicada por linha no próprio Realtime), então
      // nenhum evento chega para este socket.
      await admin.from("pessoas").update({ telefone: "(61) 98888-0000" }).eq("id", pessoaRegiaoBId);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // tempo de sobra pra um evento indevido chegar

      const recebeuDaOutraRegiao = eventosRecebidos.some((e) => e.pessoaId === pessoaRegiaoBId);

      // Agora atualiza a pessoa da PRÓPRIA região — este evento precisa chegar.
      await admin.from("pessoas").update({ telefone: "(61) 97777-0000" }).eq("id", pessoaRegiaoAId);
      const chegouDaPropriaRegiao = await aguardarCondicao(
        () => eventosRecebidos.some((e) => e.pessoaId === pessoaRegiaoAId),
        3000,
      );

      ouvinte.removeChannel(canal);

      expect(recebeuDaOutraRegiao).toBe(false);
      expect(chegouDaPropriaRegiao).toBe(true);
    },
    15000,
  );
});
