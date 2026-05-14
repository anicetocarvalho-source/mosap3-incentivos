// Reconciliation: validates annex phones vs DB phones.
// Returns: matched, unmatched (annex phones with no farmer), db_zero_no_annex (farmers at 0,00 with phone not in annex).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bulk-secret",
};

function normPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00244")) d = d.slice(2);
  if (d.length === 9) d = "244" + d;
  if (d.length !== 12 || !d.startsWith("244")) return null;
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.headers.get("x-bulk-secret") !== "k7Gp2Q9rT4xVbN8zM1cE6sW3yL5jH0aDfU") {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json() as { items: Array<{ phone_raw: string; phone_norm: string; saldo: number; name: string; status: string; province: string }> };
  const annex = body.items ?? [];

  // Pull all farmers (paginated, RLS bypassed)
  const farmers: Array<{ code: string; phone: string | null; full_name: string; valor_recebido: string | null; province: string | null }> = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("farmers")
      .select("code, phone, full_name, valor_recebido, province")
      .range(from, from + pageSize - 1);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    if (!data || data.length === 0) break;
    farmers.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Build phone -> farmers map (DB)
  const dbByPhone = new Map<string, typeof farmers>();
  let dbInvalidPhone = 0;
  for (const f of farmers) {
    const n = normPhone(f.phone);
    if (!n) { dbInvalidPhone++; continue; }
    if (!dbByPhone.has(n)) dbByPhone.set(n, []);
    dbByPhone.get(n)!.push(f);
  }

  // Classify annex items
  const matched: any[] = [];
  const unmatched: any[] = [];
  for (const it of annex) {
    const list = dbByPhone.get(it.phone_norm);
    if (list && list.length > 0) {
      matched.push({
        phone: it.phone_norm,
        annex_name: it.name,
        annex_saldo: it.saldo,
        annex_status: it.status,
        annex_province: it.province,
        db_count: list.length,
        db_codes: list.map(f => f.code).join("|"),
        db_names: list.map(f => f.full_name).join("|"),
        db_valor_recebido: list.map(f => f.valor_recebido ?? "").join("|"),
        db_province: list.map(f => f.province ?? "").join("|"),
      });
    } else {
      unmatched.push({
        phone_raw: it.phone_raw,
        phone_norm: it.phone_norm,
        annex_name: it.name,
        annex_saldo: it.saldo,
        annex_status: it.status,
        annex_province: it.province,
      });
    }
  }

  // DB phones not in annex
  const annexSet = new Set(annex.map(a => a.phone_norm));
  const dbOnly: any[] = [];
  for (const [phone, list] of dbByPhone.entries()) {
    if (!annexSet.has(phone)) {
      for (const f of list) {
        dbOnly.push({ phone, code: f.code, full_name: f.full_name, valor_recebido: f.valor_recebido, province: f.province });
      }
    }
  }

  return new Response(JSON.stringify({
    summary: {
      annex_total: annex.length,
      db_total_farmers: farmers.length,
      db_invalid_phone: dbInvalidPhone,
      db_unique_phones: dbByPhone.size,
      matched: matched.length,
      unmatched: unmatched.length,
      db_only: dbOnly.length,
    },
    matched, unmatched, db_only: dbOnly,
  }), { headers: { ...corsHeaders, "content-type": "application/json" } });
});
