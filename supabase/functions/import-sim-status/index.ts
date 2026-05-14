import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    // Download JSON from storage
    const { data: blob, error: dlErr } = await admin.storage
      .from("sim-import-tmp")
      .download("sim_status.json");
    if (dlErr || !blob) throw new Error("Download failed: " + (dlErr?.message ?? "no data"));
    const json = JSON.parse(await blob.text()) as { Activo: string[]; Pendente: string[] };

    const stats: Record<string, { total: number; matched: number; chunks: number }> = {};
    const CHUNK = 500;
    const nowIso = new Date().toISOString();

    for (const status of ["Activo", "Pendente"] as const) {
      const phones = json[status] || [];
      let matched = 0;
      let chunks = 0;
      for (let i = 0; i < phones.length; i += CHUNK) {
        const slice = phones.slice(i, i + CHUNK);
        const { error, count } = await admin
          .from("farmers")
          .update({
            sim_status: status,
            sim_status_source: "operadora_unitel",
            sim_status_updated_at: nowIso,
          }, { count: "exact" })
          .in("phone", slice);
        if (error) throw new Error(`UPDATE failed (${status}, chunk ${chunks}): ${error.message}`);
        matched += count ?? 0;
        chunks += 1;
      }
      stats[status] = { total: phones.length, matched, chunks };
    }

    // Final counts from DB
    const { data: counts, error: kpiErr } = await admin.rpc("farmers_sim_kpis");
    if (kpiErr) throw new Error("KPI RPC failed: " + kpiErr.message);

    return new Response(JSON.stringify({ ok: true, stats, counts }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
