import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Loader2, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";
import { usePosShift, PosShiftSession } from "@/hooks/usePosShift";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

interface ShiftGateProps {
  supplierId: string;
  supplierName?: string;
  onShiftReady: (s: PosShiftSession) => void;
  children: React.ReactNode;
}

const ShiftGate = ({ supplierId, supplierName, onShiftReady, children }: ShiftGateProps) => {
  const { shift, open, close } = usePosShift(supplierId);
  const [posList, setPosList] = useState<Array<{ id: string; pos_code: string; label: string | null }>>([]);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [posId, setPosId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("supplier_pos").select("id, pos_code, label")
        .eq("supplier_id", supplierId).order("created_at");
      setPosList(data || []);
      if (data?.length === 1) setPosId(data[0].id);
    })();
  }, [supplierId]);

  useEffect(() => { if (shift) onShiftReady(shift); }, [shift, onShiftReady]);

  const handleOpen = async () => {
    if (!username || !pin) { toast.error("Username e PIN são obrigatórios"); return; }
    setBusy(true);
    try {
      const s = await open({ username: username.trim(), pin: pin.trim(), pos_id: posId || null });
      toast.success(`Turno aberto — bem-vindo(a), ${s.seller_name}`);
      setUsername(""); setPin("");
    } catch (e: any) {
      toast.error(e?.message || "Falha no login");
    } finally { setBusy(false); }
  };

  const handleClose = async () => {
    if (!confirm("Fechar o turno actual? Não poderá registar mais vendas até abrir outro.")) return;
    setBusy(true);
    try { await close(); toast.success("Turno fechado"); }
    catch (e: any) { toast.error(e?.message || "Erro ao fechar"); }
    finally { setBusy(false); }
  };

  if (shift) {
    return (
      <div>
        <div className="bg-success/10 border border-success/30 rounded-lg p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-success/20 rounded-full p-2"><Clock className="h-4 w-4 text-success" /></div>
            <div className="text-sm">
              <p className="font-medium">Turno aberto · <span className="text-success">{shift.seller_name}</span></p>
              <p className="text-xs text-muted-foreground">Aberto há {formatDistanceToNow(new Date(shift.opened_at), { locale: pt })}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={busy}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Fechar turno
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="text-center">
          <div className="bg-primary/10 rounded-full p-3 w-fit mx-auto mb-3"><Lock className="h-6 w-6 text-primary" /></div>
          <h2 className="text-xl font-bold font-heading">Abrir turno de caixa</h2>
          <p className="text-sm text-muted-foreground">{supplierName || "Identifique-se como vendedor para iniciar vendas"}</p>
        </div>

        {posList.length > 1 && (
          <div className="space-y-1.5">
            <Label>Terminal POS</Label>
            <Select value={posId} onValueChange={setPosId}>
              <SelectTrigger><SelectValue placeholder="Escolher POS" /></SelectTrigger>
              <SelectContent>
                {posList.map((p) => <SelectItem key={p.id} value={p.id}>{p.label || p.pos_code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Username</Label>
          <Input autoFocus value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="ex: maria.silva" />
        </div>
        <div className="space-y-1.5">
          <Label>PIN</Label>
          <Input type="password" inputMode="numeric" maxLength={6} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") handleOpen(); }} />
        </div>
        <Button className="w-full" onClick={handleOpen} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Entrar e abrir turno
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Sem credenciais? <Link to="/fornecedor/vendedores" className="text-primary underline">Gerir vendedores</Link>
        </p>
      </Card>
    </div>
  );
};

export default ShiftGate;
