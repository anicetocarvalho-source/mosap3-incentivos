import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const testUsers = [
    { email: "admin@mosap3.test", password: "teste123", full_name: "Admin MOSAP3", role: "admin" },
    { email: "gestor@mosap3.test", password: "teste123", full_name: "Gestor Incentivos", role: "gestor_incentivos" },
    { email: "tecnico@mosap3.test", password: "teste123", full_name: "Técnico Extensionista", role: "tecnico_extensionista" },
  ];

  const results = [];

  for (const u of testUsers) {
    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((x: any) => x.email === u.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      results.push({ email: u.email, status: "already_exists", userId });
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) {
        results.push({ email: u.email, status: "error", error: error.message });
        continue;
      }
      userId = data.user.id;
      results.push({ email: u.email, status: "created", userId });
    }

    // Ensure profile exists
    await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      full_name: u.full_name,
    }, { onConflict: "user_id" });

    // Ensure role exists
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", u.role)
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: u.role });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
