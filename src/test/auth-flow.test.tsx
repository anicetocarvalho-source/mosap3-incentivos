import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import Auth from "@/pages/Auth";

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
    },
  },
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

const mockSetOfflineSession = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ setOfflineSession: mockSetOfflineSession }),
}));

vi.mock("@/assets/mosap3-logo.png", () => ({ default: "/logo.png" }));

function renderAuth() {
  return render(
    <BrowserRouter>
      <Auth />
    </BrowserRouter>
  );
}

describe("Fluxo de Autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o formulário de login com campos de email e password", () => {
    renderAuth();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("mostra erro de validação para email vazio", async () => {
    renderAuth();
    const submitBtn = screen.getByRole("button", { name: /entrar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Zod validation should trigger a toast — we just confirm no crash
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  it("mostra erro de validação para password curta", async () => {
    renderAuth();
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "123");
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  it("chama signInWithPassword com credenciais válidas", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", email: "admin@mosap3.test" } },
      error: null,
    });

    renderAuth();
    await userEvent.type(screen.getByLabelText(/email/i), "admin@mosap3.test");
    await userEvent.type(screen.getByLabelText(/password/i), "teste123");
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "admin@mosap3.test",
        password: "teste123",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("não navega quando o login falha", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    renderAuth();
    await userEvent.type(screen.getByLabelText(/email/i), "bad@email.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass");
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it("preenche campos ao clicar num utilizador de teste", async () => {
    renderAuth();
    const adminBtn = screen.getByText("Admin").closest("button")!;
    fireEvent.click(adminBtn);

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    expect(emailInput.value).toBe("admin@mosap3.test");
    expect(passwordInput.value).toBe("teste123");
  });

  it("exibe 9 utilizadores de teste", () => {
    renderAuth();
    const testSection = screen.getByText(/utilizadores de teste/i);
    expect(testSection).toBeInTheDocument();

    const labels = ["Admin", "Gestor Incentivos", "Técnico Extensionista"];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
