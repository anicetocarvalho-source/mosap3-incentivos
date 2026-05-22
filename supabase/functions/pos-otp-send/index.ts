// Edge function: generate OTP, store hash, send via SMS gateway (Unitel) to farmer phone.
// When SMS_GATEWAY_ENABLED!="true" or required env vars missing, OTP is returned to the
// supplier UI (dev_code) for in-person handoff (DEV / preview mode only).
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

    // Supersede ALL pending OTPs for this farmer (resend invalidates the previous code).
    // Verify endpoint will return 409 'superseded' if the old code is submitted afterwards.
    await admin
      .from("pos_payment_otps")
      .update({ status: "expirado" })
      .eq("farmer_code", farmer_code)
      .eq("status", "pendente");

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

    // SMS gateway (Unitel / 3rd party). Generic JSON POST with Bearer auth.
    // Env vars expected when SMS_GATEWAY_ENABLED=true:
    //   SMS_GATEWAY_URL    - full POST endpoint
    //   SMS_GATEWAY_TOKEN  - Bearer token
    //   SMS_SENDER_ID      - sender name/shortcode (optional)
    const SMS_ENABLED = Deno.env.get("SMS_GATEWAY_ENABLED") === "true";
    const SMS_URL = Deno.env.get("SMS_GATEWAY_URL") || "";
    const SMS_TOKEN = Deno.env.get("SMS_GATEWAY_TOKEN") || "";
    const SMS_SENDER = Deno.env.get("SMS_SENDER_ID") || "MOSAP3";

    let sms_sent = false;
    let sms_error: string | null = null;

    if (SMS_ENABLED && SMS_URL && SMS_TOKEN) {
      try {
        const text = `MOSAP3: o seu código é ${code}. Válido 5 min. Não partilhe.`;
        const resp = await fetch(SMS_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SMS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ to: phone, message: text, from: SMS_SENDER }),
        });
        sms_sent = resp.ok;
        if (!resp.ok) sms_error = `gateway ${resp.status}`;
      } catch (e) {
        sms_error = (e as Error)?.message || "gateway error";
      }
      if (sms_error) console.error("SMS gateway error:", sms_error);
    }

    return json({
      success: true,
      otp_id: inserted.id,
      expires_at: inserted.expires_at,
      masked_phone: maskPhone(phone),
      sms_sent,
      // Only expose dev_code when SMS gateway is not active (DEV / pilot mode).
      dev_code: SMS_ENABLED && sms_sent ? undefined : code,
    });
  } catch (e) {
    console.error("pos-otp-send error:", e);
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
