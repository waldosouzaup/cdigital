import { describe, it, expect } from "vitest";
import postgres from "postgres";
import { randomBytes, randomUUID } from "node:crypto";

/** Tudo roda em uma transação com rollback, incluindo os dados de carga. */
describe("Contratos: paginação, isolamento e evidências", () => {
  it("busca além de 1000, isola tenants, rejeita links inválidos e registra somente uma assinatura", async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
    const rollback = new Error("ROLLBACK_TESTE");
    try {
      await sql.begin(async (tx) => {
        const [{ id: org }] =
          await tx`insert into public.organizacoes(nome) values ('Teste isolado assinatura') returning id`;
        const [{ id: outraOrg }] =
          await tx`insert into public.organizacoes(nome) values ('Outro tenant teste') returning id`;
        await tx`insert into public.pessoas(organizacao_id,nome_completo,cpf,email,telefone,apta)
          select ${org}, 'Colaborador '||lpad(n::text,4,'0'),lpad(n::text,11,'0'),
            'pessoa'||n||'@exemplo.invalid','(61) 99999-'||lpad(n::text,4,'0'),true from generate_series(1,1205) n`;
        await tx`insert into public.contratos(organizacao_id,pessoa_id,objeto,valor,valor_extenso,vigencia_inicio,vigencia_fim,status)
          select ${org},id,'Teste',100,'cem reais','2026-09-01','2026-10-03','enviado' from public.pessoas where organizacao_id=${org}`;
        const claims = {
          role: "authenticated",
          sub: randomUUID(),
          organizacao_id: org,
          papel: "gestor",
          aal: "aal1",
        };
        await tx`select set_config('request.jwt.claims',${JSON.stringify(claims)},true)`;
        await tx`set local role authenticated`;
        const [{ r: pagina }] =
          await tx`select public.buscar_contratos_paginados('', 'ativos',61,20) as r`;
        expect(pagina.total).toBe(1205);
        expect(pagina.itens).toHaveLength(5);
        expect(pagina.pagina).toBe(61);
        for (const termo of [
          "Colaborador 1205",
          "000.000.012-05",
          "pessoa1205@exemplo.invalid",
          "(61) 99999-1205",
        ]) {
          const [{ r }] =
            await tx`select public.buscar_contratos_paginados(${termo},'ativos',1,20) as r`;
          expect(r.total).toBe(1);
          expect(r.itens[0].pessoas.nome_completo).toBe("Colaborador 1205");
        }
        const [{ r: literal }] =
          await tx`select public.buscar_contratos_paginados('%','ativos',1,20) as r`;
        expect(literal.total).toBe(0);
        await tx`select set_config('request.jwt.claims',${JSON.stringify({ ...claims, organizacao_id: outraOrg })},true)`;
        const [{ r: vazio }] =
          await tx`select public.buscar_contratos_paginados('','ativos',1,20) as r`;
        expect(vazio.total).toBe(0);
        await tx`reset role`;
        const [{ id, pessoa_id: pessoa }] =
          await tx`select id,pessoa_id from public.contratos where organizacao_id=${org} limit 1`;
        const token = randomBytes(24).toString("hex"),
          hash = "a".repeat(64);
        await tx`update public.contratos set token_assinatura=${token},assinatura_expira_em=now()+interval '7 days',pdf_sha256=${hash} where id=${id}`;
        await tx`set local role anon`;
        expect(await tx`select * from public.validar_link_assinatura(${token})`).toHaveLength(1);
        expect(
          await tx`select * from public.validar_link_assinatura(${"0".repeat(48)})`,
        ).toHaveLength(0);
        const [{ permitido }] =
          await tx`select has_function_privilege('anon','public.assinar_contrato_publico(text,text)','EXECUTE') as permitido`;
        expect(permitido).toBe(false);
        const [{ novoPermitido }] =
          await tx`select has_function_privilege('authenticated','public.concluir_assinatura_com_evidencias(text,text,text,jsonb)','EXECUTE') as "novoPermitido"`;
        expect(novoPermitido).toBe(false);
        await tx`reset role`;
        await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
        await tx`set local role service_role`;
        const caminho = `${org}/${pessoa}/assinado_${id}_teste.pdf`;
        const evidencias = tx.json({
          consentimento: true,
          assinatura_sha256: hash,
          foto_sha256: hash,
        });
        const [{ r: alterado }] =
          await tx`select public.concluir_assinatura_com_evidencias(${token},${"b".repeat(64)},${caminho},${evidencias}::jsonb) as r`;
        expect(alterado).toBe(false);
        const [{ r: incompleto }] =
          await tx`select public.concluir_assinatura_com_evidencias(${token},${hash},${caminho},'{}'::jsonb) as r`;
        expect(incompleto).toBe(false);
        for (let i = 0; i < 2; i++) {
          const [{ r }] =
            await tx`select public.concluir_assinatura_com_evidencias(${token},${hash},${caminho},${evidencias}::jsonb) as r`;
          expect(r).toBe(true);
        }
        const [{ qtd }] =
          await tx`select count(*)::integer as qtd from public.eventos_contrato where contrato_id=${id} and status_novo='assinado'`;
        expect(qtd).toBe(1);
        const [{ status, caminho_pdf_assinado }] =
          await tx`select status,caminho_pdf_assinado from public.contratos where id=${id}`;
        expect(status).toBe("assinado");
        expect(caminho_pdf_assinado).toBe(caminho);
        await tx`reset role`;
        await tx`update public.contratos set assinatura_expira_em=now()-interval '1 second' where id=${id}`;
        await tx`set local role anon`;
        expect(await tx`select * from public.validar_link_assinatura(${token})`).toHaveLength(0);
        throw rollback;
      });
    } catch (erro) {
      if (erro !== rollback) throw erro;
    } finally {
      await sql.end();
    }
  }, 60000);
});
