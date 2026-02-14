import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, UserPlus, LogIn, Shield, Gift, Sprout } from "lucide-react";
import { z } from "zod";
import mosapLogo from "@/assets/mosap3-logo.png";

const TEST_USERS = [
  { email: "admin@mosap3.test", password: "teste123", label: "Admin", icon: Shield, color: "text-red-500" },
  { email: "gestor@mosap3.test", password: "teste123", label: "Gestor Incentivos", icon: Gift, color: "text-amber-500" },
  { email: "tecnico@mosap3.test", password: "teste123", label: "Técnico Extensionista", icon: Sprout, color: "text-emerald-500" },
];

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "A password deve ter pelo menos 6 caracteres").max(128),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres").max(100),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast({ title: "Erro de validação", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const handleRegister = async () => {
    const result = registerSchema.safeParse({ email, password, fullName });
    if (!result.success) {
      toast({ title: "Erro de validação", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: result.data.fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao registar", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Registo efetuado!",
        description: "Verifique o seu email para confirmar a conta antes de entrar.",
      });
      setIsLogin(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) handleLogin();
    else handleRegister();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--gradient-hero)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-card rounded-2xl p-3 mb-4 shadow-lg">
            <img src={mosapLogo} alt="MOSAP3" className="h-14 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white font-heading">MOSAP3</h1>
          <p className="text-sm mt-1" style={{ color: "hsl(100 15% 75%)" }}>
            Sistema de Gestão Agrícola
          </p>
        </div>

        <Card className="p-6 shadow-xl">
          {/* Tabs */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <LogIn className="h-4 w-4" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                !isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Registar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    placeholder="Ex: João Manuel Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.ao"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  maxLength={255}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  maxLength={128}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLogin ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>
          {isLogin && (
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3 text-center">Utilizadores de teste</p>
              <div className="grid gap-2">
                {TEST_USERS.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(u.password); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors text-sm"
                  >
                    <u.icon className={`h-4 w-4 ${u.color}`} />
                    <span className="font-medium">{u.label}</span>
                    <span className="text-muted-foreground ml-auto text-xs">{u.email} / {u.password}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
