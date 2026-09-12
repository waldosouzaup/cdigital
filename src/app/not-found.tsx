/**
 * Página 404 do sistema — substitui o "This page could not be found." padrão do
 * Next.js, que aparecia sem marca, sem tema e em inglês.
 *
 * Quem chega aqui é quase sempre um usuário já autenticado que digitou errado ou
 * seguiu link velho: o middleware manda visitante anônimo em rota desconhecida
 * para `/login` antes de chegar nesta tela. Por isso os dois destinos são
 * neutros — servem tanto para quem tem sessão quanto para os poucos caminhos
 * públicos que caem aqui (`/inscricao` sem slug, por exemplo).
 *
 * Estática de propósito: não busca nada, não depende de sessão.
 */
import Link from "next/link";
import { Marca } from "@/components/marca";

export const metadata = { title: "Página não encontrada — Comitê Digital" };

export default function NaoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16 text-ink">
      <div className="flex w-full max-w-lg flex-col gap-7">
        <Marca subtitulo="Sistema de Gestão" />

        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary-tint px-3 py-1 font-mono text-[0.7rem] font-bold tracking-wider text-primary uppercase">
            404 · Endereço não localizado
          </span>

          <h1 className="text-4xl font-extrabold tracking-tight text-ink-strong sm:text-5xl">
            Esta página não existe
          </h1>

          <p className="max-w-prose text-small leading-relaxed text-ink-muted">
            O endereço que você abriu não está no sistema. Ele pode ter mudado de lugar, expirado,
            ou vir com um caractere a mais.
          </p>
          <p className="max-w-prose text-small leading-relaxed text-ink-muted">
            Nada foi perdido: seus registros, contratos e documentos continuam onde estavam.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 py-3 text-small font-bold text-white shadow-xs transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            Voltar ao início
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-surface px-6 py-3 text-small font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          >
            Entrar no painel
          </Link>
        </div>
      </div>
    </main>
  );
}
