import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // ── PAIR: Android app sends session_code to pair ──
    if (req.method === "POST" && action === "pair") {
      const { session_code, device_info } = await req.json();
      if (!session_code || typeof session_code !== "string")
        return json({ error: "session_code obrigatório" }, 400);

      const { data: session, error: findErr } = await sb
        .from("device_sessions")
        .select("*")
        .eq("session_code", session_code.toUpperCase())
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (findErr) return json({ error: findErr.message }, 500);
      if (!session) return json({ error: "Sessão não encontrada ou expirada" }, 404);

      const { error: upErr } = await sb
        .from("device_sessions")
        .update({ status: "paired", metadata: { ...session.metadata, device_info } })
        .eq("id", session.id);

      if (upErr) return json({ error: upErr.message }, 500);
      return json({ ok: true, session_id: session.id, device_type: session.device_type });
    }

    // ── CAPTURE: Android app sends captured data ──
    if (req.method === "POST" && action === "capture") {
      const { session_id, capture_type, data, finger_position, quality_score, metadata } =
        await req.json();

      if (!session_id || !capture_type || !data)
        return json({ error: "session_id, capture_type, data obrigatórios" }, 400);

      // Validate session
      const { data: session, error: sErr } = await sb
        .from("device_sessions")
        .select("*")
        .eq("id", session_id)
        .in("status", ["paired", "active"])
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (sErr) return json({ error: sErr.message }, 500);
      if (!session) return json({ error: "Sessão inválida ou expirada" }, 404);

      // Mark active if first capture
      if (session.status === "paired") {
        await sb.from("device_sessions").update({ status: "active" }).eq("id", session.id);
      }

      const { data: capture, error: cErr } = await sb
        .from("device_captures")
        .insert({
          session_id,
          capture_type,
          data,
          finger_position: finger_position || null,
          quality_score: quality_score || null,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (cErr) return json({ error: cErr.message }, 500);
      return json({ ok: true, capture_id: capture.id });
    }

    // ── STATUS: check session status ──
    if (req.method === "GET" && action === "status") {
      const code = url.searchParams.get("session_code");
      if (!code) return json({ error: "session_code obrigatório" }, 400);

      const { data: session } = await sb
        .from("device_sessions")
        .select("id, status, device_type, metadata, expires_at")
        .eq("session_code", code.toUpperCase())
        .maybeSingle();

      if (!session) return json({ error: "Sessão não encontrada" }, 404);
      return json(session);
    }

    // ── CLOSE: close session ──
    if (req.method === "POST" && action === "close") {
      const { session_id } = await req.json();
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      await sb.from("device_sessions").update({ status: "closed" }).eq("id", session_id);
      return json({ ok: true });
    }

    return json({ error: "Acção inválida. Use: pair, capture, status, close" }, 400);
  } catch (e) {
    return json({ error: e.message || "Erro interno" }, 500);
  }
});
