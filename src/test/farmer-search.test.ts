import { describe, it, expect } from "vitest";
import {
  FARMER_PAGE_SIZE,
  buildFarmerOrParts,
  farmerPageRange,
  minSearchLength,
  normalizePhone,
  sanitizeForOr,
  shouldSearch,
} from "@/lib/farmerSearch";

describe("farmerSearch — minSearchLength / shouldSearch", () => {
  it("requires 1 char for purely numeric input", () => {
    expect(minSearchLength("9")).toBe(1);
    expect(shouldSearch("9")).toBe(true);
  });
  it("requires 2 chars for text input", () => {
    expect(minSearchLength("a")).toBe(2);
    expect(shouldSearch("a")).toBe(false);
    expect(shouldSearch("ab")).toBe(true);
  });
  it("trims whitespace before deciding", () => {
    expect(shouldSearch("   ")).toBe(false);
    expect(shouldSearch("  a ")).toBe(false);
    expect(shouldSearch("  ab ")).toBe(true);
  });
});

describe("farmerSearch — sanitizeForOr", () => {
  it("replaces commas and parentheses with spaces", () => {
    expect(sanitizeForOr("Maria, (Sr.)")).toBe("Maria   Sr. ");
  });
  it("leaves safe text untouched", () => {
    expect(sanitizeForOr("Joao da Silva")).toBe("Joao da Silva");
  });
  it("never returns characters that break PostgREST .or()", () => {
    const out = sanitizeForOr("a,b(c)d,e");
    expect(out).not.toMatch(/[(),]/);
  });
});

describe("farmerSearch — normalizePhone (PT-AO)", () => {
  it("extracts digits ignoring spaces, plus and dashes", () => {
    expect(normalizePhone("+244 923 456 789").digits).toBe("244923456789");
    expect(normalizePhone("923-456-789").digits).toBe("923456789");
  });
  it("strips 244 prefix to produce alt", () => {
    const r = normalizePhone("244923456789");
    expect(r.digits).toBe("244923456789");
    expect(r.alt).toBe("923456789");
  });
  it("prepends 244 when given 9 digits starting with 9", () => {
    const r = normalizePhone("923456789");
    expect(r.digits).toBe("923456789");
    expect(r.alt).toBe("244923456789");
  });
  it("does not invent an alt for short numbers", () => {
    expect(normalizePhone("12").alt).toBe("");
    expect(normalizePhone("").alt).toBe("");
  });
  it("does not prepend 244 for 9-digit numbers not starting with 9", () => {
    const r = normalizePhone("812345678");
    expect(r.alt).toBe("");
  });
});

describe("farmerSearch — buildFarmerOrParts", () => {
  it("always includes name/code/bi branches", () => {
    const parts = buildFarmerOrParts("Maria");
    expect(parts).toEqual(
      expect.arrayContaining([
        "full_name.ilike.%Maria%",
        "code.ilike.%Maria%",
        "bi.ilike.%Maria%",
      ])
    );
  });
  it("includes phone branch only when >=3 digits", () => {
    const parts = buildFarmerOrParts("ab");
    expect(parts.some((p) => p.startsWith("phone."))).toBe(false);
    const parts2 = buildFarmerOrParts("923");
    expect(parts2.some((p) => p === "phone.ilike.%923%")).toBe(true);
  });
  it("adds both digits and alt phone variants for 9-digit local number", () => {
    const parts = buildFarmerOrParts("923456789");
    expect(parts).toEqual(
      expect.arrayContaining([
        "phone.ilike.%923456789%",
        "phone.ilike.%244923456789%",
      ])
    );
  });
  it("adds both digits and alt phone variants for 244-prefixed number", () => {
    const parts = buildFarmerOrParts("244923456789");
    expect(parts).toEqual(
      expect.arrayContaining([
        "phone.ilike.%244923456789%",
        "phone.ilike.%923456789%",
      ])
    );
  });
  it("handles spaced/+ formatted input identically to digits-only", () => {
    const a = buildFarmerOrParts("+244 923 456 789").filter((p) => p.startsWith("phone."));
    const b = buildFarmerOrParts("244923456789").filter((p) => p.startsWith("phone."));
    expect(a.sort()).toEqual(b.sort());
  });
  it("does not duplicate phone branch when digits == alt", () => {
    // Digits with no transformation should produce only one phone branch
    const parts = buildFarmerOrParts("555");
    const phoneParts = parts.filter((p) => p.startsWith("phone."));
    expect(phoneParts).toHaveLength(1);
  });
  it("escapes parentheses/commas in name fragments to keep .or() valid", () => {
    const parts = buildFarmerOrParts("Maria, (Jr)");
    for (const p of parts) {
      // Operator separators must not appear inside ilike values.
      const value = p.split(".ilike.%")[1]?.replace(/%$/, "") ?? "";
      expect(value).not.toMatch(/[(),]/);
    }
  });
});

describe("farmerSearch — farmerPageRange", () => {
  it("page 0 = [0, PAGE_SIZE-1]", () => {
    expect(farmerPageRange(0)).toEqual({ from: 0, to: FARMER_PAGE_SIZE - 1 });
  });
  it("page N respects PAGE_SIZE windows", () => {
    expect(farmerPageRange(1)).toEqual({ from: FARMER_PAGE_SIZE, to: 2 * FARMER_PAGE_SIZE - 1 });
    expect(farmerPageRange(3)).toEqual({ from: 3 * FARMER_PAGE_SIZE, to: 4 * FARMER_PAGE_SIZE - 1 });
  });
  it("clamps negative page indices to 0", () => {
    expect(farmerPageRange(-5)).toEqual({ from: 0, to: FARMER_PAGE_SIZE - 1 });
  });
  it("returns a window of exactly PAGE_SIZE rows", () => {
    const { from, to } = farmerPageRange(2);
    expect(to - from + 1).toBe(FARMER_PAGE_SIZE);
  });
});
