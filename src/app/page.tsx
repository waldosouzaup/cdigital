import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { SeletorTema } from "@/components/seletor-tema";

export const metadata: Metadata = {
  title: "Comitê Digital | Equipe, contratos e pendências sob controle",
  description:
    "Centralize a gestão da sua campanha: cadastre colaboradores pelo celular, organize documentos e acompanhe contratos e pendências no Painel do Gestor.",
};

const botaoGestor =
  "inline-flex min-h-14 w-full items-center justify-center rounded-full bg-primary-hover px-7 py-4 text-sm sm:text-base font-bold text-canvas shadow-elevation transition hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus sm:w-auto";
const botaoColeta =
  "inline-flex min-h-14 w-full items-center justify-center rounded-full border-2 border-primary-hover bg-primary-tint px-7 py-4 text-sm sm:text-base font-bold text-ink shadow-card transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus sm:w-auto";

const modulos = [
  {
    id: "pessoas",
    icone: "👥",
    titulo: "Saiba quem está na equipe e onde atua",
    descricao:
      "Reúna os colaboradores em uma única base, evite cadastros duplicados por CPF e organize a equipe por região. Veja quem está com a documentação em dia e quem precisa de atenção.",
    destaques: ["Cadastro único", "Equipe por região", "Pendências visíveis"],
    link: "/pessoas",
  },
  {
    id: "contratos",
    icone: "📄",
    titulo: "Acompanhe cada contrato até a assinatura",
    descricao:
      "Gere contratos a partir dos dados cadastrados, envie para assinatura eletrônica e acompanhe o status de cada um. Controle vigências e formalize distratos com menos preenchimento manual.",
    destaques: ["Geração de contratos", "Assinatura eletrônica", "Controle de prazos"],
    link: "/contratos",
  },
  {
    id: "documentos",
    icone: "🔍",
    titulo: "Resolva pendências antes de elas se acumularem",
    descricao:
      "Receba os documentos vinculados a cada colaborador e confira tudo no mesmo lugar. Aprove, rejeite ou solicite correções com um histórico para acompanhar o que falta.",
    destaques: ["Documentos por pessoa", "Conferência centralizada", "Histórico de revisão"],
    link: "/documentos",
  },
  {
    id: "atividades",
    icone: "📌",
    titulo: "Organize as atividades e os registros da operação",
    descricao:
      "Acompanhe os registros das atividades em campo e consulte os relatórios da campanha. Mantenha as informações reunidas para apoiar a gestão e a preparação da prestação de contas.",
    destaques: ["Atividades em campo", "Visão da operação", "Relatórios para conferência"],
    link: "/atividades",
  },
];

const etapasFluxo = [
  {
    passo: "01",
    titulo: "Receba os dados pelo celular",
    descricao:
      "Compartilhe o link de coleta. O colaborador preenche os dados e envia as fotos dos documentos pelo navegador, sem instalar aplicativo nem criar senha.",
  },
  {
    passo: "02",
    titulo: "Confira e formalize no painel",
    descricao:
      "Sua equipe confere os cadastros, resolve pendências e gera os contratos com os dados já recebidos. Depois, acompanha o envio e a assinatura em um único fluxo.",
  },
  {
    passo: "03",
    titulo: "Enxergue o que precisa da sua decisão",
    descricao:
      "Acompanhe o avanço por região, identifique documentos pendentes e contratos que aguardam assinatura. Consulte o histórico e exporte relatórios para orientar os próximos passos.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-primary-tint selection:text-primary font-sans">
      {/* 1. NAVEGAÇÃO SUPERIOR CLEAN */}
      <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Marca subtitulo="Sistema de Gestão" />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-wide text-ink-muted">
            <Link href="#modulos" className="hover:text-primary transition-colors">
              Recursos
            </Link>
            <Link href="#fluxo" className="hover:text-primary transition-colors">
              Como funciona
            </Link>
            <Link
              href="/inscricao/candidado-eleicao-2026"
              className="hover:text-primary transition-colors"
            >
              Coletar Dados →
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <SeletorTema />
            <Link
              href="/login"
              className="bg-primary-hover hover:brightness-90 text-canvas px-5 py-2.5 min-h-11 text-xs font-semibold flex items-center shadow-sm rounded-full transition"
            >
              <span>Acessar Painel</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16 space-y-24">
        {/* 2. HERO RESPIRÁVEL & SNAPSHOT GERENCIAL */}
        <section aria-labelledby="titulo-principal" className="space-y-12">
          <div className="mx-auto max-w-4xl space-y-6 text-center">
            <p className="text-sm font-semibold text-ink-muted">
              Gestão de equipes para campanhas eleitorais
            </p>

            <h1
              id="titulo-principal"
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink-strong leading-[1.1] text-balance"
            >
              Sua equipe organizada. Sua gestão no controle.
            </h1>

            <p className="mx-auto text-base sm:text-lg text-ink-muted leading-relaxed max-w-2xl font-normal text-pretty">
              Chega de procurar documentos em conversas e conferir contratos em planilhas separadas.
              Com o Comitê Digital, você reúne equipe, documentos e assinaturas em um só painel e
              sabe o que precisa de atenção para a campanha avançar.
            </p>

            <div className="mx-auto grid max-w-2xl grid-cols-1 gap-5 pt-4 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2.5">
                <Link href="/login" className={`${botaoGestor} sm:w-full`}>
                  Entrar no Painel do Gestor
                </Link>
                <p className="text-xs text-ink-muted">Já tem acesso? Gerencie sua operação.</p>
              </div>
              <div className="space-y-2.5">
                <Link href="/candidado-eleicao-2026" className={`${botaoColeta} sm:w-full`}>
                  Experimentar Coleta Móvel
                </Link>
                <p className="text-xs text-ink-muted">
                  Conheça o formulário que sua equipe recebe.
                </p>
              </div>
            </div>
          </div>

          {/* Snapshot Executivo em 4 Métricas Chave */}
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5 mb-6">
              <div>
                <span className="text-xs text-ink-muted block">Visão do gestor</span>
                <span className="text-sm font-bold text-ink">
                  Saiba onde agir, sem juntar várias planilhas
                </span>
              </div>
              <span className="self-start rounded-full border border-line bg-surface-sunken px-3 py-1 text-xs text-ink-muted sm:self-auto">
                Demonstração com dados ilustrativos
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <span className="text-xs text-ink-muted">Colaboradores cadastrados</span>
                <div className="text-2xl sm:text-3xl font-black text-ink font-mono">148</div>
                <span className="text-xs text-ink-muted font-medium block">
                  Equipe reunida em uma única base
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-ink-muted">Contratos emitidos</span>
                <div className="text-2xl sm:text-3xl font-black text-ink font-mono">142</div>
                <span className="text-xs text-ink-muted font-medium block">
                  Formalizações para acompanhar
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-ink-muted">Contratos assinados</span>
                <div className="text-2xl sm:text-3xl font-black text-ink font-mono">134</div>
                <span className="text-xs text-ink-muted font-medium block">
                  Assinaturas recebidas e registradas
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-ink-muted">Aguardando assinatura</span>
                <div className="text-2xl sm:text-3xl font-black text-ink font-mono">8</div>
                <span className="text-xs text-ink-muted font-medium block">
                  Saiba quem precisa de um lembrete
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. MÓDULOS DO SISTEMA (APRESENTAÇÃO DIRETA DO PRODUTO) */}
        <section id="modulos" className="space-y-8 scroll-mt-24">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-strong tracking-tight">
              Menos retrabalho em cada etapa da gestão
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Do cadastro à assinatura, mantenha as informações conectadas para sua equipe trabalhar
              com clareza e você decidir com mais segurança.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modulos.map((mod) => (
              <div
                key={mod.id}
                className="rounded-2xl border border-line bg-surface p-6 sm:p-7 space-y-5 flex flex-col justify-between hover:border-primary/40 shadow-sm hover:shadow-card transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tint border border-primary/20 text-lg">
                      <span aria-hidden="true">{mod.icone}</span>
                    </span>
                    <Link
                      href={mod.link}
                      aria-label={`Abrir módulo: ${mod.titulo}`}
                      className="text-xs font-bold text-ink hover:underline flex items-center gap-1"
                    >
                      <span>Abrir módulo</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>

                  <h3 className="text-lg font-bold text-ink tracking-tight">{mod.titulo}</h3>

                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed font-normal">
                    {mod.descricao}
                  </p>
                </div>

                <div className="pt-3 border-t border-line flex flex-wrap gap-2">
                  {mod.destaques.map((item, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-line bg-surface-sunken px-2.5 py-1 text-xs text-ink-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. COMO FUNCIONA NA PRÁTICA (FLUXO EM 3 ETAPAS) */}
        <section id="fluxo" className="space-y-8 scroll-mt-24">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-strong tracking-tight">
              Do celular da equipe ao seu painel, em três etapas
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Distribua a coleta, centralize a conferência e acompanhe o andamento da operação.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {etapasFluxo.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-line bg-surface p-6 space-y-4 flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-3">
                  <span className="font-mono text-xs font-bold text-ink bg-primary-tint px-2.5 py-1 rounded-full border border-primary/20 inline-block">
                    Etapa {item.passo}
                  </span>
                  <h3 className="text-base font-bold text-ink">{item.titulo}</h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    {item.descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chamada para teste móvel */}
          <div className="rounded-2xl border border-line bg-surface-sunken p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-ink">
                Veja como é simples enviar os dados pelo celular
              </h3>
              <p className="text-xs text-ink-muted max-w-xl">
                Abra o formulário público e conheça a experiência do colaborador antes de
                compartilhar com a equipe. Sem instalar aplicativo e sem criar senha.
              </p>
            </div>
            <Link href="/candidado-eleicao-2026" className={`${botaoColeta} shrink-0`}>
              Experimentar Coleta Móvel
            </Link>
          </div>
        </section>

        {/* 5. ENCERRAMENTO EXECUTIVO */}
        <section className="rounded-3xl border border-primary/20 bg-surface-tint p-8 sm:p-12 text-center space-y-6 shadow-card">
          <div className="max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-strong tracking-tight">
              Tenha clareza para conduzir sua campanha todos os dias.
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Saiba quem já está cadastrado, quais contratos foram assinados e o que ainda falta
              resolver. Entre no painel ou conheça a coleta que leva os dados da equipe até você.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/login" className={botaoGestor}>
              Entrar no Painel do Gestor
            </Link>
            <Link href="/candidado-eleicao-2026" className={botaoColeta}>
              Experimentar Coleta Móvel
            </Link>
          </div>
        </section>
      </main>

      {/* 6. RODAPÉ INSTITUCIONAL MINIMALISTA */}
      <footer className="border-t border-line bg-surface-sunken py-10 px-6 sm:px-12 text-ink-muted text-xs">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-line pb-8">
          <div className="space-y-1">
            <Marca subtitulo="Sistema de Gestão" />
            <p className="text-ink-muted text-xs max-w-sm pt-1">
              Equipes, documentos e contratos em um só lugar para facilitar a gestão da sua
              campanha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-ink-muted">
            <Link href="#modulos" className="hover:text-primary transition-colors">
              Recursos
            </Link>
            <Link href="#fluxo" className="hover:text-primary transition-colors">
              Como funciona
            </Link>
            <Link
              href="/inscricao/candidado-eleicao-2026"
              className="hover:text-primary transition-colors"
            >
              Coletar Dados →
            </Link>
            <Link href="/login" className="text-ink hover:underline">
              Painel do Gestor
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-6xl pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[0.7rem] text-ink-subtle font-mono">
          <span>COMITÊ DIGITAL © 2026 · TODOS OS DIREITOS RESERVADOS.</span>
          <div className="flex items-center gap-2 text-ink-muted">
            <span>Desenvolvido por:</span>
            <a
              href="https://waldoeller.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-ink hover:text-primary transition-colors underline decoration-primary/40 underline-offset-4"
            >
              Waldo Eller
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
