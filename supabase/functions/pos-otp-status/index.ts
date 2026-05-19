// Edge function: return current status of a pos_payment_otps row for frontend polling.
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
    if (!otp_id) return json({ error: "otp_id obrigatório." }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: otp, error } = await admin
      .from("pos_payment_otps")
      .select("id, status, expires_at, attempts, used_at, created_by, supplier_id")
      .eq("id", otp_id)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!otp) return json({ error: "OTP não encontrado." }, 404);

    // Authorization: only the creator (the supplier user) may poll.
    if (otp.created_by && otp.created_by !== user.id) {
      return json({ error: "Sem permissão." }, 403);
    }

    // Auto-expire if past expiry and still pending
    let status = otp.status as string;
    if (status === "pendente" && new Date(otp.expires_at).getTime() < Date.now()) {
      await admin.from("pos_payment_otps").update({ status: "expirado" }).eq("id", otp_id);
      status = "expirado";
    }

    return json({
      success: true,
      otp_id: otp.id,
      status,
      expires_at: otp.expires_at,
      attempts: otp.attempts ?? 0,
      attempts_left: Math.max(0, 5 - (otp.attempts ?? 0)),
      used_at: otp.used_at,
    });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
