import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FarmerCard {
  id: string;
  farmer_code: string;
  card_token: string;
  status: string;
  generated_at: string | null;
  generated_by: string | null;
  printed_at: string | null;
  delivered_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface FarmerCardLog {
  id: string;
  farmer_code: string;
  action: string;
  performed_by: string | null;
  details: any;
  created_at: string;
}

export function useFarmerCard(farmerCode: string | undefined) {
  const [card, setCard] = useState<FarmerCard | null>(null);
  const [logs, setLogs] = useState<FarmerCardLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!farmerCode) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase
        .from("farmer_cards")
        .select("*")
        .eq("farmer_code", farmerCode)
        .neq("status", "Revogado")
        .maybeSingle(),
      supabase
        .from("farmer_card_logs")
        .select("*")
        .eq("farmer_code", farmerCode)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([cardRes, logsRes]) => {
      if (cancelled) return;
      setCard((cardRes.data as FarmerCard) ?? null);
      setLogs((logsRes.data as FarmerCardLog[]) ?? []);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [farmerCode, fetchKey]);

  const generateCard = useCallback(async () => {
    if (!farmerCode) return null;
    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id;

    // Check existing
    const { data: existing } = await supabase
      .from("farmer_cards")
      .select("id")
      .eq("farmer_code", farmerCode)
      .neq("status", "Revogado")
      .maybeSingle();

    if (existing) {
      // Update to Gerado
      const { data, error } = await supabase
        .from("farmer_cards")
        .update({ status: "Gerado", generated_at: new Date().toISOString(), generated_by: userId })
        .eq("id", existing.id)
        .select()
        .single();
      if (!error) {
        await supabase.from("farmer_card_logs").insert({
          farmer_code: farmerCode, action: "gerado", performed_by: userId,
        });
      }
      refetch();
      return data as FarmerCard;
    }

    const { data, error } = await supabase
      .from("farmer_cards")
      .insert({
        farmer_code: farmerCode,
        status: "Gerado",
        generated_at: new Date().toISOString(),
        generated_by: userId,
      })
      .select()
      .single();

    if (!error) {
      await supabase.from("farmer_card_logs").insert({
        farmer_code: farmerCode, action: "gerado", performed_by: userId,
      });
    }
    refetch();
    return data as FarmerCard;
  }, [farmerCode, refetch]);

  const updateStatus = useCallback(async (newStatus: string, reason?: string) => {
    if (!card) return;
    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id;

    const updates: any = { status: newStatus };
    if (newStatus === "Impresso") updates.printed_at = new Date().toISOString();
    if (newStatus === "Entregue") updates.delivered_at = new Date().toISOString();
    if (newStatus === "Revogado") {
      updates.revoked_at = new Date().toISOString();
      updates.revoked_reason = reason || null;
    }

    await supabase.from("farmer_cards").update(updates).eq("id", card.id);
    await supabase.from("farmer_card_logs").insert({
      farmer_code: card.farmer_code,
      action: newStatus.toLowerCase(),
      performed_by: userId,
      details: reason ? { reason } : {},
    });
    refetch();
  }, [card, refetch]);

  const regenerateToken = useCallback(async () => {
    if (!card) return;
    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id;

    // Revoke current
    await supabase.from("farmer_cards").update({
      status: "Revogado",
      revoked_at: new Date().toISOString(),
      revoked_reason: "Token regenerado",
    }).eq("id", card.id);

    await supabase.from("farmer_card_logs").insert({
      farmer_code: card.farmer_code, action: "revogado", performed_by: userId,
      details: { reason: "Token regenerado" },
    });

    // Create new
    const { data } = await supabase.from("farmer_cards").insert({
      farmer_code: card.farmer_code,
      status: "Gerado",
      generated_at: new Date().toISOString(),
      generated_by: userId,
    }).select().single();

    await supabase.from("farmer_card_logs").insert({
      farmer_code: card.farmer_code, action: "regenerado", performed_by: userId,
    });

    refetch();
    return data as FarmerCard;
  }, [card, refetch]);

  return { card, logs, loading, generateCard, updateStatus, regenerateToken, refetch };
}
