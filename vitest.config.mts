import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // tsconfig.json fixa "jsx": "preserve" (padrão do Next.js), o que faz o
  // transformador do Vite (oxc, nesta versão) não converter .tsx — qualquer teste
  // que importe um template de e-mail (src/emails/*.tsx) quebra. Forçar o runtime
  // automático de JSX só para os testes resolve, sem tocar no tsconfig do Next.js.
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
});
