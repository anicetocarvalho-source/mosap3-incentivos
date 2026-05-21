import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_ACCOUNTS: Array<{
  email: string;
  password: string;
  label: string;
  role: string;
  profile: "backoffice" | "fornecedor";
}> = [
  { email: "admin@mosap3.test",            password: "teste123", label: "Admin",                role: "admin",                  profile: "backoffice" },
  { email: "gestor@mosap3.test",           password: "teste123", label: "Gestor Incentivos",    role: "gestor_incentivos",      profile: "backoffice" },
  { email: "tecnico@mosap3.test",          password: "teste123", label: "Téc. Extensionista",   role: "tecnico_extensionista",  profile: "backoffice" },
  { email: "sr.agricultura@mosap3.test",   password: "teste123", label: "Sénior Agricultura",   role: "senior_agricultura",     profile: "backoffice" },
  { email: "jr.agricultura@mosap3.test",   password: "teste123", label: "Júnior Agricultura",   role: "junior_agricultura",     profile: "backoffice" },
  { email: "sr.monitoria@mosap3.test",     password: "teste123", label: "Sénior Monitoria",     role: "senior_monitoria",       profile: "backoffice" },
  { email: "jr.monitoria@mosap3.test",     password: "teste123", label: "Júnior Monitoria",     role: "junior_monitoria",       profile: "backoffice" },
  { email: "sr.agronegocio@mosap3.test",   password: "teste123", label: "Sénior Agronegócio",   role: "senior_agronegocio",     profile: "backoffice" },
  { email: "jr.agronegocio@mosap3.test",   password: "teste123", label: "Júnior Agronegócio",   role: "junior_agronegocio",     profile: "backoffice" },
  { email: "fornecedor@mosap3.test",       password: "teste123", label: "Fornecedor Teste",     role: "supplier",               profile: "fornecedor" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const usersByEmail = new Map<string, any>();
    for (const u of usersData?.users ?? []) {
      if (u.email) usersByEmail.set(u.email.toLowerCase(), u);
    }

    const ids = Array.from(usersByEmail.values()).map((u) => u.id);
    const rolesByUser = new Map<string, string[]>();
    if (ids.length) {
      const { data: rolesData } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      for (const r of rolesData ?? []) {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role as string);
        rolesByUser.set(r.user_id, arr);
      }
    }

    const { data: suppliers } = await supabaseAdmin
      .from("suppliers")
      .select("user_id, status")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const supplierByUser = new Map<string, { status: string }>();
    for (const s of suppliers ?? []) {
      if (s.user_id) supplierByUser.set(s.user_id, { status: s.status });
    }

    const { count: adminCount } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    const accounts = DEMO_ACCOUNTS.map((a) => {
      const user = usersByEmail.get(a.email.toLowerCase());
      const roles = user ? rolesByUser.get(user.id) ?? [] : [];
      const supplier = user ? supplierByUser.get(user.id) : null;
      const exists = !!user;
      const expectedRoleOk = a.profile === "fornecedor" ? !!supplier : roles.includes(a.role);
      const ready =
        exists &&
        expectedRoleOk &&
        (a.profile !== "fornecedor" || supplier?.status === "Ativo");

      return {
        email: a.email,
        password: a.password,
        label: a.label,
        role: a.role,
        profile: a.profile,
        exists,
        ready,
        supplier_status: supplier?.status ?? null,
        has_role: a.profile === "fornecedor" ? !!supplier : roles.includes(a.role),
      };
    });

    return new Response(
      JSON.stringify({
        bootstrap: !adminCount || adminCount === 0,
        admin_count: adminCount ?? 0,
        accounts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
