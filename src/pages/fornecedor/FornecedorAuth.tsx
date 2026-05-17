import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Lock, UserPlus, LogIn, Store, Plus, Trash2, MapPin, User, ArrowLeft, Info } from "lucide-react";
import { mosapLogo, LOGO_SIZES } from "@/config/brand";

interface StoreForm {
  name: string;
  address: string;
  province: string;
  municipality: string;
  phone: string;
  manager_name: string;
  manager_phone: string;
}

const emptyStore = (): StoreForm => ({
  name: "", address: "", province: "", municipality: "",
  phone: "", manager_name: "", manager_phone: "",
});

const FornecedorAuth = () => {
  const [isLogin, setIsLogin] = useState(false);
  const [step, setStep] = useState(1); // 1 = dados empresa, 2 = lojas, 3 = credenciais
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nif, setNif] = useState("");
  const [phone, setPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [stores, setStores] = useState<StoreForm[]>([emptyStore()]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) { toast.error("Preencha todos os campos"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
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
    const validStores = stores.filter(s => s.name.trim());
    if (validStores.length === 0) {
      toast.error("Adicione pelo menos uma loja com nome");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + "/fornecedor/login", data: { full_name: fullName } },
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (!data.user) { toast.error("Erro ao criar conta"); setLoading(false); return; }

    const { data: supplierData, error: supError } = await supabase.from("suppliers").insert({
      user_id: data.user.id, name: companyName, nif: nif || null,
      phone: phone || null, email, address: companyAddress || null, status: "Pendente",
    }).select("id").single();

    if (supError || !supplierData) {
      toast.error("Erro ao registar fornecedor: " + (supError?.message || ""));
      setLoading(false);
      return;
    }

    const storeRows = validStores.map(s => ({
      supplier_id: supplierData.id,
      name: s.name.trim(),
      address: s.address || null,
      province: s.province || null,
      municipality: s.municipality || null,
      phone: s.phone || null,
      manager_name: s.manager_name || null,
      manager_phone: s.manager_phone || null,
    }));

    const { error: storeError } = await supabase.from("supplier_stores" as any).insert(storeRows as any);
    if (storeError) {
      console.error("Erro ao criar lojas:", storeError);
    }

    toast.success("Registo efetuado! A sua conta será activada pelo administrador.");
    setIsLogin(true);
    setStep(1);
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) { handleLogin(); return; }
    if (step < 3) { setStep(step + 1); return; }
    handleRegister();
  };

  const updateStore = (idx: number, field: keyof StoreForm, value: string) => {
    setStores(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const addStore = () => setStores(prev => [...prev, emptyStore()]);
  const removeStore = (idx: number) => {
    if (stores.length <= 1) return;
    setStores(prev => prev.filter((_, i) => i !== idx));
  };

  const canAdvance = () => {
    if (step === 1) return fullName && companyName;
    if (step === 2) return stores.some(s => s.name.trim());
    if (step === 3) return email && password;
    return false;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, hsl(130 55% 25%), hsl(150 25% 12%))" }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="flex items-center gap-1.5 text-xs text-primary-foreground/80 hover:text-primary-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao acesso Backoffice
        </button>
        <div className="flex flex-col items-center mb-6">
          <div className="bg-card rounded-2xl p-3 mb-3 shadow-lg">
            <img src={mosapLogo} alt="MOSAP3" className="h-14 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground font-heading">MOSAP3Pay</h1>
          <p className="text-sm mt-1 text-primary-foreground/70">Portal do Fornecedor</p>
        </div>

        <Card className="p-6 shadow-xl">
          {/* Aviso de rota legada */}
          <div className="flex items-start gap-2 bg-info/10 border border-info/20 text-info-foreground rounded-lg px-3 py-2.5 mb-4 text-xs">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-info" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Esta página destina-se apenas ao registo de novas empresas.</p>
              <p className="text-muted-foreground">
                Se já tem conta, faça login em{" "}
                <button type="button" onClick={() => navigate("/auth?profile=fornecedor")} className="underline font-medium text-primary hover:text-primary/80">
                  /auth (Portal do Fornecedor)
                </button>.
              </p>
            </div>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-lg bg-muted p-1 mb-5">
            <button type="button" onClick={() => navigate("/auth?profile=fornecedor")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
              title="O login foi movido para /auth — clique para ir">
              <LogIn className="h-4 w-4" /> Entrar
            </button>
            <button type="button" onClick={() => { setIsLogin(false); setStep(1); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${!isLogin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              <UserPlus className="h-4 w-4" /> Registar
            </button>
          </div>

          {/* Step indicator for register */}
          {!isLogin && (
            <div className="flex items-center gap-2 mb-5">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-1.5 w-full rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
                  <span className={`text-[10px] ${s <= step ? "text-foreground" : "text-muted-foreground"}`}>
                    {s === 1 ? "Empresa" : s === 2 ? "Lojas" : "Acesso"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {/* LOGIN */}
              {isLogin && (
                <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" placeholder="email@empresa.ao" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* REGISTER STEP 1 - Company */}
              {!isLogin && step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome completo do responsável *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Ex: João Manuel Silva" value={fullName} onChange={e => setFullName(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome da empresa / razão social *</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Ex: AgroSupply Angola, Lda" value={companyName} onChange={e => setCompanyName(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>NIF</Label>
                      <Input placeholder="NIF da empresa" value={nif} onChange={e => setNif(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone geral</Label>
                      <Input placeholder="+244 ..." value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Endereço da sede</Label>
                    <Input placeholder="Rua, Bairro, Cidade" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} />
                  </div>
                </motion.div>
              )}

              {/* REGISTER STEP 2 - Stores */}
              {!isLogin && step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Lojas / Pontos de Venda</p>
                    <Button type="button" variant="outline" size="sm" onClick={addStore} className="gap-1">
                      <Plus className="h-3.5 w-3.5" /> Adicionar loja
                    </Button>
                  </div>

                  <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                    {stores.map((store, idx) => (
                      <div key={idx} className="border border-border rounded-lg p-3 space-y-3 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" /> Loja {idx + 1}
                          </span>
                          {stores.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeStore(idx)} className="h-7 w-7 p-0 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome da loja *</Label>
                          <Input placeholder="Ex: Loja Central Luanda" value={store.name} onChange={e => updateStore(idx, "name", e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Endereço</Label>
                          <Input placeholder="Rua, Bairro" value={store.address} onChange={e => updateStore(idx, "address", e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Província</Label>
                            <Input placeholder="Luanda" value={store.province} onChange={e => updateStore(idx, "province", e.target.value)} className="h-9 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Município</Label>
                            <Input placeholder="Viana" value={store.municipality} onChange={e => updateStore(idx, "municipality", e.target.value)} className="h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Telefone da loja</Label>
                          <Input placeholder="+244 ..." value={store.phone} onChange={e => updateStore(idx, "phone", e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Responsável da loja</Label>
                            <Input placeholder="Nome do gerente" value={store.manager_name} onChange={e => updateStore(idx, "manager_name", e.target.value)} className="h-9 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tel. responsável</Label>
                            <Input placeholder="+244 ..." value={store.manager_phone} onChange={e => updateStore(idx, "manager_phone", e.target.value)} className="h-9 text-sm" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* REGISTER STEP 3 - Credentials */}
              {!isLogin && step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <p className="text-sm text-muted-foreground">Defina as credenciais de acesso à plataforma.</p>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" placeholder="email@empresa.ao" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
                    <p className="font-medium text-xs text-muted-foreground">Resumo do registo</p>
                    <p><span className="text-muted-foreground">Empresa:</span> {companyName}</p>
                    <p><span className="text-muted-foreground">Responsável:</span> {fullName}</p>
                    <p><span className="text-muted-foreground">Lojas:</span> {stores.filter(s => s.name.trim()).length}</p>
                    {stores.filter(s => s.name.trim()).map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground pl-3">• {s.name}{s.province ? ` (${s.province})` : ""}</p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex gap-2">
              {!isLogin && step > 1 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                  Voltar
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={loading || (!isLogin && !canAdvance())}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  isLogin ? "Entrar" :
                  step < 3 ? "Continuar" : "Criar conta de fornecedor"}
              </Button>
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {isLogin
              ? "Após o registo, a sua conta será activada pelo administrador do MOSAP3."
              : step === 2
                ? "Pode adicionar mais lojas depois no painel de gestão."
                : "Ao registar-se, concorda com os termos de utilização da plataforma."}
          </p>
        </Card>
      </motion.div>
    </div>
  );
};

export default FornecedorAuth;
