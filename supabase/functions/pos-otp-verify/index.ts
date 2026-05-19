// Edge function: verify OTP submitted by supplier on behalf of farmer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    if (!otp_id || !/^\d{6}$/.test(code)) {
      return json({ success: false, error: "Código OTP inválido.", reason: "invalid_input" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: otp, error: selErr } = await admin
      .from("pos_payment_otps")
      .select("*")
      .eq("id", otp_id)
      .maybeSingle();

    if (selErr || !otp) {
      return json({ success: false, error: "OTP não encontrado.", reason: "not_found" }, 404);
    }

    if (otp.status === "usado") {
      return json({ success: false, error: "Este código já foi usado.", reason: "used" }, 400);
    }
    if (otp.status === "falhado") {
      return json({ success: false, error: "Demasiadas tentativas. Solicite um novo código.", reason: "locked" }, 400);
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await admin.from("pos_payment_otps").update({ status: "expirado" }).eq("id", otp_id);
      return json({ success: false, error: "Código expirado. Solicite um novo.", reason: "expired" }, 400);
    }
    if ((otp.attempts ?? 0) >= 5) {
      await admin.from("pos_payment_otps").update({ status: "falhado" }).eq("id", otp_id);
      return json({ success: false, error: "Demasiadas tentativas. Solicite um novo código.", reason: "locked" }, 400);
    }

    const hash = await sha256(code);
    if (hash !== otp.code_hash) {
      const newAttempts = (otp.attempts ?? 0) + 1;
      const newStatus = newAttempts >= 5 ? "falhado" : "pendente";
      await admin
        .from("pos_payment_otps")
        .update({ attempts: newAttempts, status: newStatus })
        .eq("id", otp_id);
      return json({
        success: false,
        error: "Código incorrecto.",
        reason: newStatus === "falhado" ? "locked" : "invalid",
        attempts_left: Math.max(0, 5 - newAttempts),
      }, 400);
    }

    await admin
      .from("pos_payment_otps")
      .update({ status: "usado", used_at: new Date().toISOString(), attempts: (otp.attempts ?? 0) + 1 })
      .eq("id", otp_id);

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "otp_verified",
      entity_type: "pos_otp",
      entity_id: otp_id,
      details: { farmer_code: otp.farmer_code, amount: otp.amount },
    });

    return json({ success: true });
  } catch (e) {
    console.error("pos-otp-verify error:", e);
    return json({ success: false, error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
