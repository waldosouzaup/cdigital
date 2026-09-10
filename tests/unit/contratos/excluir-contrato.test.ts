import { describe, expect, it } from "vitest";
import { deletedRecords } from "@/db/schema";

describe("Tabela e Definição de DadosExcluidos", () => {
  it("contém a definição da tabela dados_excluidos com todas as colunas obrigatórias", () => {
    expect(deletedRecords).toBeDefined();
    // Verifica colunas do schema Drizzle
    expect(deletedRecords.id).toBeDefined();
    expect(deletedRecords.organizationId).toBeDefined();
    expect(deletedRecords.recordType).toBeDefined();
    expect(deletedRecords.recordId).toBeDefined();
    expect(deletedRecords.data).toBeDefined();
    expect(deletedRecords.userId).toBeDefined();
    expect(deletedRecords.userName).toBeDefined();
    expect(deletedRecords.userLogin).toBeDefined();
    expect(deletedRecords.reason).toBeDefined();
    expect(deletedRecords.deletedAt).toBeDefined();
    expect(deletedRecords.createdAt).toBeDefined();
    expect(deletedRecords.updatedAt).toBeDefined();
  });

  it("garante que o nome da tabela no Postgres é dados_excluidos", () => {
    // @ts-expect-error drizzle internal table symbol
    const tableName = deletedRecords[Symbol.for("drizzle:Name")];
    expect(tableName).toBe("dados_excluidos");
  });
});
