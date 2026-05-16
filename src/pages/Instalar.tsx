import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Smartphone,
  Share2,
  Copy,
  Check,
  Wifi,
  Monitor,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Info,
  Home,
  Menu,
  Plus,
  ArrowUpFromLine,
  WifiOff,
  PlugZap,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface CheckItem {
  id: string;
  label: string;
  detail?: string;
  checked: boolean;
}

interface ChecklistSection {
  title: string;
  icon: React.ReactNode;
  os: "android" | "ios";
  steps: CheckItem[];
}

const Instalar = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"android" | "ios" | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineTest, setOfflineTest] = useState<{
    running: boolean;
    results: { label: string; ok: boolean; detail?: string }[] | null;
  }>({ running: false, results: null });
  const appUrl = window.location.origin;

  // Detect if app is already installed
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  // Detect platform and auto-expand relevant section
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setExpandedSection("ios");
    } else if (/android/.test(ua)) {
      setExpandedSection("android");
    }
  }, []);

  // Listen for beforeinstallprompt (Android/Chrome)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Run a quick offline-readiness check using the cache only
  const runOfflineTest = async () => {
    setOfflineTest({ running: true, results: null });
    const targets = [
      { label: "Shell da aplicação (/)", url: "/" },
      { label: "Manifesto PWA", url: "/manifest.webmanifest" },
      { label: "Ícone principal", url: "/pwa-192x192.png" },
    ];
    const results: { label: string; ok: boolean; detail?: string }[] = [];
    for (const t of targets) {
      try {
        const res = await fetch(t.url, { cache: "force-cache" });
        results.push({
          ok: res.ok,
          label: t.label,
          detail: res.ok ? "Disponível na cache" : `HTTP ${res.status}`,
        });
      } catch (e: any) {
        results.push({ ok: false, label: t.label, detail: "Sem cache offline" });
      }
    }
    const allOk = results.every((r) => r.ok);
    setOfflineTest({ running: false, results });
    toast({
      title: allOk ? "Pronto para offline" : "Cache incompleta",
      description: allOk
        ? "Pode ativar o modo avião e abrir o MOSAP3 normalmente."
        : "Alguns recursos não estão em cache. Abra a app online uma vez para os carregar.",
    });
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    toast({ title: "Link copiado!", description: "Partilhe com os agentes de campo." });
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "MOSAP3 — Projecto Mosap3",
        text: "Instale a aplicação do Projecto Mosap3 no seu tablet ou telemóvel",
        url: appUrl,
      });
    } else {
      copyLink();
    }
  };

  const STORAGE_KEY = "mosap3-install-checklist";

  const [checklists, setChecklists] = useState<ChecklistSection[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChecklistSection[];
        if (Array.isArray(parsed) && parsed.length === 2 && parsed[0].steps && parsed[1].steps) {
          return parsed;
        }
      }
    } catch {
      // ignore parse errors
    }
    return [
      {
        title: "Android (Chrome)",
        os: "android",
        icon: <Smartphone className="h-5 w-5" />,
        steps: [
          { id: "a1", label: "Abrir o link no Chrome", detail: "Use o QR Code acima ou abra o link no navegador Chrome do dispositivo", checked: false },
          { id: "a2", label: "Toque no menu ⋮ do Chrome", detail: "No canto superior direito do navegador, toque nos três pontos verticais", checked: false },
          { id: "a3", label: "Selecionar 'Adicionar ao ecrã inicial'", detail: "Pode também aparecer como 'Instalar aplicação' no menu", checked: false },
          { id: "a4", label: "Confirmar a instalação", detail: "Toque em 'Adicionar' ou 'Instalar' no popup que aparecer", checked: false },
          { id: "a5", label: "Verificar o ícone no ecrã inicial", detail: "Deve aparecer o ícone verde MOSAP3 com o nome 'MOSAP3' por baixo", checked: false },
        ],
      },
      {
        title: "iPhone / iPad (Safari)",
        os: "ios",
        icon: <Smartphone className="h-5 w-5" />,
        steps: [
          { id: "i1", label: "Abrir o link no Safari", detail: "Use o QR Code acima ou abra o link no Safari do iPhone/iPad", checked: false },
          { id: "i2", label: "Toque no botão Partilhar", detail: "O ícone de caixa com seta para cima, na barra inferior do Safari", checked: false },
          { id: "i3", label: "Desloque e toque em 'Adicionar ao Ecrã Principal'", detail: "Pode precisar de deslizar para baixo na lista de opções de partilha", checked: false },
          { id: "i4", label: "Confirmar o nome e tocar em 'Adicionar'", detail: "O nome deve ser 'MOSAP3'. Toque em 'Adicionar' no canto superior direito", checked: false },
          { id: "i5", label: "Verificar o ícone no ecrã principal", detail: "Deve aparecer o ícone verde MOSAP3 com o nome 'MOSAP3' no ecrã principal", checked: false },
        ],
      },
    ];
  });

  // Persist checklist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists));
  }, [checklists]);

  const toggleStep = (sectionIdx: number, stepId: string) => {
    setChecklists((prev) => {
      const next = [...prev];
      const section = { ...next[sectionIdx] };
      section.steps = section.steps.map((s) =>
        s.id === stepId ? { ...s, checked: !s.checked } : s
      );
      next[sectionIdx] = section;
      return next;
    });
  };

  const resetChecklists = useCallback(() => {
    setChecklists((prev) =>
      prev.map((section) => ({
        ...section,
        steps: section.steps.map((s) => ({ ...s, checked: false })),
      }))
    );
    toast({ title: "Progresso limpo", description: "O checklist foi reiniciado." });
  }, [toast]);

  const progress = (section: ChecklistSection) => {
    const done = section.steps.filter((s) => s.checked).length;
    return { done, total: section.steps.length, pct: Math.round((done / section.steps.length) * 100) };
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="page-title">Instalar Aplicação</h1>
        <p className="text-muted-foreground text-sm">
          Siga o checklist para instalar o MOSAP3 no seu dispositivo
        </p>
      </div>

      {/* Already installed banner */}
      {isStandalone && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-success">Aplicação já instalada!</p>
            <p className="text-xs text-muted-foreground">
              Está a usar o MOSAP3 em modo de aplicação. O ícone aparece corretamente no ecrã inicial.
            </p>
          </div>
        </div>
      )}

      {/* Icon Preview */}
      <Card className="overflow-hidden">
        <div className="bg-primary/5 p-5 border-b border-border">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            Como o ícone deve aparecer
          </h3>
        </div>
        <CardContent className="p-5">
          <div className="flex items-center justify-center gap-8 py-4">
            {/* Android preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary shadow-lg flex items-center justify-center overflow-hidden">
                  <img
                    src="/pwa-192x192.png"
                    alt="Ícone MOSAP3"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-success text-white rounded-full p-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium">Android</p>
                <p className="text-[10px] text-muted-foreground">Ícone adaptativo</p>
              </div>
            </div>

            {/* iOS preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-xl bg-primary shadow-lg flex items-center justify-center overflow-hidden">
                  <img
                    src="/pwa-192x192.png"
                    alt="Ícone MOSAP3"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-success text-white rounded-full p-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium">iOS</p>
                <p className="text-[10px] text-muted-foreground">Ícone com cantos suaves</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 mt-2">
            <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Nome no ecrã:</strong> <span className="font-mono text-foreground">MOSAP3</span> (ou "MOSAP3 — Projecto Mosap3" em alguns dispositivos)
              </p>
              <p>
                <strong>Cor do ícone:</strong> Verde agrícola <span className="inline-block w-3 h-3 rounded-sm bg-primary align-middle ml-1" /> com símbolo dourado
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code */}
      <Card className="p-6 flex flex-col items-center gap-5">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-border">
          <QRCodeSVG
            value={appUrl}
            size={200}
            level="H"
            includeMargin={false}
            fgColor="#1B5E20"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">Digitalize com a câmara do dispositivo</p>
          <p className="text-xs text-muted-foreground">
            Aponte a câmara para o código QR para abrir a aplicação
          </p>
        </div>
      </Card>

      {/* Link + Actions */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Wifi className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Link da aplicação</p>
            <p className="text-sm font-mono truncate">{appUrl}</p>
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 flex-shrink-0">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={share} variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Partilhar Link
          </Button>
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="gap-2">
              <Download className="h-4 w-4" />
              Instalar Agora
            </Button>
          ) : (
            <Button disabled variant="secondary" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Abra no dispositivo
            </Button>
          )}
        </div>
      </Card>

      {/* Offline test */}
      <Card className="overflow-hidden">
        <div className="bg-primary/5 p-5 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <PlugZap className="h-4 w-4 text-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-warning" />
            )}
            <h3 className="font-heading font-semibold text-sm">Testar modo offline</h3>
          </div>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isOnline ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Confirme que o MOSAP3 abre sem internet. O teste verifica se os recursos essenciais
            estão guardados na cache do dispositivo.
          </p>

          <Button
            onClick={runOfflineTest}
            disabled={offlineTest.running}
            className="w-full gap-2"
            variant="outline"
          >
            {offlineTest.running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                A verificar cache...
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                Verificar cache offline
              </>
            )}
          </Button>

          {offlineTest.results && (
            <ul className="space-y-2 pt-1">
              {offlineTest.results.map((r) => (
                <li
                  key={r.label}
                  className="flex items-start gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2"
                >
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{r.label}</p>
                    {r.detail && <p className="text-muted-foreground">{r.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-info" />
              Teste manual completo
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Abra o MOSAP3 uma vez com internet para preencher a cache.</li>
              <li>Ative o <strong>Modo Avião</strong> no dispositivo.</li>
              <li>Feche e abra a aplicação a partir do ícone no ecrã inicial.</li>
              <li>Confirme que consegue navegar, autenticar (offline) e ver os dados em cache.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Checklists */}
      <div className="space-y-4">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Checklist de Instalação
        </h2>

        {checklists.map((section, idx) => {
          const { done, total, pct } = progress(section);
          const isOpen = expandedSection === section.os;

          return (
            <Card
              key={section.os}
              className={`overflow-hidden transition-all duration-300 ${
                isOpen ? "ring-1 ring-primary/20" : ""
              }`}
            >
              {/* Section header */}
              <button
                onClick={() => setExpandedSection(isOpen ? null : section.os)}
                className="w-full p-5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  {section.icon}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-sm">{section.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {done} de {total} passos concluídos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Progress badge */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                  {done === total ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Steps */}
              {isOpen && (
                <div className="border-t border-border px-5 pb-5">
                  {/* Mobile progress bar */}
                  <div className="sm:hidden flex items-center gap-2 py-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
                  </div>

                  <ol className="space-y-3 mt-2">
                    {section.steps.map((step, sIdx) => (
                      <li key={step.id}>
                        <button
                          onClick={() => toggleStep(idx, step.id)}
                          className="w-full flex items-start gap-3 text-left group py-1"
                        >
                          <div
                            className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                              step.checked
                                ? "bg-success text-white"
                                : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20"
                            }`}
                          >
                            {step.checked ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <span className="text-[10px] font-bold">{sIdx + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium transition-colors ${
                                step.checked ? "text-muted-foreground line-through" : "text-foreground"
                              }`}
                            >
                              {step.label}
                            </p>
                            {step.detail && (
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                {step.detail}
                              </p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>

                  {/* Visual hints for each OS */}
                  <div className="mt-4 p-4 bg-muted/40 rounded-xl">
                    {section.os === "android" ? (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Menu className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>
                          No Chrome, procure o menu <strong>⋮</strong> depois escolha{" "}
                          <strong>"Adicionar ao ecrã inicial"</strong>. Em alguns dispositivos, pode aparecer um
                          banner inferior a perguntar se quer instalar a aplicação.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <ArrowUpFromLine className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>
                          No Safari, toque no ícone <strong>Partilhar</strong>{" "}
                          <ArrowUpFromLine className="h-3 w-3 inline" /> na barra inferior, depois
                          desloque para baixo e toque em <strong>"Adicionar ao Ecrã Principal"</strong>.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Troubleshooting */}
      <Card className="p-5">
        <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-info" />
          Problemas comuns
        </h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="text-info font-bold flex-shrink-0">Q:</span>
            <div>
              <p className="font-medium text-foreground">O ícone não aparece no ecrã inicial</p>
              <p className="text-xs mt-0.5">
                Verifique se usou o Chrome (Android) ou Safari (iOS). Outros navegadores podem não suportar instalação PWA.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-info font-bold flex-shrink-0">Q:</span>
            <div>
              <p className="font-medium text-foreground">O nome aparece cortado ou diferente</p>
              <p className="text-xs mt-0.5">
                O sistema operativo pode truncar o nome. O importante é o ícone verde com o símbolo dourado ser visível.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-info font-bold flex-shrink-0">Q:</span>
            <div>
              <p className="font-medium text-foreground">A aplicação abre no navegador em vez de standalone</p>
              <p className="text-xs mt-0.5">
                Toque sempre no ícone do ecrã principal, não no atalho do navegador. Verifique se o display-mode é standalone nas definições.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Instalar;
