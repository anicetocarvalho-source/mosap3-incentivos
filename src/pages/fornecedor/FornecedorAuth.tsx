import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Lock, UserPlus, LogIn, Store } from "lucide-react";
import mosapLogo from "@/assets/mosap3-logo.png";

const FornecedorAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nif, setNif] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) { toast.error("Preencha todos os campos"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }

    // Verify this user is a supplier
    const { data: supplier } = await supabase.from("suppliers").select("id").eq("user_id", data.user.id).maybeSingle();
    if (!supplier) {
      await supabase.auth.signOut();
      toast.error("Esta conta não está associada a nenhum fornecedor. Contacte o administrador.");
      setLoading(false);
      return;
    }
    setLoading(false);
    navigate("/fornecedor");
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName || !companyName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/fornecedor/login", data: { full_name: fullName } },
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (!data.user) { toast.error("Erro ao criar conta"); setLoading(false); return; }

    // Create supplier record linked to this user
    const { error: supError } = await supabase.from("suppliers").insert({
      user_id: data.user.id,
      name: companyName,
      nif: nif || null,
      phone: phone || null,
      email,
      status: "Pendente",
    });
    if (supError) {
      toast.error("Erro ao registar fornecedor: " + supError.message);
      setLoading(false);
      return;
    }

    toast.success("Registo efetuado! A sua conta será activada pelo administrador.");
    setIsLogin(true);
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) handleLogin(); else handleRegister();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, hsl(130 55% 25%), hsl(150 25% 12%))" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-card rounded-2xl p-3 mb-4 shadow-lg">
            <img src={mosapLogo} alt="MOSAP3" className="h-14 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground font-heading">MOSAP3Pay</h1>
          <p className="text-sm mt-1 text-primary-foreground/70">Portal do Fornecedor</p>
        </div>

        <Card className="p-6 shadow-xl">
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button type="button" onClick={() => setIsLogin(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <LogIn className="h-4 w-4" /> Entrar
            </button>
            <button type="button" onClick={() => setIsLogin(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${!isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <UserPlus className="h-4 w-4" /> Registar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div key="register-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome completo do responsável *</Label>
                    <Input placeholder="Ex: João Manuel Silva" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome da empresa *</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Ex: AgroSupply Angola" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>NIF</Label>
                      <Input placeholder="NIF da empresa" value={nif} onChange={(e) => setNif(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input placeholder="+244 ..." value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label>Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="email@empresa.ao" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? "Entrar" : "Criar conta de fornecedor"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {isLogin ? "Após o registo, a sua conta será activada pelo administrador do MOSAP3." : "Ao registar-se, concorda com os termos de utilização da plataforma."}
          </p>
        </Card>
      </motion.div>
    </div>
  );
};

export default FornecedorAuth;
