import { describe, it, expect } from "vitest";
import { farmerSchema } from "@/lib/formValidation";

describe("Validação do Registo de Produtor", () => {
  const validFarmer = {
    nome: "João Manuel",
    bi: "123456789LA042",
    dataNascimento: "1985-03-15",
    genero: "Masculino",
    telefone: "+244 923456789",
    provincia: "Huambo",
    municipio: "Caála",
    escolaCampo: "ECA Teste",
    patec: "1",
  };

  it("aceita dados válidos completos", () => {
    const result = farmerSchema.safeParse(validFarmer);
    expect(result.success).toBe(true);
  });

  it("aceita dados com campos opcionais vazios", () => {
    const result = farmerSchema.safeParse({
      nome: "Maria Silva",
      bi: "",
      dataNascimento: "",
      genero: "",
      telefone: "",
      provincia: "",
      municipio: "",
      escolaCampo: "",
      patec: "2",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita nome com menos de 2 caracteres", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, nome: "A" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("2 caracteres");
  });

  it("rejeita nome vazio", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, nome: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita nome com mais de 100 caracteres", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, nome: "A".repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("longo");
  });

  it("rejeita BI com caracteres especiais", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, bi: "ABC@#$" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("inválidos");
  });

  it("aceita BI alfanumérico válido", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, bi: "005678901LA042" });
    expect(result.success).toBe(true);
  });

  it("rejeita telefone com formato inválido", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, telefone: "abc" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("inválido");
  });

  it("aceita telefone angolano válido", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, telefone: "+244 923000000" });
    expect(result.success).toBe(true);
  });

  it("rejeita PATEC vazio (obrigatório)", () => {
    const result = farmerSchema.safeParse({ ...validFarmer, patec: "" });
    expect(result.success).toBe(false);
  });

  it("aceita qualquer código PATEC não vazio (validação efectiva fica no formulário)", () => {
    ["1", "5", "11", "PATEC-07"].forEach((patec) => {
      const result = farmerSchema.safeParse({ ...validFarmer, patec });
      expect(result.success).toBe(true);
    });
  });
});
