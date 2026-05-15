// Aplica correcções resultantes da reconciliação Excel↔BD.
// Body: { rows: [{phone,recebido,gasto,n,nome,prov,muni,ecas}], applyRecebido, applyGasto, insertOrphans }
// Sobrescreve valor_recebido, total_gasto (formato PT-AO via to_char no servidor),
// e insere telefones órfãos. Telefones partilhados são ignorados (anomalia auto-detectada).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOL = 1;
function normPhone(p: any): string {
  if (!p) return "";
  let s = String(p).replace(/[^0-9]/g, "");
  if (s.startsWith("244")) s = s.slice(3);
  return s;
}
function fmtPtAo(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const intPart = Math.floor(abs).toString();
  const dec = (abs - Math.floor(abs)).toFixed(2).slice(2);
  let withSep = "";
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) withSep += ".";
    withSep += intPart[i];
  }
  return (neg ? "-" : "") + withSep + "," + dec;
}
function parseNum(s: any): number {
  if (s == null) return 0;
  let str = String(s).trim().replace(/[^0-9.,-]/g, "");
  if (!str) return 0;
  const neg = str.startsWith("-");
  if (neg) str = str.slice(1);
  const lc = str.lastIndexOf(","), ld = str.lastIndexOf(".");
  let intP = str, dec = "";
  if (lc > ld) { intP = str.slice(0, lc).replace(/[^0-9]/g, ""); dec = str.slice(lc+1).replace(/[^0-9]/g, ""); }
  else if (ld > -1 && lc === -1) {
    const parts = str.split(".");
    if (parts.slice(1).every((p) => p.length === 3) && parts.length >= 2) intP = parts.join("");
    else { intP = str.slice(0, ld).replace(/[^0-9]/g, ""); dec = str.slice(ld+1).replace(/[^0-9]/g, ""); }
  } else if (ld > lc) { intP = str.slice(0, ld).replace(/[^0-9]/g, ""); dec = str.slice(ld+1).replace(/[^0-9]/g, ""); }
  const n = parseFloat((intP || "0") + "." + (dec || "0"));
  return (neg ? -1 : 1) * (isNaN(n) ? 0 : n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const rows: any[] = body.rows || [];
    const applyRecebido = body.applyRecebido !== false;
    const applyGasto = body.applyGasto !== false;
    const insertOrphans = body.insertOrphans !== false;
    const sourceFile = body.sourceFile || "data_2.xlsx";

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Index xlsx
    const xlsxByPhone = new Map<string, any>();
    for (const r of rows) {
      const p = normPhone(r.phone);
      if (!p) continue;
      xlsxByPhone.set(p, { ...r, phone: p, recebido: Number(r.recebido) || 0, gasto: Number(r.gasto) || 0 });
    }

    // Fetch farmers
    const farmers: any[] = [];
    const PAGE = 1000;
    for (let off = 0; off < 100000; off += PAGE) {
      const { data, error } = await sb.from("farmers")
        .select("code, phone, valor_recebido, total_gasto").order("code").range(off, off + PAGE - 1);
      if (error) throw error;
      if (!data?.length) break;
      farmers.push(...data);
      if (data.length < PAGE) break;
    }
    const farmersByPhone = new Map<string, any[]>();
    for (const f of farmers) {
      const p = normPhone(f.phone);
      if (!p) continue;
      const arr = farmersByPhone.get(p) || [];
      arr.push(f);
      farmersByPhone.set(p, arr);
    }

    // Existing orphan phones
    const { data: orfData } = await sb.from("orphan_phones").select("phone");
    const orfSet = new Set<string>((orfData || []).map((o: any) => normPhone(o.phone)));

    let updRecebido = 0, updGasto = 0, insOrf = 0, skipPartilhado = 0, skipNoChange = 0, errors: string[] = [];

    // Process updates in mini-batches
    const updateOps: Promise<any>[] = [];
    const PAR = 20;
    async function flush() {
      if (updateOps.length === 0) return;
      await Promise.all(updateOps.splice(0, updateOps.length));
    }

    for (const [phone, x] of xlsxByPhone) {
      const list = farmersByPhone.get(phone);
      if (!list || list.length === 0) {
        if (insertOrphans && !orfSet.has(phone)) {
          updateOps.push(
            sb.from("orphan_phones").insert({
              phone, amount: x.recebido,
              source_files: [sourceFile],
              notes: `Auto via reconcile: nome="${x.nome || ""}" prov="${x.prov || ""}" muni="${x.muni || ""}" ecas="${x.ecas || ""}" carregamentos=${x.n || 0}`,
            }).then((r: any) => { if (r.error) errors.push(`orf ${phone}: ${r.error.message}`); else insOrf++; })
          );
        }
      } else if (list.length > 1) {
        skipPartilhado++;
      } else {
        const f = list[0];
        const dbRec = parseNum(f.valor_recebido);
        const dbGasto = parseNum(f.total_gasto);
        const patch: any = {};
        if (applyRecebido && Math.abs(x.recebido - dbRec) > TOL) {
          patch.valor_recebido = fmtPtAo(x.recebido);
        }
        if (applyGasto && Math.abs(x.gasto - dbGasto) > TOL) {
          patch.total_gasto = fmtPtAo(x.gasto);
        }
        if (Object.keys(patch).length === 0) { skipNoChange++; continue; }

        updateOps.push(
          sb.from("farmers").update(patch).eq("code", f.code).then(async (r: any) => {
            if (r.error) { errors.push(`upd ${f.code}: ${r.error.message}`); return; }
            if (patch.valor_recebido) updRecebido++;
            if (patch.total_gasto) updGasto++;
            if (!patch.valor_recebido && patch.total_gasto) {
              await sb.rpc("recalc_farmer_totals", { _farmer_code: f.code });
            }
          })
        );
      }
      if (updateOps.length >= PAR) await flush();
    }
    await flush();

    return new Response(JSON.stringify({
      ok: true,
      processed: xlsxByPhone.size,
      updRecebido, updGasto, insOrf, skipPartilhado, skipNoChange,
      errors_sample: errors.slice(0, 20),
      errors_count: errors.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
