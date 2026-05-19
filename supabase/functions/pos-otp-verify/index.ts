// Edge function: verify OTP submitted by supplier on behalf of farmer.
// Business logic lives in ./verify-logic.ts and is covered by verify-logic.test.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyOtp, type OtpRow, type OtpStore } from "./verify-logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const otp_id = String(body.otp_id || "").trim();
    const code = String(body.code || "").trim();
    const idempotency_key = body.idempotency_key
      ? String(body.idempotency_key).trim().slice(0, 100)
      : null;

    const admin = createClient(supabaseUrl, serviceKey);

    // Best-effort cleanup of stale idempotency rows.
    admin.rpc("cleanup_pos_otp_idempotency", { p_max: 100 }).then(
      ({ error }) => { if (error) console.warn("cleanup_pos_otp_idempotency:", error.message); },
    );

    const store: OtpStore = {
      async get(id) {
        const { data, error } = await admin
          .from("pos_payment_otps")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return (data as OtpRow | null) ?? null;
      },
      async casPendingToUsed(id, patch) {
        const { data, error } = await admin
          .from("pos_payment_otps")
          .update(patch)
          .eq("id", id)
          .eq("status", "pendente")
          .select("*")
          .maybeSingle();
        if (error) throw error;
        return (data as OtpRow | null) ?? null;
      },
      async update(id, patch) {
        const { error } = await admin
          .from("pos_payment_otps")
          .update(patch)
          .eq("id", id);
        if (error) throw error;
      },
    };

    const result = await verifyOtp(store, { otp_id, code, idempotency_key });

    // Audit only on first successful (non-replay) consumption.
    if (result.status === 200 && result.body.success === true && !result.body.idempotent_replay) {
      const otpForAudit = await store.get(otp_id).catch(() => null);
      await admin.from("audit_logs").insert({
        user_id: user.id,
        action: "otp_verified",
        entity_type: "pos_otp",
        entity_id: otp_id,
        details: {
          farmer_code: otpForAudit?.farmer_code,
          amount: otpForAudit?.amount,
          idempotency_key,
        },
      });
    }

    return json(result.body, result.status);
  } catch (e) {
    console.error("pos-otp-verify error:", e);
    return json({ success: false, error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
