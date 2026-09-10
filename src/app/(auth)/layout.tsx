/**
 * Layout da interface de acesso (Login, Definir senha, MFA opcional).
 * Interface limpa, centrada e focada estritamente no acesso do usuário.
 */
import { SeletorTema } from "@/components/seletor-tema";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4 py-12 text-ink">
      <div className="absolute top-6 right-6">
        <SeletorTema />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

