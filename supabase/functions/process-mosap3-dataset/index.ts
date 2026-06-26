// Staging-only endpoint for mosap3-pay dataset. Reconciliation/apply done via SQL functions.
// Protected by x-bulk-secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bulk-secret",
};
const SECRET = "k7Gp2Q9rT4xVbN8zM1cE6sW3yL5jH0aDfU";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("x-bulk-secret") !== SECRET) {
    return j({ error: "unauthorized" }, 401);
  }
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (action === "reset") {
      await supabase.from("_ds_produtores").delete().neq("produtor_id", "__x__");
      await supabase.from("_ds_transacoes").delete().neq("transacao_id", "__x__");
      return j({ ok: true });
    }
    if (action === "stage-prods") {
      const rows = body.rows as any[];
      if (!Array.isArray(rows)) return j({ error: "rows required" }, 400);
      const { error } = await supabase.from("_ds_produtores").upsert(rows, { onConflict: "produtor_id" });
      if (error) throw error;
      return j({ inserted: rows.length });
    }
    if (action === "stage-tx") {
      const rows = body.rows as any[];
      if (!Array.isArray(rows)) return j({ error: "rows required" }, 400);
      const { error } = await supabase.from("_ds_transacoes").upsert(rows, { onConflict: "transacao_id" });
      if (error) throw error;
      return j({ inserted: rows.length });
    }
    if (action === "counts") {
      const p = await supabase.from("_ds_produtores").select("*", { count: "exact", head: true });
      const t = await supabase.from("_ds_transacoes").select("*", { count: "exact", head: true });
      return j({ produtores: p.count, transacoes: t.count });
    }
    if (action === "apply") {
      const fn = body.fn as string;
      const allowed = ["apply_dataset_missing_farmers", "apply_dataset_balances", "apply_dataset_missing_tx", "cleanup_dataset_staging", "undo_dataset_tx_insert", "backfill_dataset_tx_external_id"];
      if (!allowed.includes(fn)) return j({ error: "fn not allowed" }, 400);
      const { data, error } = await supabase.rpc(fn);
      if (error) throw error;
      return j({ ok: true, result: data });
    }
    return j({ error: "unknown action" }, 400);
  } catch (e) {
    return j({ error: String((e as any)?.message || e) }, 500);
  }
});

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
