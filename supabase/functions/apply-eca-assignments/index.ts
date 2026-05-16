import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const updates = body.updates as [string, string][];
    if (!Array.isArray(updates)) {
      return new Response(JSON.stringify({ error: "updates array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let updated = 0, skipped = 0, errors: string[] = [];
    // Process one-by-one with guard (only update if school empty)
    for (const [code, eca] of updates) {
      const { data: cur, error: selErr } = await supabase
        .from("farmers").select("school").eq("code", code).maybeSingle();
      if (selErr) { errors.push(`${code}: ${selErr.message}`); continue; }
      if (!cur) { skipped++; continue; }
      if (cur.school && cur.school.trim() !== "") { skipped++; continue; }
      const { error: upErr } = await supabase
        .from("farmers").update({ school: eca }).eq("code", code);
      if (upErr) { errors.push(`${code}: ${upErr.message}`); continue; }
      updated++;
    }

    return new Response(
      JSON.stringify({ ok: true, updated, skipped, errors_count: errors.length, errors: errors.slice(0, 20) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
