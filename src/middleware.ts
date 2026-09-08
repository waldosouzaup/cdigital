/**
 * Renovação de sessão a cada requisição (Next.js 15 — o arquivo ainda se chama
 * `middleware.ts` aqui: o Context 7 mostrou que ele só vira `proxy.ts` a partir do
 * Next.js 16, e a Seção 3 fixa a versão 15 deste projeto).
 *
 * Usa `getClaims()`, não `getUser()`: é o método que a documentação atual do Supabase
 * recomenda especificamente para "proteger páginas e dados" no servidor — valida a
 * assinatura do JWT a cada chamada (localmente, via chave assimétrica, sem round-trip
 * ao Auth) em vez de só ler o cookie sem checar.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROTAS_PUBLICAS = ["/login", "/verificacao", "/mfa", "/coleta"];

// A landing (`/`) é pública, mas com correspondência exata — `startsWith("/")` pegaria
// o site inteiro.
//
// BUG encontrado e corrigido na Fase 2: esta função chegou a incluir as rotas do
// painel (`/dashboard`, `/pessoas` etc.) na lista de "públicas", o que fazia o
// middleware nunca redirecionar usuário não autenticado para fora delas — o RLS ainda
// impedia o dado de vazar (sem JWT, a policy nega tudo), mas a casca da tela ficava
// acessível sem login, o que contraria a Seção 3 ("proteger páginas e dados" via
// `getClaims()`). Painel não entra mais aqui: tudo que não está em `ROTAS_PUBLICAS`
// nem é `/` exige sessão.
function ehRotaPublica(pathname: string) {
  return pathname === "/" || ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Não rodar código entre createServerClient e getClaims() — um erro aqui pode
  // deixar o usuário sendo deslogado de forma difícil de depurar.
  const { data, error } = await supabase.auth.getClaims();
  const autenticado = !error && data?.claims != null;

  if (!autenticado && !ehRotaPublica(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
