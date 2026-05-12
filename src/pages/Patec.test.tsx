import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ResolvedScope } from "@/lib/farmerScope";

// ---- Mocks --------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [] }),
    })),
  },
}));

const useAuthMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

const resolveScopeMock = vi.fn();
const applyFarmerScopeFilterMock = vi.fn((...args: any[]) => args[0]);
vi.mock("@/lib/farmerScope", async () => {
  const actual = await vi.importActual<any>("@/lib/farmerScope");
  return {
    ...actual,
    resolveScope: (...args: any[]) => resolveScopeMock(...args),
    applyFarmerScopeFilter: (...args: any[]) => applyFarmerScopeFilterMock(...args),
  };
});

const fetchAllPagesMock = vi.fn();
vi.mock("@/lib/supabaseFetchAll", () => ({
  fetchAllPages: (...args: any[]) => fetchAllPagesMock(...args),
}));

// ---- Helpers ------------------------------------------------------------

import Patec from "./Patec";

type Farmer = {
  id: string;
  code: string;
  full_name: string;
  province: string | null;
  municipality: string | null;
  school: string | null;
  patec: number | null;
  status: string;
};

function farmer(i: number, opts: Partial<Farmer> = {}): Farmer {
  return {
    id: `id-${i}`,
    code: `F${i}`,
    full_name: `Produtor ${i}`,
    province: "Benguela",
    municipality: null,
    school: "Elavoko",
    patec: null,
    status: "Aprovado",
    ...opts,
  };
}

const FARMERS_BENGUELA: Farmer[] = [
  ...Array.from({ length: 50 }, (_, i) => farmer(i, { patec: 1 })),
  ...Array.from({ length: 30 }, (_, i) => farmer(100 + i, { patec: 2 })),
  ...Array.from({ length: 20 }, (_, i) => farmer(200 + i, { patec: null })),
];

const FARMERS_HUILA: Farmer[] = [
  ...Array.from({ length: 10 }, (_, i) =>
    farmer(300 + i, { province: "Huila", school: "4 De Abril", patec: 3 })
  ),
  ...Array.from({ length: 5 }, (_, i) =>
    farmer(400 + i, { province: "Huila", school: "4 De Abril", patec: null })
  ),
];

const FARMERS_ECA_ELAVOKO: Farmer[] = Array.from({ length: 15 }, (_, i) =>
  farmer(500 + i, { school: "Elavoko", patec: 1 })
);

function setupUser(scope: ResolvedScope, roles: string[]) {
  useAuthMock.mockReturnValue({
    isAdmin: roles.includes("admin"),
    user: { id: "u1" },
    roles,
    authReady: true,
  });
  resolveScopeMock.mockResolvedValue(scope);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Patec />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

// ---- Tests --------------------------------------------------------------

describe("Patec — integração: alternância de scope", () => {
  it("Admin (global): mostra todos os 100 produtores e stats globais", async () => {
    setupUser(
      { scope: "global", provinces: [], ecas: [], filterLabel: "Todas" },
      ["admin"]
    );
    fetchAllPagesMock.mockResolvedValueOnce([
      ...FARMERS_BENGUELA,
      ...FARMERS_HUILA,
    ]);

    renderPage();

    await waitFor(() => {
      // Total Produtores card
      expect(screen.getAllByText("115").length).toBeGreaterThan(0);
    });
    // Não deve mostrar badge de scope
    expect(screen.queryByText(/Províncias:/)).toBeNull();
    expect(screen.queryByText(/ECAs:/)).toBeNull();
    // applyFarmerScopeFilter foi chamado com scope global
    expect(applyFarmerScopeFilterMock).toHaveBeenCalled();
    expect(applyFarmerScopeFilterMock.mock.calls[0][1].scope).toBe("global");
  });

  it("Júnior (province=Benguela): mostra só 100 produtores e badge de província", async () => {
    setupUser(
      {
        scope: "province",
        provinces: ["Benguela"],
        ecas: [],
        filterLabel: "Benguela",
      },
      ["junior_agricultura"]
    );
    fetchAllPagesMock.mockResolvedValueOnce(FARMERS_BENGUELA);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("100").length).toBeGreaterThan(0);
    });
    // Badge de scope visível
    expect(screen.getByText(/Províncias:/)).toBeInTheDocument();
    expect(screen.getByText(/Benguela/)).toBeInTheDocument();
    // Sem-PATEC = 20
    expect(screen.getByText(/20 sem PATEC/)).toBeInTheDocument();
    // applyFarmerScopeFilter recebeu scope province
    expect(applyFarmerScopeFilterMock.mock.calls[0][1].scope).toBe("province");
    expect(applyFarmerScopeFilterMock.mock.calls[0][1].provinces).toEqual([
      "Benguela",
    ]);
  });

  it("Técnico extensionista (eca=Elavoko): mostra só 15 produtores e badge ECA", async () => {
    setupUser(
      {
        scope: "eca",
        provinces: [],
        ecas: ["Elavoko"],
        filterLabel: "Elavoko",
      },
      ["tecnico_extensionista"]
    );
    fetchAllPagesMock.mockResolvedValueOnce(FARMERS_ECA_ELAVOKO);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("15").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/ECAs:/)).toBeInTheDocument();
    expect(screen.getByText(/Elavoko/)).toBeInTheDocument();
    expect(applyFarmerScopeFilterMock.mock.calls[0][1].scope).toBe("eca");
    expect(applyFarmerScopeFilterMock.mock.calls[0][1].ecas).toEqual([
      "Elavoko",
    ]);
  });

  it("Province sem dados (ex.: Bié): mostra 0 produtores", async () => {
    setupUser(
      { scope: "province", provinces: ["Bié"], ecas: [], filterLabel: "Bié" },
      ["junior_monitoria"]
    );
    fetchAllPagesMock.mockResolvedValueOnce([]);

    renderPage();

    await waitFor(() => {
      // "0" deve aparecer nos cards de stats
      expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Bié/)).toBeInTheDocument();
    expect(screen.queryByText(/sem PATEC/)).toBeNull(); // não há sem-PATEC se total=0
  });

  it("alternância utilizador → re-fetch com novo scope", async () => {
    // Primeiro render: admin global
    setupUser(
      { scope: "global", provinces: [], ecas: [], filterLabel: "" },
      ["admin"]
    );
    fetchAllPagesMock.mockResolvedValueOnce(FARMERS_BENGUELA);
    const { unmount } = renderPage();
    await waitFor(() =>
      expect(screen.getAllByText("100").length).toBeGreaterThan(0)
    );
    unmount();

    // Segundo render: técnico extensionista (Elavoko)
    setupUser(
      {
        scope: "eca",
        provinces: [],
        ecas: ["Elavoko"],
        filterLabel: "Elavoko",
      },
      ["tecnico_extensionista"]
    );
    fetchAllPagesMock.mockResolvedValueOnce(FARMERS_ECA_ELAVOKO);
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText("15").length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/Elavoko/)).toBeInTheDocument();
  });
});
