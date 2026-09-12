/**
 * Normalização do remetente de e-mail (`RESEND_FROM`).
 *
 * Existe por causa de uma família de falhas reais: 21 notificações ficaram em
 * `falhou` com `validation_error: Invalid \`from\` field` porque a aplicação
 * repassava ao Resend, sem conferir, a string que estivesse na variável de
 * ambiente. Conferido contra a API do Resend, o erro aparece sempre que o valor
 * não é parseável como endereço — `Nome <email` sem o `>`, `<email>` sem nome,
 * ou um nome sem endereço nenhum.
 *
 * A higienização anterior (`replace(/^["']|["']$/g, "")`) não cobria nada disso
 * e ainda estragava o caso legítimo `"Nome" <email>`, deixando uma aspa órfã no
 * meio do display name.
 *
 * O contrato aqui é: consertar só o que é inequívoco (aspas envolvendo o valor
 * inteiro, `<` sem par, `>` sobrando, espaços colados por painel de deploy) e
 * recusar o resto com um motivo nomeado — misconfiguração precisa aparecer em
 * `/configuracoes`, não virar uma linha de `notificacoes` queimada.
 */

export type MotivoRemetenteInvalido =
  | "remetente_ausente"
  | "remetente_sem_endereco"
  | "remetente_endereco_invalido"
  | "remetente_endereco_nao_ascii";

export type RemetenteNormalizado =
  | { ok: true; valor: string; nome: string | null; email: string }
  | { ok: false; motivo: MotivoRemetenteInvalido; mensagem: string };

/** Caracteres que o RFC 5322 só admite dentro de um display name entre aspas. */
const ESPECIAIS_RFC5322 = /[()<>[\]:;@\\,."]/;

/**
 * Endereço permitido. Deliberadamente mais estrito que o RFC: é o que um
 * remetente transacional usa, e erra para o lado de recusar em vez de mandar
 * lixo para a API.
 */
const ENDERECO = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

const MENSAGENS: Record<MotivoRemetenteInvalido, string> = {
  remetente_ausente:
    "RESEND_FROM não está definida. Configure o remetente no formato `Nome <email@dominio.com.br>`.",
  remetente_sem_endereco:
    "RESEND_FROM não contém um endereço de e-mail. Use o formato `Nome <email@dominio.com.br>`.",
  remetente_endereco_invalido:
    "O endereço em RESEND_FROM não é um e-mail válido. Use o formato `Nome <email@dominio.com.br>`.",
  remetente_endereco_nao_ascii:
    "O endereço em RESEND_FROM tem caracteres acentuados. O Resend exige que a parte do e-mail seja ASCII — acento só é permitido no nome de exibição.",
};

function invalido(motivo: MotivoRemetenteInvalido): RemetenteNormalizado {
  return { ok: false, motivo, mensagem: MENSAGENS[motivo] };
}

/** Tira um par de aspas que envolva o valor inteiro — nunca uma aspa solta. */
function desembrulharAspas(valor: string): string {
  let atual = valor;
  while (atual.length >= 2) {
    const primeira = atual[0];
    const ultima = atual[atual.length - 1];
    if ((primeira === '"' || primeira === "'") && ultima === primeira) {
      atual = atual.slice(1, -1).trim();
      continue;
    }
    return atual;
  }
  return atual;
}

function ehAscii(valor: string): boolean {
  return /^[\x00-\x7F]*$/.test(valor);
}

function montar(nome: string | null, email: string): RemetenteNormalizado {
  if (!ehAscii(email)) return invalido("remetente_endereco_nao_ascii");
  if (!ENDERECO.test(email)) return invalido("remetente_endereco_invalido");

  if (!nome) return { ok: true, valor: email, nome: null, email };

  const nomeCitado = ESPECIAIS_RFC5322.test(nome)
    ? `"${nome.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : nome;

  return { ok: true, valor: `${nomeCitado} <${email}>`, nome, email };
}

export function normalizarRemetente(bruto: string | undefined | null): RemetenteNormalizado {
  // Espaços internos também são colapsados: colar do painel de deploy costuma
  // trazer quebra de linha e espaço duplo junto.
  const valor = desembrulharAspas((bruto ?? "").replace(/\s+/g, " ").trim());
  if (!valor) return invalido("remetente_ausente");

  const abre = valor.indexOf("<");

  // Sem `<`: ou é um endereço puro, ou é um nome solto (o caso que o Resend
  // recusava com "needs to follow the … format").
  if (abre === -1) {
    if (!valor.includes("@")) return invalido("remetente_sem_endereco");
    return montar(null, valor);
  }

  const nomeBruto = desembrulharAspas(valor.slice(0, abre).trim());
  // `>` sobrando ou ausente: o intervalo entre `<` e o fim é o endereço.
  const email = valor
    .slice(abre + 1)
    .replace(/>+\s*$/, "")
    .trim();

  if (!email) return invalido("remetente_endereco_invalido");

  return montar(nomeBruto || null, email);
}
