// Edge function: reconcile xlsx aggregates against farmers table.
// Receives JSON: { rows: [{phone,recebido,gasto,n,nome,prov,muni,ecas}] }
// Returns: { summary, divergencias, orfaos, partilhados }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOL = 1; // tolerância 1 Kz

function normPhone(p: string | null | undefined): string {
  if (!p) return "";
  let s = String(p).replace(/[^0-9]/g, "");
  if (s.startsWith("244")) s = s.slice(3);
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const xlsxRows: Array<any> = body.rows || [];
    if (!Array.isArray(xlsxRows) || xlsxRows.length === 0) {
      return new Response(JSON.stringify({ error: "rows vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Index xlsx por telefone normalizado
    const xlsxByPhone = new Map<string, any>();
    for (const r of xlsxRows) {
      const p = normPhone(r.phone);
      if (!p) continue;
      xlsxByPhone.set(p, {
        ...r,
        phone: p,
        recebido: Number(r.recebido) || 0,
        gasto: Number(r.gasto) || 0,
      });
    }

    // Fetch farmers em páginas
    const farmers: any[] = [];
    const PAGE = 1000;
    for (let off = 0; off < 100000; off += PAGE) {
      const { data, error } = await sb
        .from("farmers")
        .select("code, full_name, phone, province, municipality, school, status, valor_recebido, total_gasto, saldo_final")
        .order("code")
        .range(off, off + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      farmers.push(...data);
      if (data.length < PAGE) break;
    }

    // parse PT-AO numeric (replica de parse_ptao_numeric simplificado)
    const parseNum = (s: any): number => {
      if (s == null) return 0;
      let str = String(s).trim().replace(/[^0-9.,-]/g, "");
      if (!str) return 0;
      const neg = str.startsWith("-");
      if (neg) str = str.slice(1);
      const lastComma = str.lastIndexOf(",");
      const lastDot = str.lastIndexOf(".");
      let intPart = str, dec = "";
      if (lastComma > lastDot) {
        intPart = str.slice(0, lastComma).replace(/[^0-9]/g, "");
        dec = str.slice(lastComma + 1).replace(/[^0-9]/g, "");
      } else if (lastDot > -1 && lastComma === -1) {
        const parts = str.split(".");
        const allTriples = parts.slice(1).every((p) => p.length === 3);
        if (allTriples && parts.length >= 2) {
          intPart = parts.join("");
        } else {
          intPart = str.slice(0, lastDot).replace(/[^0-9]/g, "");
          dec = str.slice(lastDot + 1).replace(/[^0-9]/g, "");
        }
      } else if (lastDot > lastComma) {
        intPart = str.slice(0, lastDot).replace(/[^0-9]/g, "");
        dec = str.slice(lastDot + 1).replace(/[^0-9]/g, "");
      }
      const n = parseFloat((intPart || "0") + "." + (dec || "0"));
      return (neg ? -1 : 1) * (isNaN(n) ? 0 : n);
    };

    // Agrupa farmers por telefone normalizado
    const farmersByPhone = new Map<string, any[]>();
    for (const f of farmers) {
      const p = normPhone(f.phone);
      if (!p) continue;
      const arr = farmersByPhone.get(p) || [];
      arr.push({
        ...f,
        recebido_bd: parseNum(f.valor_recebido),
        gasto_bd: parseNum(f.total_gasto),
        saldo_bd: parseNum(f.saldo_final),
      });
      farmersByPhone.set(p, arr);
    }

    // Fetch orphan_phones
    const { data: orfData } = await sb.from("orphan_phones").select("phone, amount");
    const orfSet = new Set<string>((orfData || []).map((o: any) => normPhone(o.phone)));

    const divergencias: any[] = [];
    const orfaos: any[] = [];
    const partilhados: any[] = [];
    const okPhones: string[] = [];
    const sumRecebidoBd = { total: 0 }, sumGastoBd = { total: 0 };

    for (const [phone, x] of xlsxByPhone) {
      const farmersList = farmersByPhone.get(phone);
      if (!farmersList || farmersList.length === 0) {
        orfaos.push({
          phone,
          recebido_xlsx: x.recebido,
          gasto_xlsx: x.gasto,
          saldo_xlsx: x.recebido - x.gasto,
          carregamentos: x.n,
          nome: x.nome, prov: x.prov, muni: x.muni, ecas: x.ecas,
          ja_em_orphan: orfSet.has(phone),
        });
        continue;
      }
      if (farmersList.length > 1) {
        partilhados.push({
          phone, n_farmers: farmersList.length,
          codes: farmersList.map((f) => f.code).join("|"),
          names: farmersList.map((f) => f.full_name).join("|"),
          recebido_xlsx: x.recebido, gasto_xlsx: x.gasto,
          recebido_bd_total: farmersList.reduce((a, f) => a + f.recebido_bd, 0),
          gasto_bd_total: farmersList.reduce((a, f) => a + f.gasto_bd, 0),
        });
        // Continua a comparar como agregado
      }
      const f = farmersList[0];
      const recBd = farmersList.reduce((a, ff) => a + ff.recebido_bd, 0);
      const gastoBd = farmersList.reduce((a, ff) => a + ff.gasto_bd, 0);
      const saldoBd = farmersList.reduce((a, ff) => a + ff.saldo_bd, 0);
      const dRec = x.recebido - recBd;
      const dGasto = x.gasto - gastoBd;
      const saldoXlsx = x.recebido - x.gasto;
      const dSaldo = saldoXlsx - saldoBd;

      const okRec = Math.abs(dRec) <= TOL;
      const okGasto = Math.abs(dGasto) <= TOL;
      const okSaldo = Math.abs(dSaldo) <= TOL;
      let categoria = "ok";
      if (!okRec && !okGasto) categoria = "diff_recebido_e_gasto";
      else if (!okRec) categoria = "diff_recebido";
      else if (!okGasto) categoria = "diff_gasto";
      else if (!okSaldo) categoria = "diff_saldo_apenas";

      if (categoria === "ok") {
        okPhones.push(phone);
      } else {
        divergencias.push({
          phone, code: f.code, nome_bd: f.full_name, nome_xlsx: x.nome,
          status: f.status, prov_bd: f.province, prov_xlsx: x.prov,
          muni_bd: f.municipality, muni_xlsx: x.muni, school_bd: f.school, ecas_xlsx: x.ecas,
          recebido_xlsx: x.recebido, recebido_bd: recBd, delta_recebido: dRec,
          gasto_xlsx: x.gasto, gasto_bd: gastoBd, delta_gasto: dGasto,
          saldo_xlsx: saldoXlsx, saldo_bd: saldoBd, delta_saldo: dSaldo,
          carregamentos: x.n, n_farmers: farmersList.length, categoria,
        });
      }
      sumRecebidoBd.total += recBd;
      sumGastoBd.total += gastoBd;
    }

    // Farmers que NÃO aparecem no xlsx
    const farmersNoXlsx: any[] = [];
    for (const [p, list] of farmersByPhone) {
      if (!xlsxByPhone.has(p)) {
        for (const f of list) {
          if (f.recebido_bd > 0 || f.gasto_bd > 0) {
            farmersNoXlsx.push({
              phone: p, code: f.code, nome: f.full_name,
              prov: f.province, muni: f.municipality, school: f.school,
              recebido_bd: f.recebido_bd, gasto_bd: f.gasto_bd, saldo_bd: f.saldo_bd,
            });
          }
        }
      }
    }

    const totals = {
      xlsx_phones: xlsxByPhone.size,
      bd_phones: farmersByPhone.size,
      ok: okPhones.length,
      divergencias: divergencias.length,
      orfaos: orfaos.length,
      partilhados: partilhados.length,
      farmers_sem_xlsx_com_valor: farmersNoXlsx.length,
      total_recebido_xlsx: [...xlsxByPhone.values()].reduce((a, x) => a + x.recebido, 0),
      total_gasto_xlsx: [...xlsxByPhone.values()].reduce((a, x) => a + x.gasto, 0),
      total_recebido_bd: sumRecebidoBd.total,
      total_gasto_bd: sumGastoBd.total,
    };

    return new Response(JSON.stringify({
      summary: totals,
      divergencias,
      orfaos,
      partilhados,
      farmersNoXlsx,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
