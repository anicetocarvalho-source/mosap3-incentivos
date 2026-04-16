import { describe, it, expect, vi } from "vitest";
import { classifyError, withRetry } from "@/lib/errorHandling";

describe("classifyError", () => {
  it("traduz 'Invalid login credentials' para português", () => {
    const result = classifyError({ message: "Invalid login credentials" });
    expect(result.category).toBe("auth");
    expect(result.description).toContain("incorrectos");
    expect(result.retryable).toBe(false);
  });

  it("traduz 'Email not confirmed'", () => {
    const result = classifyError({ message: "Email not confirmed" });
    expect(result.description).toContain("confirmado");
  });

  it("classifica erros de rede como retryable", () => {
    const result = classifyError({ message: "Failed to fetch" });
    expect(result.category).toBe("network");
    expect(result.retryable).toBe(true);
    expect(result.description).toContain("internet");
  });

  it("classifica timeout como retryable", () => {
    const result = classifyError({ message: "ETIMEDOUT" });
    expect(result.retryable).toBe(true);
  });

  it("traduz código de erro DB 23505 (duplicado)", () => {
    const result = classifyError({ code: "23505", message: "unique violation" });
    expect(result.description).toContain("duplicado");
  });

  it("traduz código 42501 (sem permissão)", () => {
    const result = classifyError({ code: "42501", message: "permission denied" });
    expect(result.description).toContain("permissão");
  });

  it("classifica HTTP 401 como auth", () => {
    const result = classifyError({ status: 401, message: "" });
    expect(result.category).toBe("auth");
    expect(result.description).toContain("sessão");
  });

  it("classifica HTTP 500 como server retryable", () => {
    const result = classifyError({ status: 500, message: "" });
    expect(result.category).toBe("server");
    expect(result.retryable).toBe(true);
  });

  it("retorna unknown para null/undefined", () => {
    expect(classifyError(null).category).toBe("unknown");
    expect(classifyError(undefined).category).toBe("unknown");
  });
});

describe("withRetry", () => {
  it("retorna imediatamente se a operação tem sucesso", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("faz retry em erros retryable", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ message: "Failed to fetch" })
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelay: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("não faz retry em erros não-retryable", async () => {
    const fn = vi.fn().mockRejectedValue({ message: "Invalid login credentials" });
    await expect(withRetry(fn, { maxAttempts: 3, baseDelay: 10 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("chama onRetry callback", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce({ message: "Failed to fetch" })
      .mockResolvedValue("ok");
    await withRetry(fn, { maxAttempts: 3, baseDelay: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.objectContaining({ category: "network" }));
  });

  it("lança erro após esgotar tentativas", async () => {
    const fn = vi.fn().mockRejectedValue({ message: "Failed to fetch" });
    await expect(withRetry(fn, { maxAttempts: 2, baseDelay: 10 })).rejects.toBeDefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
