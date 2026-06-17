import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import FornecedorCatalogo from "./FornecedorCatalogo";

// Mock heavy child pages so the test is hermetic (no Supabase, no data deps).
// Each mock renders a stable marker plus a stateful input to assert state
// preservation across tab switches (forceMount keeps both mounted).
vi.mock("./FornecedorProdutos", () => ({
  default: () => {
    return (
      <div data-testid="produtos-pane" style={{ height: "3000px" }}>
        <input data-testid="produtos-input" defaultValue="" />
        <span>PRODUTOS_PANE</span>
      </div>
    );
  },
}));

vi.mock("./FornecedorStock", () => ({
  default: () => {
    return (
      <div data-testid="stock-pane" style={{ height: "3000px" }}>
        <input data-testid="stock-input" defaultValue="" />
        <span>STOCK_PANE</span>
      </div>
    );
  },
}));

const supplier = { id: "sup-1", name: "Loja Teste", status: "active", user_id: "u-1" };

const renderAt = (initial: string) =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route element={<div><FornecedorCatalogo /></div>}>
          <Route path="/fornecedor/catalogo" element={null} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

// FornecedorCatalogo uses useOutletContext. Provide it via a wrapper route.
const renderWithCtx = (initial = "/fornecedor/catalogo") =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/fornecedor/catalogo"
          element={
            // Inline outlet-context shim
            <OutletShim />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

// Render FornecedorCatalogo with a fake outlet context. We bypass <Outlet/>
// by directly mocking useOutletContext.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: () => ({ supplier }) };
});

function OutletShim() {
  return <FornecedorCatalogo />;
}

// jsdom doesn't implement scroll. Shim window.scrollTo + scrollY so we can
// assert the restore logic.
let mockScrollY = 0;
beforeEach(() => {
  mockScrollY = 0;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => mockScrollY });
  window.scrollTo = vi.fn((opts: any) => {
    const top = typeof opts === "number" ? opts : opts?.top ?? 0;
    mockScrollY = top;
  }) as unknown as typeof window.scrollTo;
  sessionStorage.clear();
  // rAF runs synchronously to flush the restore loop.
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 0 as unknown as number;
  });
});

describe("FornecedorCatalogo — preservação de separador e scroll", () => {
  it("ambos os separadores ficam montados (forceMount preserva estado)", () => {
    renderWithCtx();
    // Default tab is produtos; stock pane still mounted (hidden via CSS).
    expect(screen.getByTestId("produtos-pane")).toBeInTheDocument();
    expect(screen.getByTestId("stock-pane")).toBeInTheDocument();
  });

  it("preserva valores digitados em inputs ao alternar separadores", async () => {
    const user = userEvent.setup();
    renderWithCtx();

    const produtosInput = screen.getByTestId("produtos-input") as HTMLInputElement;
    await user.type(produtosInput, "filtro-x");
    expect(produtosInput.value).toBe("filtro-x");

    // Switch to stock tab.
    await user.click(screen.getByRole("tab", { name: /Stock/i }));

    const stockInput = screen.getByTestId("stock-input") as HTMLInputElement;
    await user.type(stockInput, "abc");
    expect(stockInput.value).toBe("abc");

    // Switch back to produtos — input value must be intact.
    await user.click(screen.getByRole("tab", { name: /Catálogo/i }));
    expect((screen.getByTestId("produtos-input") as HTMLInputElement).value).toBe("filtro-x");
    expect((screen.getByTestId("stock-input") as HTMLInputElement).value).toBe("abc");
  });

  it("guarda e restaura a posição de scroll por separador", async () => {
    const user = userEvent.setup();
    renderWithCtx();

    // Simulate user scrolled to 800px on produtos tab.
    mockScrollY = 800;
    act(() => { window.dispatchEvent(new Event("scroll")); });

    // Switch to stock — produtos scroll is saved, stock starts at 0.
    await user.click(screen.getByRole("tab", { name: /Stock/i }));
    expect(window.scrollTo).toHaveBeenCalled();
    // Last restore target should be 0 for stock (no prior position).
    const lastCallStock = (window.scrollTo as any).mock.calls.at(-1)[0];
    expect(lastCallStock.top ?? lastCallStock).toBe(0);

    // Scroll stock tab to 1500px.
    mockScrollY = 1500;
    act(() => { window.dispatchEvent(new Event("scroll")); });

    // Switch back to produtos — should restore to 800.
    await user.click(screen.getByRole("tab", { name: /Catálogo/i }));
    const lastCallProdutos = (window.scrollTo as any).mock.calls.at(-1)[0];
    expect(lastCallProdutos.top ?? lastCallProdutos).toBe(800);

    // And back to stock — should restore to 1500.
    await user.click(screen.getByRole("tab", { name: /Stock/i }));
    const lastCallStock2 = (window.scrollTo as any).mock.calls.at(-1)[0];
    expect(lastCallStock2.top ?? lastCallStock2).toBe(1500);
  });

  it("persiste posições em sessionStorage para sobreviver a remontagem", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithCtx();

    mockScrollY = 420;
    act(() => { window.dispatchEvent(new Event("scroll")); });
    await user.click(screen.getByRole("tab", { name: /Stock/i }));
    mockScrollY = 999;
    act(() => { window.dispatchEvent(new Event("scroll")); });

    unmount(); // cleanup effect writes to sessionStorage

    const raw = sessionStorage.getItem("fornecedor-catalogo:scroll");
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!);
    expect(saved.produtos).toBe(420);
    expect(saved.stock).toBe(999);

    // Remount on stock tab — restored scroll should be 999.
    mockScrollY = 0;
    renderWithCtx("/fornecedor/catalogo?tab=stock");
    // On initial render there is no pendingRestore, but the saved state is
    // available via readScroll for the next switch.
    const user2 = userEvent.setup();
    await user2.click(screen.getByRole("tab", { name: /Catálogo/i }));
    const lastCall = (window.scrollTo as any).mock.calls.at(-1)[0];
    expect(lastCall.top ?? lastCall).toBe(420);
  });
});
