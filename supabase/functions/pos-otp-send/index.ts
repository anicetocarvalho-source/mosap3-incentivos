// Edge function: generate OTP, store hash, "send" to farmer phone.
// Phase 1: SMS gateway not wired — OTP is returned to the supplier UI (dev_code) for in-person handoff.
// When a real SMS gateway is configured, drop dev_code and call the gateway here.
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

function maskPhone(p: string): string {
  const clean = (p || "").replace(/\s+/g, "");
  if (clean.length < 4) return "•••";
  return clean.slice(0, -4).replace(/\d/g, "•") + clean.slice(-4);
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
    const supplier_id = String(body.supplier_id || "").trim();
    const farmer_code = String(body.farmer_code || "").trim();
    const phone = String(body.phone || "").trim();
    const amount = Number(body.amount || 0);

    if (!supplier_id || !farmer_code || !phone) {
      return json({ error: "Parâmetros obrigatórios em falta." }, 400);
    }
    if (!/^[0-9+\s\-()]{6,20}$/.test(phone)) {
      return json({ error: "Telefone inválido." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Rate-limit: max 3 active OTPs in last 2 min for this farmer
    const sinceIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: recent } = await admin
      .from("pos_payment_otps")
      .select("id", { count: "exact", head: true })
      .eq("farmer_code", farmer_code)
      .gte("created_at", sinceIso);
    if ((recent ?? 0) >= 3) {
      return json({ error: "Demasiados pedidos recentes. Aguarde alguns minutos." }, 429);
    }

    // Expire stale pending OTPs for this farmer
    await admin
      .from("pos_payment_otps")
      .update({ status: "expirado" })
      .eq("farmer_code", farmer_code)
      .eq("status", "pendente")
      .lt("expires_at", new Date().toISOString());

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const code_hash = await sha256(code);
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: inserted, error: insErr } = await admin
      .from("pos_payment_otps")
      .insert({
        supplier_id,
        farmer_code,
        phone,
        code_hash,
        amount,
        expires_at,
        created_by: user.id,
      })
      .select("id, expires_at")
      .single();

    if (insErr) {
      console.error("Insert OTP failed:", insErr);
      return json({ error: "Não foi possível gerar o OTP." }, 500);
    }

    // Audit
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "otp_sent",
      entity_type: "pos_otp",
      entity_id: inserted.id,
      details: { farmer_code, phone: maskPhone(phone), amount },
    });

    // TODO: integrar gateway SMS (Unitel/3rd party). Por agora devolvemos o código ao fornecedor
    // para entrega presencial ao agricultor durante o atendimento (modo dev).
    const SMS_ENABLED = Deno.env.get("SMS_GATEWAY_ENABLED") === "true";

    return json({
      success: true,
      otp_id: inserted.id,
      expires_at: inserted.expires_at,
      masked_phone: maskPhone(phone),
      sms_sent: SMS_ENABLED,
      dev_code: SMS_ENABLED ? undefined : code,
    });
  } catch (e) {
    console.error("pos-otp-send error:", e);
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
