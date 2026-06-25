// One-shot dataset processor for mosap3-pay-dataset.json
// Protected by x-bulk-secret header.
// Actions: stage-prods, stage-tx, reconcile, apply-balances, apply-missing-farmers, apply-missing-tx, reset-staging
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bulk-secret",
};

const SECRET = "k7Gp2Q9rT4xVbN8zM1cE6sW3yL5jH0aDfU";

function ptao(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "0,00";
  const v = Math.round(Number(n) * 100) / 100;
  const neg = v < 0;
  const abs = Math.abs(v);
  const [intPart, decPartRaw = "0"] = abs.toFixed(2).split(".");
  const dec = decPartRaw.padEnd(2, "0").slice(0, 2);
  let out = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) out += ".";
    out += intPart[i];
  }
  return (neg ? "-" : "") + out + "," + dec;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("x-bulk-secret") !== SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (action === "reset-staging") {
      const { error: e1 } = await supabase.rpc("exec_sql_dummy").select(); // ignore
      await supabase.from("_ds_produtores").delete().neq("produtor_id", "__never__");
      await supabase.from("_ds_transacoes").delete().neq("transacao_id", "__never__");
      return ok({ ok: true });
    }

    if (action === "stage-prods") {
      const rows = body.rows as any[];
      const { error } = await supabase.from("_ds_produtores").upsert(rows, { onConflict: "produtor_id" });
      if (error) throw error;
      return ok({ inserted: rows.length });
    }

    if (action === "stage-tx") {
      const rows = body.rows as any[];
      const { error } = await supabase.from("_ds_transacoes").upsert(rows, { onConflict: "transacao_id" });
      if (error) throw error;
      return ok({ inserted: rows.length });
    }

    if (action === "reconcile") {
      // Counts & diffs via RPC-style queries
      const queries: Record<string, string> = {
        ds_prods: `SELECT count(*)::int AS n FROM public._ds_produtores`,
        ds_tx: `SELECT count(*)::int AS n FROM public._ds_transacoes`,
        farmers_in_db: `SELECT count(*)::int AS n FROM public.farmers`,
        tx_in_db: `SELECT count(*)::int AS n FROM public.farmer_transactions`,
        // produtores em falta na BD
        missing_in_db: `SELECT count(*)::int AS n FROM public._ds_produtores d LEFT JOIN public.farmers f ON f.phone = d.produtor_id WHERE f.code IS NULL`,
        // produtores na BD que não estão no ficheiro
        missing_in_file: `SELECT count(*)::int AS n FROM public.farmers f LEFT JOIN public._ds_produtores d ON d.produtor_id = f.phone WHERE d.produtor_id IS NULL`,
        // produtores com diferença de saldo (>1 Kz)
        balance_diff: `
          SELECT count(*)::int AS n
          FROM public._ds_produtores d
          JOIN public.farmers f ON f.phone = d.produtor_id
          WHERE abs(COALESCE(public.parse_ptao_numeric(f.saldo_final),0) - COALESCE(d.saldo_actual,0)) > 1`,
        gasto_diff: `
          SELECT count(*)::int AS n
          FROM public._ds_produtores d
          JOIN public.farmers f ON f.phone = d.produtor_id
          WHERE abs(COALESCE(public.parse_ptao_numeric(f.total_gasto),0) - COALESCE(d.total_gasto,0)) > 1`,
        // transações em falta (no ficheiro mas não na BD por external_id)
        tx_missing_in_db: `
          SELECT count(*)::int AS n
          FROM public._ds_transacoes t
          LEFT JOIN public.farmer_transactions ft ON ft.external_id = t.transacao_id
          WHERE ft.id IS NULL`,
      };
      const out: any = {};
      for (const [k, q] of Object.entries(queries)) {
        const { data, error } = await supabase.rpc("exec_count_query", { _q: q }).maybeSingle();
        if (error) {
          // fallback: try direct via postgrest by storing into a temp endpoint -- not available, so do manual
          out[k] = { error: error.message };
        } else {
          out[k] = data;
        }
      }
      return ok(out);
    }

    if (action === "apply-balances") {
      // Update farmers from staging in one SQL via RPC
      const { data, error } = await supabase.rpc("apply_dataset_balances");
      if (error) throw error;
      return ok(data);
    }

    if (action === "apply-missing-farmers") {
      const { data, error } = await supabase.rpc("apply_dataset_missing_farmers");
      if (error) throw error;
      return ok(data);
    }

    if (action === "apply-missing-tx") {
      const { data, error } = await supabase.rpc("apply_dataset_missing_tx");
      if (error) throw error;
      return ok(data);
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any).message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function ok(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
