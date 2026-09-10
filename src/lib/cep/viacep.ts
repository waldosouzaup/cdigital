/**
 * Integração com a API ViaCEP (https://viacep.com.br/)
 *
 * Utilizada para preenchimento automático e validação de endereço a partir do CEP,
 * prevenindo erros de digitação de logradouro, bairro, cidade e estado em contratos
 * e cadastros de colaboradores.
 */

export interface DadosViaCep {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  estado?: string;
  regiao?: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean | string;
}

export interface EnderecoCepProcessado {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  enderecoFormatado: string;
}

export interface RespostaConsultaCep {
  sucesso: boolean;
  dados?: EnderecoCepProcessado;
  erro?: string;
}

/**
 * Remove qualquer caractere não numérico do CEP.
 */
export function limparCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

/**
 * Formata o CEP no padrão 00000-000.
 */
export function formatarCep(cep: string): string {
  const digitos = limparCep(cep).slice(0, 8);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

/**
 * Consulta o endereço correspondente ao CEP na API oficial do ViaCEP.
 * Possui controle de timeout de 6 segundos.
 */
export async function buscarEnderecoPorCep(cep: string): Promise<RespostaConsultaCep> {
  const limpo = limparCep(cep);
  if (limpo.length !== 8) {
    return { sucesso: false, erro: "CEP deve conter 8 dígitos." };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return { sucesso: false, erro: "Não foi possível consultar o CEP no momento." };
    }

    const json = (await resp.json()) as DadosViaCep;

    if (json.erro === true || json.erro === "true") {
      return { sucesso: false, erro: "CEP não encontrado." };
    }

    const logradouro = json.logradouro?.trim() ?? "";
    const bairro = json.bairro?.trim() ?? "";
    const cidade = json.localidade?.trim() ?? "";
    const uf = json.uf?.trim() ?? "";

    // Monta a sugestão de endereço estruturado para contratos e cadastros:
    // Ex: "Avenida Paulista, nº , Bela Vista, São Paulo - SP"
    const partes: string[] = [];
    if (logradouro) {
      partes.push(`${logradouro}, nº `);
    }
    if (bairro) {
      partes.push(bairro);
    }
    if (cidade && uf) {
      partes.push(`${cidade} - ${uf}`);
    } else if (cidade) {
      partes.push(cidade);
    }

    const enderecoFormatado = partes.join(", ");

    return {
      sucesso: true,
      dados: {
        cep: json.cep || formatarCep(limpo),
        logradouro,
        bairro,
        cidade,
        uf,
        enderecoFormatado,
      },
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { sucesso: false, erro: "Tempo limite esgotado ao consultar o CEP." };
    }
    return { sucesso: false, erro: "Falha de conexão ao consultar o CEP." };
  }
}
