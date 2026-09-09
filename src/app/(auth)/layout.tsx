/**
 * Layout da interface de acesso (Login, Definir senha, MFA opcional).
 * Interface limpa, centrada e focada estritamente no acesso do usuário.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070d18] px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

