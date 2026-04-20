import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { data: isAdmin } = await supabaseAuth.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const email = "fornecedor@mosap3.test";
    const password = "teste123";
    const fullName = "Fornecedor Teste MOSAP3";
    const supplierName = "AgroTeste, Lda.";
    const log: string[] = [];

    // 1. Create or get auth user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((x: any) => x.email === email);

    let uid: string;
    if (existing) {
      uid = existing.id;
      log.push(`Auth user exists: ${uid}`);
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      uid = data.user.id;
      log.push(`Auth user created: ${uid}`);
    }

    // 2. Profile
    await supabaseAdmin.from("profiles").upsert(
      { user_id: uid, full_name: fullName },
      { onConflict: "user_id" }
    );

    // 3. Supplier (link to user)
    let supplierId: string;
    const { data: existingSup } = await supabaseAdmin
      .from("suppliers").select("id").eq("user_id", uid).maybeSingle();

    if (existingSup) {
      supplierId = existingSup.id;
      log.push(`Supplier exists: ${supplierId}`);
    } else {
      const { data: sup, error: supErr } = await supabaseAdmin.from("suppliers").insert({
        user_id: uid,
        name: supplierName,
        email,
        phone: "+244 923 000 111",
        nif: "5417000111",
        address: "Rua dos Testes, 100",
        province: "Benguela",
        municipality: "Benguela",
        shortcode: "AGT",
        status: "Ativo",
      }).select("id").single();
      if (supErr) {
        return new Response(JSON.stringify({ error: "Supplier: " + supErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      supplierId = sup.id;
      log.push(`Supplier created: ${supplierId}`);
    }

    // 4. Province link
    const { data: prov } = await supabaseAdmin
      .from("provinces").select("id").eq("name", "Benguela").maybeSingle();
    if (prov) {
      const { data: existingLink } = await supabaseAdmin
        .from("supplier_provinces").select("id")
        .eq("supplier_id", supplierId).eq("province_id", prov.id).maybeSingle();
      if (!existingLink) {
        await supabaseAdmin.from("supplier_provinces").insert({
          supplier_id: supplierId, province_id: prov.id,
        });
        log.push(`Province linked: Benguela`);
      }
    }

    // 5. Store
    const { data: existingStore } = await supabaseAdmin
      .from("supplier_stores").select("id").eq("supplier_id", supplierId).maybeSingle();
    if (!existingStore) {
      await supabaseAdmin.from("supplier_stores").insert({
        supplier_id: supplierId,
        name: "Loja Central Benguela",
        address: "Av. Principal, 200",
        province: "Benguela",
        municipality: "Benguela",
        phone: "+244 923 000 222",
        manager_name: "Gestor Teste",
        manager_phone: "+244 923 000 333",
        status: "Ativo",
      });
      log.push("Store created");
    }

    // 6. POS
    const { data: existingPos } = await supabaseAdmin
      .from("supplier_pos").select("id").eq("supplier_id", supplierId).maybeSingle();
    if (!existingPos) {
      await supabaseAdmin.from("supplier_pos").insert({
        supplier_id: supplierId,
        pos_code: "POS-AGT-01",
        label: "Terminal Principal",
        location: "Loja Central Benguela",
        operator_name: "Operador Teste",
        operator_phone: "+244 923 000 444",
        status: "Ativo",
      });
      log.push("POS created");
    }

    // 7. Sample products linked to PATEC items
    const { data: existingProducts } = await supabaseAdmin
      .from("supplier_products").select("id").eq("supplier_id", supplierId).limit(1);

    if (!existingProducts || existingProducts.length === 0) {
      const { data: patecItems } = await supabaseAdmin
        .from("patec_items").select("name, category, unit, patec_number").limit(8);

      if (patecItems && patecItems.length > 0) {
        const products = patecItems.map((it: any) => ({
          supplier_id: supplierId,
          name: it.name,
          category: "insumos",
          patec_category: it.category,
          patec_number: it.patec_number,
          unit: it.unit || "un",
          price: Math.round((Math.random() * 5000 + 500) * 100) / 100,
          stock: Math.floor(Math.random() * 200 + 50),
          min_stock: 10,
          iva_rate: 14,
          status: "Ativo",
        }));
        await supabaseAdmin.from("supplier_products").insert(products);
        log.push(`${products.length} products created`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      credentials: { email, password },
      supplier_id: supplierId,
      log,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
