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
    const idempotency_key = body.idempotency_key
      ? String(body.idempotency_key).trim().slice(0, 100)
      : null;

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

    // Idempotência: se a mesma chave já foi usada com sucesso neste OTP,
    // devolvemos o resultado em cache em vez de processar novamente.
    if (
      idempotency_key &&
      otp.idempotency_key === idempotency_key &&
      otp.status === "usado" &&
      otp.last_result
    ) {
      return json({ ...(otp.last_result as Record<string, unknown>), idempotent_replay: true });
    }

    if (otp.status === "usado") {
      // Sem idempotency_key correspondente — é tentativa duplicada legítima.
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

    // Marcação atómica via CAS: só transita pendente→usado se ainda estiver pendente.
    // Isto evita que duas chamadas paralelas (double-click / refresh) ambas “ganhem”.
    const result = { success: true } as Record<string, unknown>;
    const { data: updated, error: updErr } = await admin
      .from("pos_payment_otps")
      .update({
        status: "usado",
        used_at: new Date().toISOString(),
        attempts: (otp.attempts ?? 0) + 1,
        idempotency_key: idempotency_key,
        last_result: result,
      })
      .eq("id", otp_id)
      .eq("status", "pendente")
      .select("id, idempotency_key, last_result")
      .maybeSingle();

    if (updErr) {
      console.error("pos-otp-verify CAS error:", updErr);
      return json({ success: false, error: "Erro ao confirmar OTP." }, 500);
    }

    if (!updated) {
      // Outra requisição concorrente já marcou como 'usado'. Re-lê para devolver
      // resposta consistente (idempotente) se a chave coincidir.
      const { data: fresh } = await admin
        .from("pos_payment_otps")
        .select("status, idempotency_key, last_result")
        .eq("id", otp_id)
        .maybeSingle();
      if (
        fresh?.status === "usado" &&
        idempotency_key &&
        fresh.idempotency_key === idempotency_key &&
        fresh.last_result
      ) {
        return json({ ...(fresh.last_result as Record<string, unknown>), idempotent_replay: true });
      }
      return json({ success: false, error: "Este código já foi usado.", reason: "used" }, 409);
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "otp_verified",
      entity_type: "pos_otp",
      entity_id: otp_id,
      details: { farmer_code: otp.farmer_code, amount: otp.amount, idempotency_key },
    });

    return json(result);
  } catch (e) {
    console.error("pos-otp-verify error:", e);
    return json({ success: false, error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
