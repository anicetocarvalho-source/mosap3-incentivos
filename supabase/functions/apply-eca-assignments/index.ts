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

    // 1) Fetch current school for all involved codes (chunked .in())
    const codes = updates.map((u) => u[0]);
    const codeToCurrent = new Map<string, string | null>();
    for (let i = 0; i < codes.length; i += 500) {
      const chunk = codes.slice(i, i + 500);
      const { data, error } = await supabase
        .from("farmers")
        .select("code, school")
        .in("code", chunk);
      if (error) throw new Error(`select chunk ${i}: ${error.message}`);
      for (const r of data || []) codeToCurrent.set(r.code as string, (r as any).school);
    }

    // 2) Filter to those needing update + group by target eca
    const byEca = new Map<string, string[]>();
    const skipped: { code: string; reason: string }[] = [];
    const applied: { code: string; from: string | null; to: string }[] = [];
    for (const [code, eca] of updates) {
      if (!codeToCurrent.has(code)) { skipped.push({ code, reason: "not_found" }); continue; }
      const cur = codeToCurrent.get(code);
      if (cur && cur.trim() !== "") { skipped.push({ code, reason: "already_has_school" }); continue; }
      if (!byEca.has(eca)) byEca.set(eca, []);
      byEca.get(eca)!.push(code);
      applied.push({ code, from: cur ?? null, to: eca });
    }

    // 3) Bulk update per eca, chunked
    let updated = 0;
    const errors: string[] = [];
    for (const [eca, ecaCodes] of byEca) {
      for (let i = 0; i < ecaCodes.length; i += 500) {
        const chunk = ecaCodes.slice(i, i + 500);
        const { error, count } = await supabase
          .from("farmers")
          .update({ school: eca }, { count: "exact" })
          .in("code", chunk);
        if (error) { errors.push(`${eca} [${i}]: ${error.message}`); continue; }
        updated += count || chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_input: updates.length,
        updated,
        skipped_count: skipped.length,
        errors_count: errors.length,
        errors: errors.slice(0, 20),
        applied,
        skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
