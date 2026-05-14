import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const adminToken = req.headers.get("x-admin-token") || "";
    if (adminToken !== Deno.env.get("BULK_IMPORT_TOKEN")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const rows: Array<{ p: string; e: string }> = body.rows || [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "rows required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Insert in chunks of 1000 into staging
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000).map((r) => ({ phone9: r.p, estado: r.e }));
      const { error } = await supabase.from("_sim_status_staging").upsert(chunk, { onConflict: "phone9" });
      if (error) throw new Error(`staging upsert: ${error.message}`);
      inserted += chunk.length;
    }

    // Run the SQL UPDATE join via RPC
    const { data: updated, error: rpcErr } = await supabase.rpc("apply_sim_status_from_staging");
    if (rpcErr) throw new Error(`rpc: ${rpcErr.message}`);

    return new Response(JSON.stringify({ ok: true, staged: inserted, matched: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
