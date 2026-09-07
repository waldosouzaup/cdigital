/**
 * Seed de carga — Seção 11: "500 pessoas e 2.000 contratos fictícios em `seed:carga`
 * para o teste de desempenho da Fase 3" (dashboard < 2s, Seção 10).
 *
 * Diferença deliberada para `seed.ts`: aqui o volume importa, não a fidelidade do
 * histórico. Os contratos são inseridos com o `status` final direto (sem passar
 * pela máquina de estados a cada transição, nem gravar `eventos_contrato` por
 * passo) — em lote, para não fazer 2.000+ round-trips numa conexão remota.
 * `seed.ts` é quem precisa da fidelidade completa (é o teste de aceitação do
 * relatório consolidado da Seção 13); este arquivo só precisa existir em volume.
 */
import { db } from "./client";
import { contracts, organizations, people } from "./schema";
import { amountInWords } from "@/lib/contratos/valor-extenso";
import { generateValidCpf } from "@/lib/documentos/cpf";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";

const TOTAL_PESSOAS = 500;
const TOTAL_CONTRATOS = 2000;
const DOMINIO_DESCARTE = "exemplo.invalid"; // Seção 11: nunca endereço real
const TAMANHO_LOTE = 200;

const OBJETOS = [
  { nome: "Administrativo e Montagem de Material", valor: "3553.00" },
  { nome: "Coordenador de Comitê da Campanha", valor: "4353.00" },
  { nome: "Administrativo Homeoffice", valor: "2200.00" },
  { nome: "Militância e Mobilização de Rua", valor: "1500.00" },
];

// Distribuição só para gerar volume plausível para o dashboard — não representa
// nenhum dado real. Pesos aproximados de um funil saudável.
const STATUS_POSSIVEIS: { status: ContractStatus; peso: number }[] = [
  { status: "emitido", peso: 2 },
  { status: "enviado", peso: 3 },
  { status: "assinado", peso: 4 },
  { status: "cancelado", peso: 1 },
];
const PESO_TOTAL = STATUS_POSSIVEIS.reduce((soma, s) => soma + s.peso, 0);

function escolherStatus(indice: number): ContractStatus {
  const posicao = indice % PESO_TOTAL;
  let acumulado = 0;
  for (const { status, peso } of STATUS_POSSIVEIS) {
    acumulado += peso;
    if (posicao < acumulado) return status;
  }
  return "emitido";
}

async function inserirEmLotes<T>(linhas: T[], inserir: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    await inserir(linhas.slice(i, i + TAMANHO_LOTE));
  }
}

async function main() {
  console.log(`Semeando ${TOTAL_PESSOAS} pessoas e ${TOTAL_CONTRATOS} contratos de carga...`);

  const [organizacao] = await db
    .insert(organizations)
    .values({ name: "Comitê Michelle — Eleição 2026", active: true })
    .onConflictDoNothing()
    .returning({ id: organizations.id });

  const organizationId =
    organizacao?.id ??
    (
      await db.query.organizations.findFirst({
        where: (org, { eq }) => eq(org.name, "Comitê Michelle — Eleição 2026"),
      })
    )?.id;

  if (!organizationId) {
    throw new Error("Não foi possível obter a organização para o seed de carga.");
  }

  const regioesExistentes = await db.query.regions.findMany({
    where: (regiao, { eq }) => eq(regiao.organizationId, organizationId),
  });

  if (regioesExistentes.length === 0) {
    throw new Error(
      "Rode `npm run db:seed` antes de `seed:carga` — precisa das regiões já criadas.",
    );
  }

  console.log("Inserindo pessoas...");
  const pessoasParaInserir = Array.from({ length: TOTAL_PESSOAS }, (_, i) => {
    const sufixo = String(10000 + i);
    return {
      organizationId,
      fullName: `Pessoa Carga ${sufixo}`,
      cpf: generateValidCpf(sufixo),
      email: `carga.${sufixo}@${DOMINIO_DESCARTE}`,
      regionId: regioesExistentes[i % regioesExistentes.length].id,
      eligible: true,
    };
  });

  const pessoasInseridas: { id: string; regionId: string | null }[] = [];
  await inserirEmLotes(pessoasParaInserir, async (lote) => {
    const inseridas = await db
      .insert(people)
      .values(lote)
      .returning({ id: people.id, regionId: people.regionId });
    pessoasInseridas.push(...inseridas);
  });

  console.log("Inserindo contratos...");
  const contratosParaInserir = Array.from({ length: TOTAL_CONTRATOS }, (_, i) => {
    const pessoa = pessoasInseridas[i % pessoasInseridas.length];
    const objeto = OBJETOS[i % OBJETOS.length];
    return {
      organizationId,
      personId: pessoa.id,
      regionId: pessoa.regionId,
      subject: objeto.nome,
      amount: objeto.valor,
      amountInWords: amountInWords(objeto.valor),
      termStart: "2026-09-01",
      termEnd: "2026-10-03",
      status: escolherStatus(i),
    };
  });

  await inserirEmLotes(contratosParaInserir, (lote) => db.insert(contracts).values(lote));

  console.log("Seed de carga concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error("Falha no seed de carga:", erro);
    process.exit(1);
  });
