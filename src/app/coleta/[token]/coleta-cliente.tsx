"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { Alerta } from "@/components/alerta";
import { Badge } from "@/components/badge";
import { SeletorTema } from "@/components/seletor-tema";
import { formatarCep, limparCep, buscarEnderecoPorCep } from "@/lib/cep/viacep";
import { useAuditoriaColeta } from "@/lib/coleta/use-auditoria-coleta";
import { enviarDadosColeta } from "./acoes";
import { ESTADO_INICIAL_ENVIAR_DADOS } from "./estado";

/**
 * Fluxo real (Fase 2, itens 2 e 3) — 3 etapas, não as 4 do desenho original: a
 * pessoa já foi cadastrada pelo coordenador (nome/CPF/região), então não faz
 * sentido pedir de novo. O upload de documento (etapa 2) valida do lado do
 * servidor (`/api/coleta/[token]/documento`) — o que aparece aqui de imediato
 * (tamanho, prévia) é só conveniência, quem decide de verdade é o servidor.
 */
export function ColetaCliente({
  token,
  primeiroNome,
  organizacaoNome,
  emailInicial,
  dadosIniciais,
}: {
  token: string;
  primeiroNome: string;
  organizacaoNome: string;
  emailInicial?: string;
  dadosIniciais?: {
    email?: string;
    telefone?: string;
    banco?: string;
    agencia?: string;
    conta?: string;
    chavePix?: string;
  };
}) {
  const { geolocalizacao, registrarInicioPreenchimento } = useAuditoriaColeta({
    token,
    tipo: "coleta",
  });
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [consentimento, setConsentimento] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Etapa 1 — Contato e Pagamento
  const [email, setEmail] = useState(dadosIniciais?.email ?? emailInicial ?? "");
  const [telefone, setTelefone] = useState(dadosIniciais?.telefone ?? "");
  const [banco, setBanco] = useState(dadosIniciais?.banco ?? "");
  const [agencia, setAgencia] = useState(dadosIniciais?.agencia ?? "");
  const [conta, setConta] = useState(dadosIniciais?.conta ?? "");
  const [chavePix, setChavePix] = useState(dadosIniciais?.chavePix ?? "");

  // Etapa 1 — Endereço e CEP (autocompletar via ViaCEP)
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [feedbackCep, setFeedbackCep] = useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);
  const enderecoInputRef = useRef<HTMLInputElement>(null);

  // Etapa 2 — Documento de Identidade
  const [enviandoIdentidade, setEnviandoIdentidade] = useState(false);
  const [erroIdentidade, setErroIdentidade] = useState<string | null>(null);
  const [identidadeEnviada, setIdentidadeEnviada] = useState(false);
  const [nomeArquivoIdentidade, setNomeArquivoIdentidade] = useState<string | null>(null);

  // Etapa 2 — Comprovante de Residência
  const [enviandoEndereco, setEnviandoEndereco] = useState(false);
  const [erroEndereco, setErroEndereco] = useState<string | null>(null);
  const [enderecoEnviado, setEnderecoEnviado] = useState(false);
  const [nomeArquivoEndereco, setNomeArquivoEndereco] = useState<string | null>(null);

  const enviarComToken = enviarDadosColeta.bind(null, token);
  const [estado, formAction, pendente] = useActionState(
    enviarComToken,
    ESTADO_INICIAL_ENVIAR_DADOS,
  );

  if (estado.status === "sucesso") {
    return (
      <TelaSucesso
        primeiroNome={primeiroNome}
        organizacaoNome={organizacaoNome}
        token={token}
        identidadeEnviada={identidadeEnviada}
        enderecoEnviado={enderecoEnviado}
        emailEnviado={estado.emailEnviado ?? emailInicial}
      />
    );
  }

  async function handleEnviarArquivo(
    tipo: "documento_identidade" | "comprovante_endereco",
    evento: ChangeEvent<HTMLInputElement>,
  ) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    const isIdentidade = tipo === "documento_identidade";

    if (isIdentidade) {
      setErroIdentidade(null);
      setEnviandoIdentidade(true);
      setIdentidadeEnviada(false);
    } else {
      setErroEndereco(null);
      setEnviandoEndereco(true);
      setEnderecoEnviado(false);
    }

    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      corpo.append("tipo", tipo);

      const resposta = await fetch(`/api/coleta/${token}/documento`, {
        method: "POST",
        body: corpo,
      });
      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.ok) {
        const msg = resultado.motivo ?? "Não foi possível enviar o documento.";
        if (isIdentidade) setErroIdentidade(msg);
        else setErroEndereco(msg);
        return;
      }

      if (isIdentidade) {
        setIdentidadeEnviada(true);
        setNomeArquivoIdentidade(arquivo.name);
      } else {
        setEnderecoEnviado(true);
        setNomeArquivoEndereco(arquivo.name);
      }
    } catch {
      const msg = "Falha de conexão ao enviar o arquivo. Tente novamente.";
      if (isIdentidade) setErroIdentidade(msg);
      else setErroEndereco(msg);
    } finally {
      if (isIdentidade) setEnviandoIdentidade(false);
      else setEnviandoEndereco(false);
      evento.target.value = "";
    }
  }

  async function handleCepChange(evento: ChangeEvent<HTMLInputElement>) {
    const valorDigitado = evento.target.value;
    const formatado = formatarCep(valorDigitado);
    setCep(formatado);

    const digitos = limparCep(valorDigitado);
    if (digitos.length < 8) {
      setFeedbackCep(null);
      return;
    }

    if (digitos.length === 8) {
      setBuscandoCep(true);
      setFeedbackCep(null);

      try {
        let resultado = await buscarEnderecoPorCep(digitos);

        if (!resultado.sucesso && resultado.erro !== "CEP não encontrado.") {
          // Se falhou por bloqueador de anúncios ou política de rede no cliente, tenta o proxy interno
          try {
            const respProxy = await fetch(`/api/cep/${digitos}`);
            if (respProxy.ok) {
              const jsonProxy = await respProxy.json();
              if (jsonProxy.ok && jsonProxy.dados) {
                resultado = { sucesso: true, dados: jsonProxy.dados };
              }
            }
          } catch {
            // Mantém resultado original de fallback
          }
        }

        if (resultado.sucesso && resultado.dados) {
          const dados = resultado.dados;
          setEndereco(dados.enderecoFormatado);
          setFeedbackCep({
            tipo: "sucesso",
            texto: `✓ Endereço localizado: ${[
              dados.bairro,
              dados.cidade && dados.uf ? `${dados.cidade}/${dados.uf}` : dados.cidade,
            ]
              .filter(Boolean)
              .join(", ")}. Complete o número e complemento abaixo.`,
          });
          setTimeout(() => {
            const input = enderecoInputRef.current;
            if (input) {
              input.focus();
              const idx = dados.enderecoFormatado.indexOf("nº ");
              if (idx !== -1) {
                const pos = idx + 3;
                input.setSelectionRange(pos, pos);
              }
            }
          }, 60);
        } else {
          setFeedbackCep({
            tipo: "erro",
            texto: resultado.erro ?? "CEP não encontrado. Digite o endereço manualmente.",
          });
        }
      } catch {
        setFeedbackCep({
          tipo: "erro",
          texto: "Não foi possível consultar o CEP automaticamente. Digite o endereço manualmente.",
        });
      } finally {
        setBuscandoCep(false);
      }
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between">
      <header className="border-b border-line bg-surface px-4 py-3 sticky top-0 z-30">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Marca className="text-small" />
            <span className="text-[0.7rem] font-mono text-ink-muted border-l border-line pl-2">
              COLETA SEGURA
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <SeletorTema />
            <Badge status="enviado" rotuloPersonalizado={organizacaoNome} />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-ink-muted mb-2">
            <span>ETAPA {etapa} DE 3</span>
            <span>
              {etapa === 1 && "DADOS COMPLEMENTARES"}
              {etapa === 2 && "DOCUMENTAÇÃO"}
              {etapa === 3 && "REVISÃO E ENVIO"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 h-1 bg-line">
            <div className={`h-full ${etapa >= 1 ? "bg-primary" : "bg-transparent"}`} />
            <div className={`h-full ${etapa >= 2 ? "bg-primary" : "bg-transparent"}`} />
            <div className={`h-full ${etapa >= 3 ? "bg-primary" : "bg-transparent"}`} />
          </div>
        </div>

        {/* Indicador de ambiente seguro e auditado */}
        <div className="mb-4 flex items-center justify-between text-[0.6875rem] font-mono text-ink-muted bg-surface/80 border border-line px-3 py-1.5 rounded">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>Ambiente Auditado TSE &amp; LGPD</span>
          </div>
          <span className="text-[0.65rem] text-ink-muted">
            {geolocalizacao.status === "concedida" ? "✓ Localização capturada" : "IP & Horário Registrados"}
          </span>
        </div>

        <form
          ref={formRef}
          action={formAction}
          className="space-y-6"
          onFocusCapture={registrarInicioPreenchimento}
          onChangeCapture={registrarInicioPreenchimento}
        >
          <input
            type="hidden"
            name="geolocalizacao"
            value={JSON.stringify(geolocalizacao)}
          />
          {/* ETAPA 1: DADOS COMPLEMENTARES — só aparece/desaparece via CSS, não
              desmonta, para o form manter os valores digitados ao ir e voltar. */}
          <div className={etapa === 1 ? "space-y-6" : "hidden"}>
            <div className="space-y-2">
              <h1 className="text-h1 font-semibold text-ink leading-tight">
                Olá, {primeiroNome}
              </h1>
              <p className="text-small text-ink-muted leading-relaxed">
                Complete os dados complementares abaixo para a formalização do seu contrato de trabalho
                temporário com {organizacaoNome}.
              </p>
            </div>

            <div className="space-y-4 border-t border-line pt-6">
              <Campo rotulo="RG" id="rg" name="rg" mono required placeholder="00.000.000-0" />
              <Campo
                rotulo="Data de nascimento"
                id="dataNascimento"
                name="dataNascimento"
                type="date"
                required
              />
              <Campo
                rotulo="CEP"
                id="cep"
                name="cep"
                mono
                required
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                value={cep}
                onChange={handleCepChange}
                auxiliar={
                  buscandoCep ? (
                    <span className="text-seal font-medium flex items-center gap-1.5 animate-pulse">
                      <span className="font-mono">⏳</span> Consultando ViaCEP...
                    </span>
                  ) : feedbackCep ? (
                    <span
                      className={
                        feedbackCep.tipo === "sucesso"
                          ? "text-success font-medium flex items-center gap-1"
                          : "text-atencao font-medium"
                      }
                    >
                      {feedbackCep.texto}
                    </span>
                  ) : (
                    "Digite o CEP para preencher o endereço automaticamente sem erros."
                  )
                }
              />
              <Campo
                ref={enderecoInputRef}
                rotulo="Endereço residencial completo"
                id="endereco"
                name="endereco"
                required
                placeholder="Rua, número, complemento, bairro"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                auxiliar={
                  endereco.includes("nº ")
                    ? "Substitua ou complete com o número e complemento da residência."
                    : "Rua/Avenida, número, complemento e bairro."
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo
                  rotulo="E-mail para confirmação e contrato"
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  auxiliar="Enviaremos a confirmação e o contrato para este e-mail."
                />
                <Campo
                  rotulo="Telefone (WhatsApp)"
                  id="telefone"
                  name="telefone"
                  type="tel"
                  required
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(61) 90000-0000"
                  auxiliar="Número de celular para contato oficial da campanha."
                />
              </div>

              {/* DADOS BANCÁRIOS E PAGAMENTO */}
              <div className="pt-3 border-t border-line/70 space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-small font-semibold text-ink">
                    Dados para Pagamento (Transferência ou PIX)
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Conforme exigência da Justiça Eleitoral, os pagamentos são feitos exclusivamente em conta de titularidade do contratado.
                  </p>
                </div>

                <Campo
                  rotulo="Banco"
                  id="banco"
                  name="banco"
                  required
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="Ex: 001 - Banco do Brasil, 260 - Nubank, Caixa, Itaú"
                  auxiliar="Nome ou número do banco onde você possui conta."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo
                    rotulo="Agência"
                    id="agencia"
                    name="agencia"
                    required
                    value={agencia}
                    onChange={(e) => setAgencia(e.target.value)}
                    placeholder="Ex: 0001 ou 1234-5"
                  />
                  <Campo
                    rotulo="Conta Corrente (com dígito)"
                    id="conta"
                    name="conta"
                    required
                    value={conta}
                    onChange={(e) => setConta(e.target.value)}
                    placeholder="Ex: 12345-6"
                  />
                </div>

                <Campo
                  rotulo="Chave PIX para pagamento"
                  id="chavePix"
                  name="chavePix"
                  required
                  maxLength={140}
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  auxiliar="Chave vinculada à sua conta corrente para pagamentos instantâneos."
                />
              </div>
            </div>

            <div className="pt-2">
              <Selo
                type="button"
                voz="selo"
                className="w-full py-3.5 text-base"
                onClick={() => setEtapa(2)}
              >
                Continuar para documentação →
              </Selo>
            </div>
          </div>

          {/* ETAPA 2: DOCUMENTAÇÃO (IDENTIDADE + COMPROVANTE DE RESIDÊNCIA) */}
          <div className={etapa === 2 ? "space-y-6" : "hidden"}>
            <div className="space-y-2">
              <h1 className="text-h1 font-semibold text-ink leading-tight">
                Documentação
              </h1>
              <p className="text-small text-ink-muted leading-relaxed">
                Envie as fotos ou arquivos dos documentos solicitados abaixo para a formalização cadastral.
              </p>
            </div>

            <div className="border-t border-line pt-6 space-y-6">
              {/* Slot 1: Documento de Identidade */}
              <div className="border border-line bg-surface/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold">
                      1
                    </span>
                    <h2 className="text-small font-semibold text-ink">
                      Documento de Identidade
                    </h2>
                  </div>
                  {identidadeEnviada ? (
                    <span className="font-mono text-xs text-success font-medium flex items-center gap-1">
                      ✓ Enviado
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] font-mono uppercase text-ink-muted bg-surface px-1.5 py-0.5 border border-line">
                      Obrigatório
                    </span>
                  )}
                </div>

                <p className="text-xs text-ink-muted leading-relaxed">
                  Fotografe seu <strong>RG</strong> (frente e verso) ou sua <strong>CNH aberta</strong>.
                  Certifique-se de que as informações estejam nítidas e sem reflexos.
                </p>

                <label
                  htmlFor="upload-identidade"
                  className={`block border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
                    identidadeEnviada
                      ? "border-success/60 bg-success/5"
                      : erroIdentidade
                        ? "border-critico/60 bg-critico/5"
                        : "border-line hover:border-seal bg-canvas"
                  }`}
                >
                  <input
                    id="upload-identidade"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    capture="environment"
                    className="hidden"
                    disabled={enviandoIdentidade}
                    onChange={(e) => handleEnviarArquivo("documento_identidade", e)}
                  />
                  <div className="space-y-1.5">
                    <div className="font-mono text-2xl text-seal">
                      {enviandoIdentidade ? "…" : identidadeEnviada ? "✓" : "📷"}
                    </div>
                    <div className="text-small font-medium text-ink">
                      {enviandoIdentidade
                        ? "Enviando e verificando documento…"
                        : identidadeEnviada
                          ? `Identidade enviada: ${nomeArquivoIdentidade}`
                          : "Tirar foto ou anexar RG / CNH"}
                    </div>
                    <p className="text-xs text-ink-muted">Formatos JPG, PNG ou PDF até 20 MB</p>
                  </div>
                </label>

                {erroIdentidade && (
                  <Alerta tom="critico" titulo="Não foi possível aceitar este arquivo">
                    {erroIdentidade}
                  </Alerta>
                )}

                {identidadeEnviada && (
                  <Alerta tom="sucesso" titulo="Documento de identidade recebido">
                    Arquivo verificado e registrado com sucesso.
                  </Alerta>
                )}
              </div>

              {/* Slot 2: Comprovante de Residência */}
              <div className="border border-line bg-surface/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold">
                      2
                    </span>
                    <h2 className="text-small font-semibold text-ink">
                      Comprovante de Residência
                    </h2>
                  </div>
                  {enderecoEnviado ? (
                    <span className="font-mono text-xs text-success font-medium flex items-center gap-1">
                      ✓ Enviado
                    </span>
                  ) : (
                    <span className="text-[0.6875rem] font-mono uppercase text-ink-muted bg-surface px-1.5 py-0.5 border border-line">
                      Recomendado
                    </span>
                  )}
                </div>

                <p className="text-xs text-ink-muted leading-relaxed">
                  Conta recente de <strong>água, luz, gás, internet ou telefone</strong> emitida nos
                  últimos 90 dias, em seu nome ou de parentes de 1º grau.
                </p>

                <label
                  htmlFor="upload-endereco"
                  className={`block border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
                    enderecoEnviado
                      ? "border-success/60 bg-success/5"
                      : erroEndereco
                        ? "border-critico/60 bg-critico/5"
                        : "border-line hover:border-seal bg-canvas"
                  }`}
                >
                  <input
                    id="upload-endereco"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    capture="environment"
                    className="hidden"
                    disabled={enviandoEndereco}
                    onChange={(e) => handleEnviarArquivo("comprovante_endereco", e)}
                  />
                  <div className="space-y-1.5">
                    <div className="font-mono text-2xl text-seal">
                      {enviandoEndereco ? "…" : enderecoEnviado ? "✓" : "📄"}
                    </div>
                    <div className="text-small font-medium text-ink">
                      {enviandoEndereco
                        ? "Enviando e verificando comprovante…"
                        : enderecoEnviado
                          ? `Comprovante enviado: ${nomeArquivoEndereco}`
                          : "Tirar foto ou anexar comprovante de residência"}
                    </div>
                    <p className="text-xs text-ink-muted">Formatos JPG, PNG ou PDF até 20 MB</p>
                  </div>
                </label>

                {erroEndereco && (
                  <Alerta tom="critico" titulo="Não foi possível aceitar este arquivo">
                    {erroEndereco}
                  </Alerta>
                )}

                {enderecoEnviado && (
                  <Alerta tom="sucesso" titulo="Comprovante de residência recebido">
                    Arquivo verificado e registrado com sucesso.
                  </Alerta>
                )}
              </div>

              {/* Dica de qualidade */}
              <div className="p-3 bg-surface border-l-2 border-info text-xs text-ink-muted space-y-1">
                <strong>Dica de qualidade:</strong>
                <p>
                  Coloque os documentos sobre uma mesa bem iluminada, sem cortes nas bordas e evite usar
                  o flash diretamente sobre plásticos protetores.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Selo
                type="button"
                voz="selo"
                onClick={() => setEtapa(3)}
                disabled={enviandoIdentidade || enviandoEndereco || !identidadeEnviada}
                className="w-full py-3.5 text-base"
              >
                Avançar para revisão →
              </Selo>
              {(!identidadeEnviada || !enderecoEnviado) && (
                <Selo
                  type="button"
                  voz="linha"
                  onClick={() => setEtapa(3)}
                  disabled={enviandoIdentidade || enviandoEndereco}
                  className="text-center text-xs"
                >
                  Enviar os documentos depois, continuar sem eles por enquanto
                </Selo>
              )}
              <Selo
                type="button"
                voz="linha"
                onClick={() => setEtapa(1)}
                className="text-center text-xs"
              >
                ← Voltar e revisar os dados
              </Selo>
            </div>
          </div>

          {/* ETAPA 3: REVISÃO, CONSENTIMENTO E ENVIO */}
          <div className={etapa === 3 ? "space-y-6" : "hidden"}>
            <div className="space-y-2">
              <h1 className="text-h1 font-semibold text-ink leading-tight">
                Revisão e Consentimento
              </h1>
              <p className="text-small text-ink-muted leading-relaxed">
                Confira se os dados e os documentos anexados nas etapas anteriores estão corretos antes de
                concluir o envio.
              </p>
            </div>

            {/* Resumo dos Dados de Contato e Pagamento */}
            <div className="border border-line bg-surface/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-muted">
                  Dados de Contato e Pagamento
                </span>
                <button
                  type="button"
                  onClick={() => setEtapa(1)}
                  className="text-xs text-seal hover:underline cursor-pointer"
                >
                  Editar dados
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-ink-muted block text-[0.7rem]">E-mail:</span>
                  <span className="text-ink font-medium break-all">{email || "não informado"}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[0.7rem]">Telefone:</span>
                  <span className="text-ink font-medium">{telefone || "não informado"}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[0.7rem]">Banco / Agência / Conta:</span>
                  <span className="text-ink font-medium">
                    {banco ? `${banco} · Ag: ${agencia || "—"} · CC: ${conta || "—"}` : "não informado"}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[0.7rem]">Chave Pix:</span>
                  <span className="text-ink font-medium font-mono break-all">{chavePix || "não informada"}</span>
                </div>
              </div>
            </div>

            {/* Resumo dos documentos anexados */}
            <div className="border border-line bg-surface/50 p-4 space-y-2.5">
              <div className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-muted">
                Documentos Anexados
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-line/60">
                <span className="text-ink font-medium">Documento de Identidade</span>
                {identidadeEnviada ? (
                  <span className="font-mono text-success font-medium flex items-center gap-1">
                    ✓ Enviado {nomeArquivoIdentidade ? `(${nomeArquivoIdentidade})` : ""}
                  </span>
                ) : (
                  <span className="font-mono text-ink-muted">Não enviado</span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-ink font-medium">Comprovante de Residência</span>
                {enderecoEnviado ? (
                  <span className="font-mono text-success font-medium flex items-center gap-1">
                    ✓ Enviado {nomeArquivoEndereco ? `(${nomeArquivoEndereco})` : ""}
                  </span>
                ) : (
                  <span className="font-mono text-ink-muted">Não enviado</span>
                )}
              </div>
            </div>

            {estado.status === "erro" && (
              <Alerta tom="critico" titulo="Não foi possível concluir">
                {estado.mensagem}
              </Alerta>
            )}

            <div className="p-4 border border-line bg-surface/40 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={consentimento}
                  onChange={(e) => setConsentimento(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-line text-seal focus:ring-seal"
                />
                <span className="text-xs leading-relaxed text-ink">
                  Declaro que as informações e os documentos fornecidos são verídicos e autorizo sua
                  utilização exclusiva para a{" "}
                  <strong>formalização do contrato de trabalho temporário</strong> e para a{" "}
                  <strong>prestação de contas eleitoral perante a Justiça Eleitoral</strong>, em
                  conformidade com a Lei Geral de Proteção de Dados (LGPD).
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Selo
                type="submit"
                voz="selo"
                disabled={!consentimento || pendente}
                carregando={pendente}
                textoCarregando="Transmitindo informações com segurança…"
                className="w-full py-3.5 text-base"
              >
                Concluir e Enviar Cadastro
              </Selo>
              <Selo
                type="button"
                voz="linha"
                onClick={() => setEtapa(2)}
                className="text-center text-xs"
              >
                ← Voltar para a documentação
              </Selo>
            </div>
          </div>
        </form>
      </main>

      <footer className="border-t border-line bg-surface px-4 py-3 text-center text-xs text-ink-muted">
        <span>Ambiente Criptografado · Conforme Resolução TSE nº 23.607</span>
      </footer>
    </div>
  );
}

function TelaSucesso({
  primeiroNome,
  organizacaoNome,
  token,
  identidadeEnviada,
  enderecoEnviado,
  emailEnviado,
}: {
  primeiroNome: string;
  organizacaoNome: string;
  token: string;
  identidadeEnviada: boolean;
  enderecoEnviado: boolean;
  emailEnviado?: string;
}) {
  const algumDocumentoEnviado = identidadeEnviada || enderecoEnviado;
  const todosDocumentosEnviados = identidadeEnviada && enderecoEnviado;
  const protocolo = `REC-${token.slice(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between">
      <main className="flex-1 mx-auto w-full max-w-md px-4 py-10 space-y-6 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success text-3xl font-mono">
          ✓
        </div>

        <div className="space-y-2">
          <h1 className="text-h1 font-semibold text-ink">Cadastro recebido com sucesso!</h1>
          <p className="text-small text-ink-muted leading-relaxed">
            Obrigado, <strong>{primeiroNome}</strong>. Seus dados cadastrais{" "}
            {algumDocumentoEnviado ? "e documentos " : ""}foram recebidos pela coordenação de{" "}
            <strong>{organizacaoNome}</strong>.
          </p>
        </div>

        {emailEnviado && (
          <div className="p-3.5 bg-success/10 border border-success/30 rounded text-left space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-xs text-success">
              <span>✉</span>
              <span>Confirmação enviada para seu e-mail</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Enviamos o comprovante de envio e o número de protocolo para{" "}
              <strong className="text-ink font-semibold">{emailEnviado}</strong>.
            </p>
          </div>
        )}

        <div className="p-5 border border-line bg-surface text-left space-y-3">
          <div className="font-mono text-xs text-seal uppercase tracking-wider">
            Comprovante de Envio
          </div>
          <div className="space-y-1 text-xs text-ink-muted">
            <p>
              Protocolo:{" "}
              <span className="font-mono text-ink font-semibold">
                {protocolo}
              </span>
            </p>
            <p>
              Status dos dados:{" "}
              <span className="text-success font-medium">Recebidos com sucesso</span>
            </p>
            <p>
              Documento de Identidade:{" "}
              <span className={identidadeEnviada ? "text-success font-medium" : "text-atencao font-medium"}>
                {identidadeEnviada ? "✓ Recebido" : "Pendente"}
              </span>
            </p>
            <p>
              Comprovante de Residência:{" "}
              <span className={enderecoEnviado ? "text-success font-medium" : "text-ink-muted font-medium"}>
                {enderecoEnviado ? "✓ Recebido" : "Não enviado"}
              </span>
            </p>
            <p className="border-t border-line/60 pt-1.5 text-[0.7rem] text-ink-muted flex items-center gap-1">
              <span className="text-success font-bold">✓</span> Auditoria: IP, data/hora e evidências registradas.
            </p>
          </div>
        </div>

        {!todosDocumentosEnviados && (
          <Alerta tom="atencao" titulo="Documentação complementar">
            {!identidadeEnviada
              ? "Você concluiu sem anexar o documento de identidade. A coordenação entrará em contato para solicitar o envio."
              : "Você concluiu sem o comprovante de residência. Caso necessário para sua região ou função, a coordenação solicitará posteriormente."}
          </Alerta>
        )}

        <div className="p-4 bg-paper border border-line text-xs text-ink-muted leading-relaxed">
          <strong>Próximos passos:</strong>
          <p className="mt-1">
            Assim que a documentação for validada e o contrato emitido, você receberá um link para assinatura digital.
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex text-small text-seal underline decoration-seal/40 hover:decoration-seal"
          >
            Conhecer mais sobre o Comitê Digital
          </Link>
        </div>
      </main>
    </div>
  );
}
