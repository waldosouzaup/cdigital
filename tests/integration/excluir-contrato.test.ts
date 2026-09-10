import { describe, it, expect } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

describe("Exclusão de Contrato e Arquivamento em DadosExcluidos", () => {
  it("remove o registro do painel e preserva snapshot completo em dados_excluidos com nome e login do executor", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const rollback = new Error("ROLLBACK_TESTE_EXCLUSAO");

    try {
      await sql.begin(async (tx) => {
        // 1. Criar organização
        const [{ id: orgId }] = await tx`
          INSERT INTO public.organizacoes (nome)
          VALUES ('Comitê Teste Exclusão')
          RETURNING id
        `;

        // 2. Criar usuário gestor
        const userId = randomUUID();
        const userEmail = "admin.executor@comitedigital.org";
        const userName = "Admin Executor de Teste";

        // Insere em auth.users para FK
        await tx`
          INSERT INTO auth.users (id, email, raw_user_meta_data)
          VALUES (${userId}, ${userEmail}, ${tx.json({ name: userName })})
          ON CONFLICT (id) DO NOTHING
        `;

        await tx`
          INSERT INTO public.usuarios (id, organizacao_id, nome, email, papel, ativo)
          VALUES (${userId}, ${orgId}, ${userName}, ${userEmail}, 'gestor', true)
        `;

        // 3. Criar pessoa apta
        const [{ id: pessoaId }] = await tx`
          INSERT INTO public.pessoas (organizacao_id, nome_completo, cpf, email, telefone, apta)
          VALUES (${orgId}, 'João da Silva Contratado', '11122233344', 'joao@exemplo.org', '(61) 98888-0000', true)
          RETURNING id
        `;

        // 4. Criar contrato
        const [{ id: contratoId }] = await tx`
          INSERT INTO public.contratos (
            organizacao_id, pessoa_id, objeto, valor, valor_extenso, vigencia_inicio, vigencia_fim, status
          ) VALUES (
            ${orgId}, ${pessoaId}, 'Coordenação de Atividades de Rua', 4200.00,
            'quatro mil e duzentos reais', '2026-09-01', '2026-10-03', 'assinado'
          ) RETURNING id
        `;

        // 5. Inserir evento de contrato
        await tx`
          INSERT INTO public.eventos_contrato (
            contrato_id, status_anterior, status_novo, usuario_id, observacao
          ) VALUES (
            ${contratoId}, 'enviado', 'assinado', ${userId}, 'Assinado digitalmente'
          )
        `;

        // 6. Simular contexto de usuário autenticado
        const claims = {
          role: "authenticated",
          sub: userId,
          organizacao_id: orgId,
          papel: "gestor",
          aal: "aal1",
        };
        await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
        await tx`set local role authenticated`;

        // 7. Conferir que contrato aparece no painel antes da exclusão
        const [{ r: antes }] = await tx`
          SELECT public.buscar_contratos_paginados('', 'ativos', 1, 20) AS r
        `;
        expect(antes.total).toBe(1);
        expect(antes.itens[0].id).toBe(contratoId);

        // 8. Executar a exclusão via RPC
        const motivo = "Desistência formal antes do início das atividades de campo";
        const [{ excluir_contrato: resultado }] = await tx`
          SELECT public.excluir_contrato(${contratoId}, ${motivo})
        `;

        expect(resultado.ok).toBe(true);
        expect(resultado.contrato_id).toBe(contratoId);
        expect(resultado.pessoa_nome).toBe("João da Silva Contratado");

        // 9. Verificar que o contrato SUMIU do painel
        const [{ r: depois }] = await tx`
          SELECT public.buscar_contratos_paginados('', 'ativos', 1, 20) AS r
        `;
        expect(depois.total).toBe(0);
        expect(depois.itens).toHaveLength(0);

        // Resetar role para consultas diretas no banco
        await tx`reset role`;

        // 10. Verificar que não existe mais em contratos nem em eventos_contrato
        const contratosRestantes = await tx`
          SELECT id FROM public.contratos WHERE id = ${contratoId}
        `;
        expect(contratosRestantes).toHaveLength(0);

        const eventosRestantes = await tx`
          SELECT id FROM public.eventos_contrato WHERE contrato_id = ${contratoId}
        `;
        expect(eventosRestantes).toHaveLength(0);

        // 11. Verificar gravação completa em dados_excluidos
        const registrosExcluidos = await tx`
          SELECT * FROM public.dados_excluidos WHERE registro_id = ${contratoId}
        `;
        expect(registrosExcluidos).toHaveLength(1);

        const excluido = registrosExcluidos[0];
        expect(excluido.organizacao_id).toBe(orgId);
        expect(excluido.tipo_registro).toBe("contrato");
        expect(excluido.usuario_id).toBe(userId);
        expect(excluido.usuario_nome).toBe(userName);
        expect(excluido.usuario_login).toBe(userEmail);
        expect(excluido.motivo).toBe(motivo);

        // Validar dados do snapshot JSON
        const dados = excluido.dados;
        expect(dados.contrato.id).toBe(contratoId);
        expect(dados.contrato.objeto).toBe("Coordenação de Atividades de Rua");
        expect(Number(dados.contrato.valor)).toBe(4200);
        expect(dados.pessoa.id).toBe(pessoaId);
        expect(dados.pessoa.nome_completo).toBe("João da Silva Contratado");
        expect(dados.pessoa.cpf).toBe("11122233344");
        expect(dados.eventos).toHaveLength(1);
        expect(dados.eventos[0].status_novo).toBe("assinado");
        expect(dados.excluido_por.nome).toBe(userName);
        expect(dados.excluido_por.login).toBe(userEmail);

        // 12. Verificar que a VIEW "DadosExcluidos" reflete o mesmo registro
        const registrosView = await tx`
          SELECT * FROM public."DadosExcluidos" WHERE registro_id = ${contratoId}
        `;
        expect(registrosView).toHaveLength(1);
        expect(registrosView[0].usuario_login).toBe(userEmail);

        // 13. Verificar que log_auditoria registrou a ação
        const logs = await tx`
          SELECT * FROM public.log_auditoria
          WHERE entidade = 'contratos' AND entidade_id = ${contratoId}
        `;
        expect(logs).toHaveLength(1);
        expect(logs[0].acao).toBe("exclusao_contrato");
        expect(logs[0].usuario_id).toBe(userId);

        throw rollback;
      });
    } catch (erro) {
      if (erro !== rollback) throw erro;
    } finally {
      await sql.end();
    }
  }, 60000);
});

