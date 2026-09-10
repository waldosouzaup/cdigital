import { describe, it, expect } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

describe("Filtro de Contratos por Estado", () => {
  it("filtra corretamente os contratos pelo status fornecido", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const rollback = new Error("ROLLBACK_TESTE_FILTRO_STATUS");

    try {
      await sql.begin(async (tx) => {
        const [{ id: orgId }] = await tx`
          INSERT INTO public.organizacoes (nome)
          VALUES ('Comitê Teste Filtro Status')
          RETURNING id
        `;

        const userId = randomUUID();
        await tx`
          INSERT INTO auth.users (id, email)
          VALUES (${userId}, 'teste.status@exemplo.org')
          ON CONFLICT (id) DO NOTHING
        `;
        await tx`
          INSERT INTO public.usuarios (id, organizacao_id, nome, email, papel, ativo)
          VALUES (${userId}, ${orgId}, 'Admin Teste Status', 'teste.status@exemplo.org', 'gestor', true)
        `;

        // Criar 3 pessoas
        const [{ id: p1 }] = await tx`INSERT INTO public.pessoas(organizacao_id, nome_completo, cpf, apta) VALUES (${orgId}, 'Pessoa Assinada', '11111111111', true) RETURNING id`;
        const [{ id: p2 }] = await tx`INSERT INTO public.pessoas(organizacao_id, nome_completo, cpf, apta) VALUES (${orgId}, 'Pessoa Enviada', '22222222222', true) RETURNING id`;
        const [{ id: p3 }] = await tx`INSERT INTO public.pessoas(organizacao_id, nome_completo, cpf, apta) VALUES (${orgId}, 'Pessoa Distratada', '33333333333', true) RETURNING id`;

        // Criar 3 contratos com status distintos
        await tx`INSERT INTO public.contratos(organizacao_id, pessoa_id, objeto, valor, valor_extenso, vigencia_inicio, vigencia_fim, status)
                 VALUES (${orgId}, ${p1}, 'Função 1', 1000, 'mil reais', '2026-09-01', '2026-10-01', 'assinado')`;
        await tx`INSERT INTO public.contratos(organizacao_id, pessoa_id, objeto, valor, valor_extenso, vigencia_inicio, vigencia_fim, status)
                 VALUES (${orgId}, ${p2}, 'Função 2', 2000, 'dois mil reais', '2026-09-01', '2026-10-01', 'enviado')`;
        await tx`INSERT INTO public.contratos(organizacao_id, pessoa_id, objeto, valor, valor_extenso, vigencia_inicio, vigencia_fim, status)
                 VALUES (${orgId}, ${p3}, 'Função 3', 3000, 'três mil reais', '2026-09-01', '2026-10-01', 'distratado')`;

        // Autenticar no contexto da organização
        const claims = {
          role: "authenticated",
          sub: userId,
          organizacao_id: orgId,
          papel: "gestor",
          aal: "aal1",
        };
        await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
        await tx`set local role authenticated`;

        // 1. Sem filtro de status no quadro ativo: deve trazer 2 (assinado e enviado)
        const [{ r: todosAtivos }] = await tx`
          SELECT public.buscar_contratos_paginados('', 'ativos', 1, 20, '') AS r
        `;
        expect(todosAtivos.total).toBe(2);
        expect(todosAtivos.itens).toHaveLength(2);

        // 2. Filtrando por 'assinado'
        const [{ r: apenasAssinados }] = await tx`
          SELECT public.buscar_contratos_paginados('', 'ativos', 1, 20, 'assinado') AS r
        `;
        expect(apenasAssinados.total).toBe(1);
        expect(apenasAssinados.itens).toHaveLength(1);
        expect(apenasAssinados.itens[0].status).toBe("assinado");
        expect(apenasAssinados.itens[0].pessoas.nome_completo).toBe("Pessoa Assinada");

        // 3. Filtrando por 'enviado'
        const [{ r: apenasEnviados }] = await tx`
          SELECT public.buscar_contratos_paginados('', 'ativos', 1, 20, 'enviado') AS r
        `;
        expect(apenasEnviados.total).toBe(1);
        expect(apenasEnviados.itens).toHaveLength(1);
        expect(apenasEnviados.itens[0].status).toBe("enviado");
        expect(apenasEnviados.itens[0].pessoas.nome_completo).toBe("Pessoa Enviada");

        // 4. Filtrando por 'distratado' na aba de distratos
        const [{ r: apenasDistratados }] = await tx`
          SELECT public.buscar_contratos_paginados('', 'distratos', 1, 20, 'distratado') AS r
        `;
        expect(apenasDistratados.total).toBe(1);
        expect(apenasDistratados.itens).toHaveLength(1);
        expect(apenasDistratados.itens[0].status).toBe("distratado");
        expect(apenasDistratados.itens[0].pessoas.nome_completo).toBe("Pessoa Distratada");

        // 5. Filtrando por status inexistente no quadro ativo
        const [{ r: vazio }] = await tx`
          SELECT public.buscar_contratos_paginados('', 'ativos', 1, 20, 'rascunho') AS r
        `;
        expect(vazio.total).toBe(0);
        expect(vazio.itens).toHaveLength(0);

        throw rollback;
      });
    } catch (erro) {
      if (erro !== rollback) throw erro;
    } finally {
      await sql.end();
    }
  }, 60000);
});
