/**
 * Seed — Seção 11 do PROMPT-Comite-Digital.md.
 *
 * Roda via `npm run db:seed` (tsx), usando o cliente Drizzle de service_role
 * (src/db/client.ts) — não pode ser executado ainda: bloqueado por falta de projeto
 * Supabase hospedado (ver PROGRESSO.md).
 *
 * DECISÃO (registrada em PROGRESSO.md): as duas tabelas da Seção 11 não reconciliam
 * como uma só (21 contratos "do comitê" vs. 55 "por localidade"). Modelado como 11
 * regiões — "Comitê" (21 ativos) e as 10 localidades (55 ativos) — mais 6
 * distratados, total 76 ativos + 6 distrato. Os contratos por localidade usam todos
 * o objeto "Militância e Mobilização de Rua" (R$ 1.500,00): a Seção 11 não informa
 * qual objeto cabe a cada localidade, e esse é o objeto de campo do catálogo.
 *
 * DECISÃO — Taguatinga (assinados "não informado"): o schema não tem como marcar
 * "não sabemos quantos dos enviados foram assinados" por contrato — só existe o
 * enum `status_contrato`, sem estado de "desconhecido". Os 12 contratos de
 * Taguatinga são semeados como 'enviado' (o último estágio confirmado pela fonte),
 * sem fabricar `assinado` nem fingir que o valor confirmado é 0. A Fase 3
 * (dashboard) precisa de um jeito de marcar essa lacuna como "não informado" em vez
 * de contar 0 — como o schema atual não modela isso por contrato, sinalizado como
 * pendência de design para a Fase 3 (ver PROGRESSO.md).
 */
import { eq } from "drizzle-orm";
import { db } from "./client";
import {
  contractEvents,
  contracts,
  contractTemplates,
  organizations,
  people,
  regions,
} from "./schema";
import { buildTransitionPath } from "@/lib/contratos/caminho-transicoes";
import { transitionOrThrow, type ContractStatus } from "@/lib/contratos/maquina-estados";
import { amountInWords } from "@/lib/contratos/valor-extenso";
import { generateValidCpf } from "@/lib/documentos/cpf";

const VIGENCIA_INICIO = "2026-09-01";
const VIGENCIA_FIM = "2026-10-03";
// Seção 11: "Todos os e-mails do seed devem usar um domínio de descarte — jamais
// endereço real."
const DOMINIO_DESCARTE = "exemplo.invalid";

interface ObjetoContrato {
  nome: string;
  valor: string;
}

const OBJETOS: Record<string, ObjetoContrato> = {
  administrativo: { nome: "Administrativo e Montagem de Material", valor: "3553.00" },
  coordenador: { nome: "Coordenador de Comitê da Campanha", valor: "4353.00" },
  homeoffice: { nome: "Administrativo Homeoffice", valor: "2200.00" },
  mobilizacao: { nome: "Militância e Mobilização de Rua", valor: "1500.00" },
};

let contadorPessoa = 0;

/**
 * Cria uma pessoa + um contrato, e avança o contrato pelos estados intermediários
 * até `statusFinal`, gravando um evento por transição — igual ao que a aplicação
 * faria de verdade (Seção 7: "toda transição bem-sucedida grava linha em
 * eventos_contrato").
 */
async function semearContrato(params: {
  organizationId: string;
  regionId: string;
  regiaoNome: string;
  objeto: ObjetoContrato;
  statusFinal: ContractStatus;
}) {
  contadorPessoa += 1;
  const sufixo = String(contadorPessoa).padStart(4, "0");

  const [pessoa] = await db
    .insert(people)
    .values({
      organizationId: params.organizationId,
      fullName: `Pessoa Seed ${sufixo}`,
      cpf: generateValidCpf(sufixo),
      email: `pessoa.${sufixo}@${DOMINIO_DESCARTE}`,
      regionId: params.regionId,
      role: params.objeto.nome,
      eligible: true,
    })
    .returning({ id: people.id });

  const [contrato] = await db
    .insert(contracts)
    .values({
      organizationId: params.organizationId,
      personId: pessoa.id,
      regionId: params.regionId,
      subject: params.objeto.nome,
      amount: params.objeto.valor,
      amountInWords: amountInWords(params.objeto.valor),
      termStart: VIGENCIA_INICIO,
      termEnd: VIGENCIA_FIM,
      status: "rascunho",
    })
    .returning({ id: contracts.id });

  await avancarContrato(contrato.id, "rascunho", params.statusFinal);
  return { pessoaId: pessoa.id, contratoId: contrato.id };
}

async function avancarContrato(contratoId: string, atual: ContractStatus, alvo: ContractStatus) {
  let estadoAtual = atual;
  for (const proximo of buildTransitionPath(atual, alvo)) {
    transitionOrThrow(estadoAtual, proximo); // valida antes de gravar — mesma regra da app
    await db.update(contracts).set({ status: proximo }).where(eq(contracts.id, contratoId));
    await db.insert(contractEvents).values({
      contractId: contratoId,
      previousStatus: estadoAtual,
      newStatus: proximo,
      observation: "Gerado pelo seed (Seção 11)",
    });
    estadoAtual = proximo;
  }
}

async function main() {
  console.log("Semeando organização, regiões e template...");

  const [organizacao] = await db
    .insert(organizations)
    .values({ name: "Comitê Michelle — Eleição 2026", active: true })
    .returning({ id: organizations.id });

  const nomesRegioes = [
    "Comitê",
    "Águas Claras",
    "Paranoá",
    "Gama",
    "Recantos",
    "Taguatinga",
    "Planaltina",
    "Sobradinho",
    "São Sebastião",
    "Samambaia",
    "Riacho Fundo",
  ];

  const regioesCriadas = await db
    .insert(regions)
    .values(nomesRegioes.map((name) => ({ organizationId: organizacao.id, name })))
    .returning({ id: regions.id, name: regions.name });

  const idRegiao = (nome: string) => regioesCriadas.find((r) => r.name === nome)!.id;

  await db.insert(contractTemplates).values(
    Object.values(OBJETOS).map((objeto) => ({
      organizationId: organizacao.id,
      name: `Template — ${objeto.nome}`,
      subject: objeto.nome,
      bodyHtml: `<p>Contrato de {{objeto}} no valor de {{valor}} ({{valor_extenso}}).</p>`,
      defaultAmount: objeto.valor,
      active: true,
    })),
  );

  // --- Região "Comitê": 21 ativos por objeto (Seção 11, primeira tabela) ---
  console.log("Semeando contratos da região Comitê...");
  const comiteId = idRegiao("Comitê");
  const porObjeto: { objeto: ObjetoContrato; quantidade: number; assinados: number }[] = [
    { objeto: OBJETOS.administrativo, quantidade: 14, assinados: 4 },
    { objeto: OBJETOS.coordenador, quantidade: 2, assinados: 0 },
    { objeto: OBJETOS.homeoffice, quantidade: 2, assinados: 1 },
    { objeto: OBJETOS.mobilizacao, quantidade: 3, assinados: 2 },
  ];

  for (const linha of porObjeto) {
    for (let i = 0; i < linha.quantidade; i++) {
      const statusFinal: ContractStatus = i < linha.assinados ? "assinado" : "enviado";
      await semearContrato({
        organizationId: organizacao.id,
        regionId: comiteId,
        regiaoNome: "Comitê",
        objeto: linha.objeto,
        statusFinal,
      });
    }
  }

  // --- 6 distratados (todos com distrato assinado), fora do quadro ativo ---
  console.log("Semeando 6 contratos distratados...");
  for (let i = 0; i < 6; i++) {
    await semearContrato({
      organizationId: organizacao.id,
      regionId: comiteId,
      regiaoNome: "Comitê",
      objeto: OBJETOS.administrativo,
      statusFinal: "distrato_assinado",
    });
  }

  // --- 10 localidades (Seção 11, segunda tabela) ---
  console.log("Semeando contratos por localidade...");
  const localidades: {
    nome: string;
    prontos: number;
    enviados: number;
    assinados: number | null;
  }[] = [
    { nome: "Águas Claras", prontos: 8, enviados: 8, assinados: 5 },
    { nome: "Paranoá", prontos: 4, enviados: 3, assinados: 3 },
    { nome: "Gama", prontos: 10, enviados: 10, assinados: 2 },
    { nome: "Recantos", prontos: 8, enviados: 8, assinados: 8 },
    { nome: "Taguatinga", prontos: 12, enviados: 12, assinados: null }, // "não informado"
    { nome: "Planaltina", prontos: 10, enviados: 10, assinados: 0 },
    { nome: "Sobradinho", prontos: 0, enviados: 0, assinados: 0 },
    { nome: "São Sebastião", prontos: 0, enviados: 0, assinados: 0 },
    { nome: "Samambaia", prontos: 0, enviados: 0, assinados: 0 },
    { nome: "Riacho Fundo", prontos: 3, enviados: 3, assinados: 0 },
  ];

  for (const localidade of localidades) {
    const regiaoId = idRegiao(localidade.nome);
    const assinados = localidade.assinados ?? 0; // Taguatinga: ver decisão no topo do arquivo
    const enviadosNaoAssinados = localidade.enviados - assinados;
    const emitidosNaoEnviados = localidade.prontos - localidade.enviados;

    for (let i = 0; i < assinados; i++) {
      await semearContrato({
        organizationId: organizacao.id,
        regionId: regiaoId,
        regiaoNome: localidade.nome,
        objeto: OBJETOS.mobilizacao,
        statusFinal: "assinado",
      });
    }
    for (let i = 0; i < enviadosNaoAssinados; i++) {
      await semearContrato({
        organizationId: organizacao.id,
        regionId: regiaoId,
        regiaoNome: localidade.nome,
        objeto: OBJETOS.mobilizacao,
        statusFinal: "enviado",
      });
    }
    for (let i = 0; i < emitidosNaoEnviados; i++) {
      await semearContrato({
        organizationId: organizacao.id,
        regionId: regiaoId,
        regiaoNome: localidade.nome,
        objeto: OBJETOS.mobilizacao,
        statusFinal: "emitido",
      });
    }
  }

  console.log(`Seed concluído. ${contadorPessoa} pessoas/contratos criados.`);
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error("Falha no seed:", erro);
    process.exit(1);
  });
