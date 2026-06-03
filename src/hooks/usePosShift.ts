import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PosShiftSession {
  shift_id: string;
  seller_id: string;
  seller_name: string;
  username: string;
  pos_id: string | null;
  opened_at: string;
}

const STORAGE_KEY = "mosap3pay.pos_shift.v1";
const MAX_AGE_HOURS = 12;

function read(supplierId: string): PosShiftSession | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY}:${supplierId}`);
    if (!raw) return null;
    const s = JSON.parse(raw) as PosShiftSession;
    const ageH = (Date.now() - new Date(s.opened_at).getTime()) / 36e5;
    if (ageH > MAX_AGE_HOURS) {
      sessionStorage.removeItem(`${STORAGE_KEY}:${supplierId}`);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function usePosShift(supplierId: string | undefined) {
  const [shift, setShift] = useState<PosShiftSession | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    setShift(read(supplierId));
  }, [supplierId]);

  const save = useCallback((s: PosShiftSession | null) => {
    if (!supplierId) return;
    if (s) sessionStorage.setItem(`${STORAGE_KEY}:${supplierId}`, JSON.stringify(s));
    else sessionStorage.removeItem(`${STORAGE_KEY}:${supplierId}`);
    setShift(s);
  }, [supplierId]);

  const open = useCallback(async (params: {
    username: string; pin: string; pos_id: string | null;
  }) => {
    if (!supplierId) throw new Error("Fornecedor não definido");
    const { data: loginData, error: loginErr } = await supabase.rpc("supplier_seller_login", {
      _supplier_id: supplierId,
      _username: params.username,
      _pin: params.pin,
    });
    if (loginErr) throw loginErr;
    const row = Array.isArray(loginData) ? loginData[0] : loginData;
    if (!row) throw new Error("Credenciais inválidas");

    const { data: shiftData, error: shiftErr } = await supabase.rpc("open_pos_shift", {
      _seller_id: row.seller_id,
      _pos_id: params.pos_id,
      _opening_note: null,
    });
    if (shiftErr) throw shiftErr;
    const sh = Array.isArray(shiftData) ? shiftData[0] : shiftData;

    const sess: PosShiftSession = {
      shift_id: sh.id,
      seller_id: row.seller_id,
      seller_name: row.full_name,
      username: row.username,
      pos_id: params.pos_id,
      opened_at: sh.opened_at,
    };
    save(sess);
    return sess;
  }, [supplierId, save]);

  const close = useCallback(async (note?: string) => {
    if (!shift) return;
    const { error } = await supabase.rpc("close_pos_shift", {
      _shift_id: shift.shift_id,
      _closing_note: note ?? null,
    });
    if (error) throw error;
    save(null);
  }, [shift, save]);

  return { shift, open, close, clear: () => save(null) };
}
