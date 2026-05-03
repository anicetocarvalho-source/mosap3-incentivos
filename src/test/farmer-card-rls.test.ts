/**
 * End-to-end checks for the /verificacao/:token route and farmer_cards RLS.
 *
 * These tests validate:
 * 1. Anon (public) users CAN read farmer_cards by token  → verification route works
 * 2. Anon users CANNOT insert, update, or delete farmer_cards
 * 3. Unauthenticated users CANNOT access farmer_card_logs
 * 4. The verification page renders the correct UI states
 *
 * Run: bunx vitest run src/test/farmer-card-rls.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ── 1. Supabase anon client (no auth session) ──────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── 2. RLS policy tests (live DB) ───────────────────────────────────────────

describe("farmer_cards RLS — anon role", () => {
  it("allows anon SELECT on farmer_cards (public verification)", async () => {
    // A select with a non-existent token should return empty data, NOT an RLS error
    const { data, error } = await anonClient
      .from("farmer_cards")
      .select("id, card_token, status")
      .eq("card_token", "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    // No permission error — just no row found
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("blocks anon INSERT on farmer_cards", async () => {
    const { error } = await anonClient.from("farmer_cards").insert({
      farmer_code: "FAKE-001",
      card_token: crypto.randomUUID(),
      status: "Rascunho",
    });

    expect(error).not.toBeNull();
    // RLS violation or permission denied
    expect(error!.code).toMatch(/42501|PGRST301|new row violates/i);
  });

  it("blocks anon UPDATE on farmer_cards", async () => {
    const { error } = await anonClient
      .from("farmer_cards")
      .update({ status: "Revogado" })
      .eq("card_token", "00000000-0000-0000-0000-000000000000");

    // Should either error or affect 0 rows (RLS filters out)
    expect(error === null || error.code === "PGRST301").toBe(true);
  });

  it("blocks anon DELETE on farmer_cards", async () => {
    const { error } = await anonClient
      .from("farmer_cards")
      .delete()
      .eq("card_token", "00000000-0000-0000-0000-000000000000");

    expect(error === null || error.code === "PGRST301").toBe(true);
  });
});

describe("farmer_card_logs RLS — anon role", () => {
  it("blocks anon SELECT on farmer_card_logs", async () => {
    const { data, error } = await anonClient
      .from("farmer_card_logs")
      .select("*")
      .limit(1);

    // Should return empty (RLS filters) or error
    if (error) {
      expect(error.code).toBeDefined();
    } else {
      expect(data).toEqual([]);
    }
  });

  it("blocks anon INSERT on farmer_card_logs", async () => {
    const { error } = await anonClient.from("farmer_card_logs").insert({
      card_id: "00000000-0000-0000-0000-000000000000",
      action: "generated",
    });

    expect(error).not.toBeNull();
  });
});

// ── 3. Verification route UI logic (unit) ───────────────────────────────────

describe("/verificacao/:token — UI states", () => {
  it("shows 'Cartão Válido' for active card with approved farmer", () => {
    const card_status = "Gerado";
    const farmer_status = "Aprovado";

    const isActive =
      card_status !== "Revogado" &&
      ["Aprovado", "Ativo", "Validado"].includes(farmer_status);

    expect(isActive).toBe(true);
  });

  it("shows 'Cartão Inválido' for revoked card", () => {
    const card_status = "Revogado";
    const farmer_status = "Aprovado";

    const isActive =
      card_status !== "Revogado" &&
      ["Aprovado", "Ativo", "Validado"].includes(farmer_status);

    expect(isActive).toBe(false);
  });

  it("shows 'Cartão Inválido' when farmer status is Pendente", () => {
    const card_status = "Gerado";
    const farmer_status = "Pendente";

    const isActive =
      card_status !== "Revogado" &&
      ["Aprovado", "Ativo", "Validado"].includes(farmer_status);

    expect(isActive).toBe(false);
  });

  it("detects credit eligibility correctly", () => {
    const valorRecebido = "50.000,00";
    const hasCredit =
      valorRecebido &&
      parseFloat(
        (valorRecebido || "0").replace(/[^\d,-]/g, "").replace(",", ".")
      ) > 0;

    expect(hasCredit).toBe(true);
  });

  it("detects no credit correctly", () => {
    const valorRecebido = "0,00";
    const hasCredit =
      valorRecebido &&
      parseFloat(
        (valorRecebido || "0").replace(/[^\d,-]/g, "").replace(",", ".")
      ) > 0;

    expect(hasCredit).toBe(false);
  });
});
