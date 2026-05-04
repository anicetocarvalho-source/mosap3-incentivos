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
        .update({
          status: "paired",
          metadata: {
            ...session.metadata,
            device_info,
            sdk_workflow: {
              device_found: false,
              device_opened: false,
              capture_ready: false,
            },
          },
        })
        .eq("id", session.id);

      if (upErr) return json({ error: upErr.message }, 500);

      return json({
        ok: true,
        session_id: session.id,
        device_type: session.device_type,
        farmer_code: session.farmer_code,
        // SDK workflow instructions for Android companion
        sdk_instructions: {
          workflow: "G2010_ISO",
          steps: [
            { step: 1, api: "LIVESCAN_Find", description: "Request USB permission" },
            { step: 2, api: "LIVESCAN_Init", description: "Initialize device" },
            { step: 3, api: "LIVESCAN_PrepareCapture", description: "Wake device for capture" },
            { step: 4, api: "LIVESCAN_GetFPRawData", description: "Get raw fingerprint image (256x360)" },
            { step: 5, api: "LIVESCAN_CAPTUREMPLATE", description: "Extract ISO template (498 bytes)" },
            { step: 6, api: "LIVESCAN_EndCapture", description: "End capture" },
          ],
          capture_endpoint: `?action=capture`,
          sdk_status_endpoint: `?action=sdk_status`,
          verify_endpoint: `?action=verify`,
          template_format: "ISO_FMR_19794_2_2005",
          template_max_size: 498,
          raw_image_size: { width: 256, height: 360 },
          match_score_range: { min: 580, max: 2000, threshold: 580 },
        },
      });
    }

    // ── SDK_STATUS: Android reports SDK workflow progress ──
    if (req.method === "POST" && action === "sdk_status") {
      const { session_id, sdk_step, status: sdkStatus, error_code, error_info } = await req.json();
      if (!session_id || !sdk_step)
        return json({ error: "session_id, sdk_step obrigatórios" }, 400);

      const { data: session, error: sErr } = await sb
        .from("device_sessions")
        .select("*")
        .eq("id", session_id)
        .in("status", ["paired", "active"])
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (sErr) return json({ error: sErr.message }, 500);
      if (!session) return json({ error: "Sessão inválida ou expirada" }, 404);

      const currentMeta = (session.metadata as Record<string, unknown>) || {};
      const sdkWorkflow = (currentMeta.sdk_workflow as Record<string, unknown>) || {};

      const updatedWorkflow = {
        ...sdkWorkflow,
        [`step_${sdk_step}`]: {
          status: sdkStatus,
          error_code: error_code || null,
          error_info: error_info || null,
          timestamp: new Date().toISOString(),
        },
        last_step: sdk_step,
        last_status: sdkStatus,
      };

      // Map SDK steps to workflow flags
      if (sdk_step === "LIVESCAN_Find" && sdkStatus === "success") updatedWorkflow.device_found = true;
      if (sdk_step === "LIVESCAN_Init" && sdkStatus === "success") updatedWorkflow.device_opened = true;
      if (sdk_step === "LIVESCAN_PrepareCapture" && sdkStatus === "success") updatedWorkflow.capture_ready = true;

      await sb
        .from("device_sessions")
        .update({
          status: "active",
          metadata: { ...currentMeta, sdk_workflow: updatedWorkflow },
        })
        .eq("id", session.id);

      return json({ ok: true, workflow: updatedWorkflow });
    }

    // ── CAPTURE: Android app sends captured data ──
    if (req.method === "POST" && action === "capture") {
      const {
        session_id, capture_type, data, finger_position,
        quality_score, metadata: capMeta,
      } = await req.json();

      if (!session_id || !capture_type || !data)
        return json({ error: "session_id, capture_type, data obrigatórios" }, 400);

      const validTypes = [
        "fingerprint_template", "fingerprint_image",
        "nfc_uid", "nfc_ndef",
      ];
      if (!validTypes.includes(capture_type))
        return json({ error: `capture_type inválido. Aceites: ${validTypes.join(", ")}` }, 400);

      // Validate ISO template size
      if (capture_type === "fingerprint_template") {
        const decoded = atob(data);
        if (decoded.length > 498)
          return json({ error: "Template ISO excede 498 bytes" }, 400);
      }

      const { data: session, error: sErr } = await sb
        .from("device_sessions")
        .select("*")
        .eq("id", session_id)
        .in("status", ["paired", "active"])
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (sErr) return json({ error: sErr.message }, 500);
      if (!session) return json({ error: "Sessão inválida ou expirada" }, 404);

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
          metadata: capMeta || {},
        })
        .select()
        .single();

      if (cErr) return json({ error: cErr.message }, 500);

      // Auto-enroll template if farmer_code is set
      if (capture_type === "fingerprint_template" && session.farmer_code && finger_position) {
        // Deactivate previous template for same finger
        await sb
          .from("farmer_fingerprints")
          .update({ is_active: false })
          .eq("farmer_code", session.farmer_code)
          .eq("finger_position", finger_position)
          .eq("is_active", true);

        await sb.from("farmer_fingerprints").insert({
          farmer_code: session.farmer_code,
          finger_position,
          template_iso: data,
          quality_score: quality_score || null,
          device_session_id: session.id,
          enrolled_by: session.user_id,
        });
      }

      // Auto-link NFC tag if farmer_code is set
      let nfcLinked = false;
      if (capture_type === "nfc_uid" && session.farmer_code) {
        // Deactivate previous with same UID
        await sb
          .from("farmer_nfc_tags")
          .update({ is_active: false })
          .eq("nfc_uid", data)
          .eq("is_active", true);

        const { error: nfcErr } = await sb.from("farmer_nfc_tags").insert({
          farmer_code: session.farmer_code,
          nfc_uid: data,
          nfc_type: capMeta?.nfc_type || "unknown",
          device_session_id: session.id,
          linked_by: session.user_id,
        });
        nfcLinked = !nfcErr;
      }

      return json({
        ok: true,
        capture_id: capture.id,
        enrolled: !!(session.farmer_code && capture_type === "fingerprint_template"),
        nfc_linked: nfcLinked,
      });
    }

    // ── VERIFY: Compare template against enrolled fingerprints ──
    if (req.method === "POST" && action === "verify") {
      const {
        session_id, farmer_code, template_iso, match_score,
        finger_position,
      } = await req.json();

      if (!farmer_code || !finger_position || match_score === undefined)
        return json({ error: "farmer_code, finger_position e match_score obrigatórios" }, 400);

      const validFingers = [
        "polegar_dir", "indicador_dir", "medio_dir", "anelar_dir",
        "polegar_esq", "indicador_esq", "medio_esq", "anelar_esq",
      ];
      if (!validFingers.includes(finger_position))
        return json({ error: `finger_position inválido. Aceites: ${validFingers.join(", ")}` }, 400);

      // Fetch the enrolled template for the exact finger position
      const { data: enrolledFp, error: fpErr } = await sb
        .from("farmer_fingerprints")
        .select("id, finger_position, template_iso, quality_score")
        .eq("farmer_code", farmer_code)
        .eq("finger_position", finger_position)
        .eq("is_active", true)
        .maybeSingle();

      if (fpErr) return json({ error: fpErr.message }, 500);
      if (!enrolledFp)
        return json({ error: `Nenhum template registado para ${finger_position} deste agricultor` }, 404);

      const threshold = 580;
      const matchResult = match_score >= threshold ? "match" : "no_match";

      // Determine verified_by from session if available
      let verifiedBy: string | null = null;
      if (session_id) {
        const { data: session } = await sb
          .from("device_sessions")
          .select("user_id")
          .eq("id", session_id)
          .maybeSingle();
        verifiedBy = session?.user_id || null;
      }

      const { data: verification, error: vErr } = await sb
        .from("fingerprint_verifications")
        .insert({
          farmer_code,
          finger_position,
          match_score,
          match_result: matchResult,
          verified_by: verifiedBy,
          device_session_id: session_id || null,
          metadata: {
            template_provided: !!template_iso,
            enrolled_fingerprint_id: enrolledFp.id,
            enrolled_quality_score: enrolledFp.quality_score,
            threshold,
            timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (vErr) return json({ error: vErr.message }, 500);

      return json({
        ok: true,
        verification_id: verification.id,
        match_result: matchResult,
        match_score,
        threshold,
        is_verified: matchResult === "match",
        enrolled_fingerprint_id: enrolledFp.id,
        finger_position,
      });
    }

    // ── ENROLLED: Get enrolled fingerprints for a farmer ──
    if (req.method === "GET" && action === "enrolled") {
      const farmerCode = url.searchParams.get("farmer_code");
      if (!farmerCode) return json({ error: "farmer_code obrigatório" }, 400);

      const { data: fps, error: fpErr } = await sb
        .from("farmer_fingerprints")
        .select("id, finger_position, quality_score, is_active, created_at")
        .eq("farmer_code", farmerCode)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (fpErr) return json({ error: fpErr.message }, 500);
      return json({ fingerprints: fps || [], count: fps?.length || 0 });
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

    return json({
      error: "Acção inválida. Use: pair, capture, sdk_status, verify, enrolled, status, close",
    }, 400);
  } catch (e) {
    return json({ error: e.message || "Erro interno" }, 500);
  }
});
