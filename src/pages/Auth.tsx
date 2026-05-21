import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Mail, Lock, LogIn, Shield, Gift, Sprout, Wheat, Eye, TrendingUp,
  WifiOff, Wifi, Store, Fingerprint, Package, ShoppingCart, ChevronDown, ArrowRight, CheckCircle2,
  AlertTriangle, RefreshCw, Info,
} from "lucide-react";
import { z } from "zod";
import { mosapLogo, LOGO_SIZES } from "@/config/brand";
import { offlineLogin } from "@/lib/offlineAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuth } from "@/hooks/useAuth";
import { classifyError } from "@/lib/errorHandling";
import { cn } from "@/lib/utils";
import { LoginButton } from "@/components/LoginButton";

type Profile = "backoffice" | "fornecedor";

type DemoAccount = {
  email: string;
  password: string;
  label: string;
  role: string;
  profile: Profile;
  exists: boolean;
  ready: boolean;
  supplier_status: string | null;
  has_role: boolean;
};

const ROLE_META: Record<string, { icon: any; color: string }> = {
  admin:                  { icon: Shield,     color: "text-destructive" },
  gestor_incentivos:      { icon: Gift,       color: "text-warning" },
  tecnico_extensionista:  { icon: Sprout,     color: "text-success" },
  senior_agricultura:     { icon: Wheat,      color: "text-success" },
  junior_agricultura:     { icon: Wheat,      color: "text-success/70" },
  senior_monitoria:       { icon: Eye,        color: "text-info" },
  junior_monitoria:       { icon: Eye,        color: "text-info/70" },
  senior_agronegocio:     { icon: TrendingUp, color: "text-accent-foreground" },
  junior_agronegocio:     { icon: TrendingUp, color: "text-accent-foreground/70" },
  supplier:               { icon: Store,      color: "text-primary" },
};


const HIGHLIGHTS = [
  { icon: Fingerprint, title: "Cadastro Biométrico", desc: "Identificação segura por impressão digital." },
  { icon: Package, title: "Pacotes Tecnológicos", desc: "PATEC adaptado a cada agricultor." },
  { icon: ShoppingCart, title: "POS Comercial Integrado", desc: "Vendas e incentivos em tempo real." },
];

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email é obrigatório").max(255),
  password: z.string().min(6, "A password deve ter pelo menos 6 caracteres").max(128),
});


const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialProfile: Profile = searchParams.get("profile") === "fornecedor" ? "fornecedor" : "backoffice";
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [systemMode, setSystemMode] = useState<"bootstrap" | "admin-only" | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[] | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [seedingSupplier, setSeedingSupplier] = useState(false);
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { setOfflineSession, user, authReady } = useAuth();

  useEffect(() => {
    if (authReady && user) {
      navigate("/", { replace: true });
    }
  }, [authReady, user, navigate]);

  // Verificar estado do sistema (bootstrap vs admin-only)
  useEffect(() => {
    let cancelled = false;
    const checkSystem = async () => {
      if (!isOnline) {
        setCheckingSystem(false);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("check-admin-status");
        if (!cancelled) {
          if (error) {
            console.error("check-admin-status error:", error);
            setSystemMode("admin-only"); // fallback seguro
          } else {
            setSystemMode(data.mode === "bootstrap" ? "bootstrap" : "admin-only");
          }
        }
      } catch (e) {
        if (!cancelled) setSystemMode("admin-only");
      } finally {
        if (!cancelled) setCheckingSystem(false);
      }
    };
    checkSystem();
    return () => { cancelled = true; };
  }, [isOnline]);

  // Carregar lista de contas demo (existentes vs em falta)
  const refreshDemoAccounts = async () => {
    if (!isOnline) return;
    setLoadingDemo(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-demo-accounts");
      if (!error && data?.accounts) setDemoAccounts(data.accounts as DemoAccount[]);
    } catch {
      // silencioso
    } finally {
      setLoadingDemo(false);
    }
  };

  useEffect(() => {
    refreshDemoAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const selectDemo = (acc: DemoAccount) => {
    setProfile(acc.profile);
    setEmail(acc.email);
    setPassword(acc.password);
  };

  const loginWithDemo = async (acc: DemoAccount) => {
    if (!isOnline) {
      toast({ title: "Sem ligação", description: "Acessos demo requerem internet.", variant: "destructive" });
      return;
    }
    setProfile(acc.profile);
    setEmail(acc.email);
    setPassword(acc.password);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: acc.email, password: acc.password });
      if (error) {
        const classified = classifyError(error);
        toast({ title: classified.title, description: classified.description + " Considere recriar as contas demo.", variant: "destructive" });
        return;
      }
      if (data.user) {
        if (acc.profile === "fornecedor") {
          const { data: supplier } = await supabase.from("suppliers").select("id, status").eq("user_id", data.user.id).maybeSingle();
          if (!supplier) {
            await supabase.auth.signOut();
            toast({ title: "Fornecedor não associado", description: "Recrie a conta demo de fornecedor.", variant: "destructive" });
            return;
          }
          navigate("/fornecedor");
          return;
        }
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSeedSupplier = async () => {
    setSeedingSupplier(true);
    try {
      const { error } = await supabase.functions.invoke("seed-test-supplier");
      if (error) throw error;
      toast({ title: "Fornecedor demo pronto", description: "fornecedor@mosap3.test · teste123" });
      await refreshDemoAccounts();
    } catch (e: any) {
      toast({ title: "Não foi possível criar fornecedor demo", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSeedingSupplier(false);
    }
  };


  const handleBootstrapSeed = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-test-users");
      if (error) throw error;
      const created = data.results?.filter((r: any) => r.status === "created").length || 0;
      const updated = data.results?.filter((r: any) => r.status === "updated").length || 0;
      toast({
        title: "Contas de demonstração criadas",
        description: `${created} criadas, ${updated} actualizadas. Pode agora fazer login com qualquer conta demo.`,
      });
      setSystemMode("admin-only");
      await refreshDemoAccounts();
    } catch (e: any) {
      toast({
        title: "Erro ao criar contas",
        description: e?.message || "Tente novamente ou contacte o administrador.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
        const extraHint = loginAttempts >= 2 && classified.category === "auth"
          ? " Se esqueceu a password, contacte o administrador do sistema." : "";
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
        description: classified.retryable ? classified.description + " Tente novamente em alguns segundos." : classified.description,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  const handleSupplierLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast({ title: "Erro de validação", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!isOnline) {
      toast({ title: "Sem ligação", description: "O login de fornecedor requer ligação à internet.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });
      if (error) {
        const classified = classifyError(error);
        toast({ title: classified.title, description: classified.description, variant: "destructive" });
        return;
      }
      if (data.user) {
        const { data: supplier, error: supErr } = await supabase
          .from("suppliers")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (supErr || !supplier) {
          await supabase.auth.signOut();
          toast({
            title: "Conta não associada",
            description: "Esta conta não está vinculada a um fornecedor. Use 'Registar nova empresa' ou contacte o administrador.",
            variant: "destructive",
          });
          return;
        }
        navigate("/fornecedor");
      }
    } catch (err) {
      const classified = classifyError(err);
      toast({ title: classified.title, description: classified.description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Panel - Hero */}
      <motion.aside
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="relative lg:w-1/2 lg:min-h-screen flex flex-col justify-between p-8 lg:p-12 overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* decorative blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-foreground/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary-foreground/5 blur-3xl pointer-events-none" />

        <motion.div variants={itemVariants} className="relative flex items-center gap-3">
          <div className="bg-card rounded-2xl p-2.5 shadow-lg">
            <img src={mosapLogo} alt="MOSAP3" className={LOGO_SIZES.auth} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground font-heading leading-tight">MOSAP3</h1>
            <p className="text-xs text-primary-foreground/70">Projecto Mosap3</p>
          </div>
        </motion.div>

        <div className="relative space-y-8 my-10 lg:my-0">
          <motion.div variants={itemVariants}>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary-foreground font-heading leading-tight">
              Plataforma integrada para a <span className="text-warning">agricultura</span> angolana.
            </h2>
            <p className="mt-4 text-primary-foreground/80 text-base lg:text-lg max-w-md">
              Gestão de produtores, incentivos, pacotes tecnológicos e comércio — tudo num só lugar.
            </p>
          </motion.div>

          <motion.ul variants={containerVariants} className="space-y-4 max-w-md">
            {HIGHLIGHTS.map((h) => (
              <motion.li key={h.title} variants={itemVariants} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 flex items-center justify-center">
                  <h.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-primary-foreground font-semibold">{h.title}</h3>
                  <p className="text-primary-foreground/70 text-sm">{h.desc}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.div variants={itemVariants} className="relative flex items-center justify-between text-xs text-primary-foreground/70">
          <span>© {new Date().getFullYear()} MOSAP3 · v1.0</span>
          <span className="hidden sm:inline">Apoio: suporte@mosap3.ao</span>
        </motion.div>
      </motion.aside>

      {/* Right Panel - Form */}
      <main className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Online status badge */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              {checkingSystem ? (
                <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  A verificar sistema...
                </div>
              ) : systemMode === "bootstrap" ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-warning/10 text-warning border-warning/30">
                  <AlertTriangle className="h-3 w-3" />
                  Modo Bootstrap
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border bg-info/10 text-info border-info/20">
                  <Info className="h-3 w-3" />
                  {systemMode === "admin-only" ? "Admin-only" : ""}
                </div>
              )}
            </div>
            <div className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
              isOnline
                ? "bg-success/10 text-success border-success/20"
                : "bg-warning/10 text-warning border-warning/30"
            )}>
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? "Online" : "Offline"}
            </div>
          </div>

          <Card className="p-6 lg:p-8 shadow-xl border-border/60 backdrop-blur-sm">
            {/* Profile toggle */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg mb-6">
              <button
                type="button"
                onClick={() => setProfile("backoffice")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                  profile === "backoffice"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Shield className="h-4 w-4" />
                Backoffice
              </button>
              <button
                type="button"
                onClick={() => setProfile("fornecedor")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                  profile === "fornecedor"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Store className="h-4 w-4" />
                Fornecedor
              </button>
            </div>

            <AnimatePresence mode="wait">
              {profile === "backoffice" ? (
                <motion.div
                  key="backoffice"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold font-heading">Bem-vindo de volta</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aceda ao painel de gestão MOSAP3.
                    </p>
                  </div>

                  {systemMode === "bootstrap" && isOnline && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-2 bg-warning/10 text-warning border border-warning/30 rounded-lg px-3 py-3 mb-4"
                    >
                      <div className="flex items-start gap-2 text-xs">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Sistema em modo Bootstrap</p>
                          <p className="text-warning/80 mt-0.5">
                            Não existem administradores no sistema. Crie as contas de demonstração para começar.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleBootstrapSeed}
                        disabled={loading}
                        className="w-full gap-2 text-xs border-warning/40 text-warning hover:bg-warning/20 hover:text-warning"
                      >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Criar 9 contas de demonstração
                      </Button>
                    </motion.div>
                  )}

                  {!isOnline && (
                    <div className="flex items-start gap-2 bg-warning/10 text-warning border border-warning/20 rounded-lg px-3 py-2 mb-4 text-xs">
                      <WifiOff className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Modo offline — pode entrar se já fez login antes neste dispositivo.</span>
                    </div>
                  )}

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
                          className="pl-10 h-11"
                          maxLength={255}
                          autoComplete="email"
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
                          className="pl-10 h-11"
                          maxLength={128}
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    <LoginButton
                      loading={loading}
                      label={isOnline ? "Entrar" : "Entrar Offline"}
                    />
                  </form>

                  {isOnline && (
                    <DemoAccountsPanel
                      accounts={demoAccounts}
                      loading={loadingDemo}
                      onSelect={selectDemo}
                      onLogin={loginWithDemo}
                      onRefresh={refreshDemoAccounts}
                      onSeedBackoffice={handleBootstrapSeed}
                      onSeedSupplier={handleSeedSupplier}
                      seedingSupplier={seedingSupplier}
                      busy={loading}
                    />
                  )}

                  <div className="mt-4 pt-4 border-t border-border text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setProfile("fornecedor")}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      <Store className="h-3.5 w-3.5 mr-1.5" />
                      Voltar ao Portal do Fornecedor
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="fornecedor"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-6 flex items-center gap-3">
                    <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold font-heading">Portal do Fornecedor</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Aceda à sua loja e terminal POS.
                      </p>
                    </div>
                  </div>

                  {!isOnline && (
                    <div className="flex items-start gap-2 bg-warning/10 text-warning border border-warning/20 rounded-lg px-3 py-2 mb-4 text-xs">
                      <WifiOff className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Sem ligação — o login de fornecedor requer internet.</span>
                    </div>
                  )}

                  <form onSubmit={handleSupplierLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="supplier-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="supplier-email"
                          type="email"
                          placeholder="fornecedor@exemplo.ao"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-11"
                          maxLength={255}
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="supplier-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="supplier-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 h-11"
                          maxLength={128}
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    <LoginButton
                      loading={loading}
                      disabled={!isOnline}
                      label="Entrar como Fornecedor"
                      icon={Store}
                    />
                  </form>

                  <div className="mt-3 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigate("/fornecedor/login")}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Registar nova empresa
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>

                  {isOnline && (
                    <DemoAccountsPanel
                      accounts={demoAccounts}
                      loading={loadingDemo}
                      onSelect={selectDemo}
                      onLogin={loginWithDemo}
                      onRefresh={refreshDemoAccounts}
                      onSeedBackoffice={handleBootstrapSeed}
                      onSeedSupplier={handleSeedSupplier}
                      seedingSupplier={seedingSupplier}
                      busy={loading}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

interface DemoPanelProps {
  accounts: DemoAccount[] | null;
  loading: boolean;
  onSelect: (a: DemoAccount) => void;
  onLogin: (a: DemoAccount) => void;
  onRefresh: () => void;
  onSeedBackoffice: () => void;
  onSeedSupplier: () => void;
  seedingSupplier: boolean;
  busy: boolean;
}

const DemoAccountsPanel = ({
  accounts, loading, onSelect, onLogin, onRefresh,
  onSeedBackoffice, onSeedSupplier, seedingSupplier, busy,
}: DemoPanelProps) => {
  const total = accounts?.length ?? 0;
  const ready = accounts?.filter((a) => a.ready).length ?? 0;
  const missingBackoffice = !!accounts && accounts.some((a) => a.profile === "backoffice" && !a.exists);
  const missingSupplier = !!accounts && accounts.some((a) => a.profile === "fornecedor" && !a.ready);

  return (
    <Collapsible className="mt-6 pt-4 border-t border-border" defaultOpen={false}>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <span className="font-medium flex items-center gap-2">
          Acessos de demonstração
          {accounts && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold">
              {ready}/{total} prontos
            </span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 group-data-[state=open]:rotate-180 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Clique para preencher · use "Entrar" para login imediato</span>
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-1 hover:text-foreground">
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Actualizar
          </button>
        </div>

        {loading && !accounts && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A verificar contas demo...
          </div>
        )}

        <div className="grid gap-1.5 max-h-72 overflow-y-auto pr-1">
          {(accounts ?? []).map((a) => {
            const meta = ROLE_META[a.role] ?? { icon: Shield, color: "text-muted-foreground" };
            const Icon = meta.icon;
            const statusLabel = !a.exists
              ? "Não existe"
              : a.profile === "fornecedor" && a.supplier_status && a.supplier_status !== "Ativo"
                ? a.supplier_status
                : a.ready ? "Pronto" : "Sem perfil";
            const statusClass = !a.exists
              ? "bg-destructive/10 text-destructive border-destructive/30"
              : a.ready
                ? "bg-success/10 text-success border-success/30"
                : "bg-warning/10 text-warning border-warning/30";

            return (
              <div key={a.email} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-card/40">
                <button
                  type="button"
                  onClick={() => onSelect(a)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-primary transition-colors"
                  title="Preencher campos"
                >
                  <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate flex items-center gap-1.5">
                      {a.label}
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full border font-semibold", statusClass)}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{a.email}</div>
                  </div>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant={a.ready ? "default" : "outline"}
                  disabled={!a.ready || busy}
                  onClick={() => onLogin(a)}
                  className="h-7 px-2 text-[11px]"
                  title={a.ready ? "Entrar com 1 clique" : "Conta indisponível — recrie as contas demo"}
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><LogIn className="h-3 w-3 mr-1" />Entrar</>}
                </Button>
              </div>
            );
          })}
        </div>

        {(missingBackoffice || missingSupplier) && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            {missingBackoffice && (
              <Button type="button" size="sm" variant="outline" onClick={onSeedBackoffice} disabled={busy} className="text-xs">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Criar contas de backoffice em falta
              </Button>
            )}
            {missingSupplier && (
              <Button type="button" size="sm" variant="outline" onClick={onSeedSupplier} disabled={seedingSupplier} className="text-xs">
                {seedingSupplier ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Store className="h-3.5 w-3.5 mr-1" />}
                Criar conta de fornecedor demo
              </Button>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default Auth;
