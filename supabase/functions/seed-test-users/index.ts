import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Bootstrap mode: if there are no admins yet, allow unauthenticated seeding.
    const { count: adminCount } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    const isBootstrap = !adminCount || adminCount === 0;

    if (!isBootstrap) {
      // Require admin JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claimsData.claims.sub;
      const { data: isAdmin } = await supabaseAuth.rpc("is_admin", { _user_id: userId });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const testUsers = [
      { email: "admin@mosap3.test", full_name: "Admin MOSAP3", role: "admin" },
      { email: "gestor@mosap3.test", full_name: "Gestor Incentivos", role: "gestor_incentivos" },
      { email: "tecnico@mosap3.test", full_name: "Técnico Extensionista", role: "tecnico_extensionista" },
      { email: "sr.agricultura@mosap3.test", full_name: "Sénior Agricultura", role: "senior_agricultura" },
      { email: "jr.agricultura@mosap3.test", full_name: "Júnior Agricultura", role: "junior_agricultura" },
      { email: "sr.monitoria@mosap3.test", full_name: "Sénior Monitoria", role: "senior_monitoria" },
      { email: "jr.monitoria@mosap3.test", full_name: "Júnior Monitoria", role: "junior_monitoria" },
      { email: "sr.agronegocio@mosap3.test", full_name: "Sénior Agronegócio", role: "senior_agronegocio" },
      { email: "jr.agronegocio@mosap3.test", full_name: "Júnior Agronegócio", role: "junior_agronegocio" },
    ];

    const results: any[] = [];
    const password = "teste123";

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    for (const u of testUsers) {
      const existing = existingUsers?.users?.find((x: any) => x.email === u.email);

      let uid: string;

      if (existing) {
        uid = existing.id;
        // Garantir password e email confirmado em modo bootstrap
        await supabaseAdmin.auth.admin.updateUserById(uid, {
          password,
          email_confirm: true,
        });
        results.push({ email: u.email, status: "updated", userId: uid });
      } else {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (error) {
          results.push({ email: u.email, status: "error", error: error.message });
          continue;
        }
        uid = data.user.id;
        results.push({ email: u.email, status: "created", userId: uid });
      }

      await supabaseAdmin.from("profiles").upsert(
        { user_id: uid, full_name: u.full_name },
        { onConflict: "user_id" }
      );

      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", uid)
        .eq("role", u.role)
        .maybeSingle();

      if (!existingRole) {
        await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: u.role });
      }
    }

    return new Response(JSON.stringify({ bootstrap: isBootstrap, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
