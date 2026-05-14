// One-shot admin endpoint to bulk-update farmers.valor_recebido from Unitel annex.
// Uses service role to bypass RLS. Protected by a shared secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bulk-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const provided = req.headers.get("x-bulk-secret") ?? "";
  const expected = Deno.env.get("BULK_UPDATE_SECRET") ?? "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json() as { items: Array<{ phone: string; amt: string }> };
  const items = body.items ?? [];

  // Bulk update via single SQL using a temp table approach: run in chunks of 1000.
  let updated = 0;
  const chunkSize = 1000;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const phones = chunk.map((x) => x.phone);
    const amts = chunk.map((x) => x.amt);
    // Use a SQL RPC-like approach with rpc isn't trivial; do per-amount grouping
    // Group by amount within chunk
    const byAmt = new Map<string, string[]>();
    for (const it of chunk) {
      if (!byAmt.has(it.amt)) byAmt.set(it.amt, []);
      byAmt.get(it.amt)!.push(it.phone);
    }
    for (const [amt, ph] of byAmt.entries()) {
      const { error, count } = await supabase
        .from("farmers")
        .update({ valor_recebido: amt, updated_at: new Date().toISOString() }, { count: "exact" })
        .eq("valor_recebido", "0,00")
        .in("phone", ph);
      if (error) {
        return new Response(JSON.stringify({ error: error.message, at: i }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
      }
      updated += count ?? 0;
    }
  }

  return new Response(JSON.stringify({ ok: true, received: items.length, updated }), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
