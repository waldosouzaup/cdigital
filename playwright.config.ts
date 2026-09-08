import { defineConfig, devices } from "@playwright/test";

/**
 * Config mínima para os testes E2E da Fase 4 (fluxo de campo offline).
 *
 * Os testes assumem `npm run dev` já rodando em http://localhost:3000 e as
 * variáveis de `.env.local` exportadas no shell (o mesmo pré-requisito dos testes
 * de integração — ver TESTE-LOCAL.md). Não subimos o servidor aqui de propósito:
 * rodar `next build/start` em paralelo com um `next dev` já corrompeu `.next`
 * nesta sessão mais de uma vez.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.APP_URL || "http://localhost:3000",
    trace: "off",
  },
  projects: [
    {
      name: "mobile-360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } },
    },
  ],
});
