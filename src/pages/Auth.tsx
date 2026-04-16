import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, UserPlus, LogIn, Shield, Gift, Sprout, Wheat, Eye, TrendingUp, WifiOff, RefreshCw } from "lucide-react";
import { z } from "zod";
import mosapLogo from "@/assets/mosap3-logo.png";
import { offlineLogin } from "@/lib/offlineAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuth } from "@/hooks/useAuth";
import { classifyError } from "@/lib/errorHandling";

const TEST_USERS = [
  { email: "admin@mosap3.test", password: "teste123", label: "Admin", icon: Shield, color: "text-red-500" },
  { email: "gestor@mosap3.test", password: "teste123", label: "Gestor Incentivos", icon: Gift, color: "text-amber-500" },
  { email: "tecnico@mosap3.test", password: "teste123", label: "Técnico Extensionista", icon: Sprout, color: "text-emerald-500" },
  { email: "sr.agricultura@mosap3.test", password: "teste123", label: "Sénior Agricultura", icon: Wheat, color: "text-green-600" },
  { email: "jr.agricultura@mosap3.test", password: "teste123", label: "Júnior Agricultura", icon: Wheat, color: "text-green-400" },
  { email: "sr.monitoria@mosap3.test", password: "teste123", label: "Sénior Monitoria", icon: Eye, color: "text-blue-600" },
  { email: "jr.monitoria@mosap3.test", password: "teste123", label: "Júnior Monitoria", icon: Eye, color: "text-blue-400" },
  { email: "sr.agronegocio@mosap3.test", password: "teste123", label: "Sénior Agronegócio", icon: TrendingUp, color: "text-purple-600" },
  { email: "jr.agronegocio@mosap3.test", password: "teste123", label: "Júnior Agronegócio", icon: TrendingUp, color: "text-purple-400" },
];

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email é obrigatório").max(255),
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
  const [loginAttempts, setLoginAttempts] = useState(0);
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { setOfflineSession } = useAuth();

  const handleLogin = async () => {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast({ title: "Erro de validação", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);

    if (!isOnline) {
      try {
        const cached = await offlineLogin(result.data.email, result.data.password);
        setLoading(false);
        if (cached) {
          setOfflineSession(cached);
          setLoginAttempts(0);
          toast({ title: "Sessão offline", description: "Entrou com dados em cache. Algumas funcionalidades podem estar limitadas." });
          navigate("/");
        } else {
          setLoginAttempts((prev) => prev + 1);
          toast({
            title: "Sem sessão em cache",
            description: loginAttempts >= 2
              ? "Nunca fez login com este email neste dispositivo. Conecte-se a uma rede Wi-Fi ou dados móveis para iniciar sessão pela primeira vez."
              : "Nunca fez login com este email neste dispositivo. Conecte-se à internet.",
            variant: "destructive",
          });
        }
      } catch (err) {
        setLoading(false);
        toast({ title: "Erro offline", description: "Não foi possível verificar as credenciais em cache. Tente novamente.", variant: "destructive" });
      }
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });
      setLoading(false);

      if (error) {
        setLoginAttempts((prev) => prev + 1);
        const classified = classifyError(error);
        
        let extraHint = "";
        if (loginAttempts >= 2 && classified.category === "auth") {
          extraHint = " Se esqueceu a password, contacte o administrador do sistema.";
        }

        toast({
          title: classified.title,
          description: classified.description + extraHint,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        setLoginAttempts(0);
        navigate("/");
      }
    } catch (err) {
      setLoading(false);
      const classified = classifyError(err);
      toast({
        title: classified.title,
        description: classified.retryable
          ? classified.description + " Tente novamente em alguns segundos."
          : classified.description,
        variant: "destructive",
      });
    }
  };

  const handleRegister = async () => {
    const result = registerSchema.safeParse({ email, password, fullName });
    if (!result.success) {
      toast({ title: "Erro de validação", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!isOnline) {
      toast({ title: "Sem internet", description: "O registo requer ligação à internet. Conecte-se a uma rede e tente novamente.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
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
        const classified = classifyError(error);
        toast({ title: classified.title, description: classified.description, variant: "destructive" });
      } else {
        toast({
          title: "Registo efetuado!",
          description: "Verifique o seu email para confirmar a conta antes de entrar.",
        });
        setIsLogin(true);
      }
    } catch (err) {
      setLoading(false);
      const classified = classifyError(err);
      toast({
        title: classified.title,
        description: classified.retryable
          ? classified.description + " Tente novamente."
          : classified.description,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
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

        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-500/20 text-amber-200 rounded-lg px-4 py-2 mb-4 text-sm">
            <WifiOff className="h-4 w-4 flex-shrink-0" />
            <span>Modo offline — pode entrar se já fez login antes neste dispositivo.</span>
          </div>
        )}

        <Card className="p-6 shadow-xl">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <LogIn className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Iniciar sessão</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

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
                isOnline ? "Entrar" : "Entrar Offline"
              ) : (
                "Criar conta"
              )}
            </Button>
          </form>
          {isLogin && isOnline && (
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
