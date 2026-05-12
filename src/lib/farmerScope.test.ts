import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client used inside farmerScope
vi.mock("@/integrations/supabase/client", () => {
  const fromMock = vi.fn();
  return { supabase: { from: fromMock } };
});

import { supabase } from "@/integrations/supabase/client";
import {
  applyFarmerScopeFilter,
  getFilterScope,
  resolveScope,
  type ResolvedScope,
} from "./farmerScope";

/** Builds a chainable query stub that records every call. */
function makeQuery() {
  const calls: Array<{ method: string; args: any[] }> = [];
  const q: any = {};
  const chain = (method: string) =>
    vi.fn((...args: any[]) => {
      calls.push({ method, args });
      return q;
    });
  q.neq = chain("neq");
  q.in = chain("in");
  q.eq = chain("eq");
  q.select = chain("select");
  q.order = chain("order");
  q.__calls = calls;
  return q;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFilterScope", () => {
  it("admin → global", () => {
    expect(getFilterScope(["admin"])).toBe("global");
  });
  it("gestor_incentivos → global", () => {
    expect(getFilterScope(["gestor_incentivos"])).toBe("global");
  });
  it("senior/junior roles → province", () => {
    expect(getFilterScope(["senior_agricultura"])).toBe("province");
    expect(getFilterScope(["junior_monitoria"])).toBe("province");
  });
  it("tecnico_extensionista → eca", () => {
    expect(getFilterScope(["tecnico_extensionista"])).toBe("eca");
  });
  it("no roles → defaults to global", () => {
    expect(getFilterScope([])).toBe("global");
  });
  it("global role wins over province role", () => {
    expect(getFilterScope(["admin", "junior_agricultura"])).toBe("global");
  });
});

describe("applyFarmerScopeFilter — exclusão de Removido", () => {
  const globalScope: ResolvedScope = {
    scope: "global",
    provinces: [],
    ecas: [],
    filterLabel: "Todas as províncias",
  };

  it("exclui status='Removido' por defeito (global)", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, globalScope);
    expect(q.neq).toHaveBeenCalledWith("status", "Removido");
    expect(q.neq).toHaveBeenCalledTimes(1);
  });

  it("exclui Removido também em scope province", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "province",
      provinces: ["Benguela"],
      ecas: [],
      filterLabel: "Benguela",
    });
    expect(q.neq).toHaveBeenCalledWith("status", "Removido");
  });

  it("exclui Removido também em scope eca", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "eca",
      provinces: [],
      ecas: ["Elavoko"],
      filterLabel: "Elavoko",
    });
    expect(q.neq).toHaveBeenCalledWith("status", "Removido");
  });

  it("inclui Removidos quando includeRemoved=true", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, globalScope, { includeRemoved: true });
    expect(q.neq).not.toHaveBeenCalled();
  });
});

describe("applyFarmerScopeFilter — filtro geográfico", () => {
  it("global: não aplica IN nem province nem school", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "global",
      provinces: [],
      ecas: [],
      filterLabel: "",
    });
    expect(q.in).not.toHaveBeenCalled();
  });

  it("province: aplica IN sobre province com lista correcta", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "province",
      provinces: ["Benguela", "Huila"],
      ecas: [],
      filterLabel: "",
    });
    expect(q.in).toHaveBeenCalledWith("province", ["Benguela", "Huila"]);
    expect(q.in).toHaveBeenCalledTimes(1);
  });

  it("eca: aplica IN sobre school com lista correcta", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "eca",
      provinces: [],
      ecas: ["Elavoko", "Kuatoko"],
      filterLabel: "",
    });
    expect(q.in).toHaveBeenCalledWith("school", ["Elavoko", "Kuatoko"]);
  });

  it("province sem lista: não aplica IN (evita query vazia .in([]))", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "province",
      provinces: [],
      ecas: [],
      filterLabel: "",
    });
    expect(q.in).not.toHaveBeenCalled();
  });

  it("eca sem lista: não aplica IN", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "eca",
      provinces: [],
      ecas: [],
      filterLabel: "",
    });
    expect(q.in).not.toHaveBeenCalled();
  });

  it("nunca filtra por province quando scope=eca", () => {
    const q = makeQuery();
    applyFarmerScopeFilter(q, {
      scope: "eca",
      provinces: ["Benguela"],
      ecas: ["Elavoko"],
      filterLabel: "",
    });
    const inProvinceCall = q.__calls.find(
      (c: any) => c.method === "in" && c.args[0] === "province"
    );
    expect(inProvinceCall).toBeUndefined();
  });

  it("retorna o builder para encadeamento", () => {
    const q = makeQuery();
    const result = applyFarmerScopeFilter(q, {
      scope: "province",
      provinces: ["Benguela"],
      ecas: [],
      filterLabel: "",
    });
    expect(result).toBe(q);
  });
});

describe("resolveScope", () => {
  function mockTable(rows: any[]) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows }),
    };
  }

  it("global role: não consulta tabelas e devolve scope global", async () => {
    const r = await resolveScope("u1", ["admin"]);
    expect(r.scope).toBe("global");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("province role: carrega user_provinces e devolve scope province", async () => {
    (supabase.from as any).mockReturnValueOnce(
      mockTable([{ province: "Benguela" }, { province: "Huila" }])
    );
    const r = await resolveScope("u1", ["junior_agricultura"]);
    expect(supabase.from).toHaveBeenCalledWith("user_provinces");
    expect(r.scope).toBe("province");
    expect(r.provinces).toEqual(["Benguela", "Huila"]);
    expect(r.filterLabel).toBe("Benguela, Huila");
  });

  it("province role sem províncias atribuídas: fallback para global", async () => {
    (supabase.from as any).mockReturnValueOnce(mockTable([]));
    const r = await resolveScope("u1", ["junior_agricultura"]);
    expect(r.scope).toBe("global");
    expect(r.provinces).toEqual([]);
  });

  it("eca role: carrega user_ecas e devolve scope eca", async () => {
    (supabase.from as any).mockReturnValueOnce(
      mockTable([{ eca_name: "Elavoko" }])
    );
    const r = await resolveScope("u1", ["tecnico_extensionista"]);
    expect(supabase.from).toHaveBeenCalledWith("user_ecas");
    expect(r.scope).toBe("eca");
    expect(r.ecas).toEqual(["Elavoko"]);
    expect(r.filterLabel).toBe("Elavoko");
  });

  it("eca role sem ECAs atribuídas: fallback para global", async () => {
    (supabase.from as any).mockReturnValueOnce(mockTable([]));
    const r = await resolveScope("u1", ["tecnico_extensionista"]);
    expect(r.scope).toBe("global");
  });
});
