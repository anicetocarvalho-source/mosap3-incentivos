import { useState, useEffect } from "react";
import { Shield, Search, Filter, Download, Clock, User, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-primary/10 text-primary border-primary/20",
  update: "bg-info/10 text-info border-info/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
  stock_movement: "bg-warning/10 text-warning border-warning/20",
  login: "bg-success/10 text-success border-success/20",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Actualização",
  delete: "Eliminação",
  stock_movement: "Mov. Stock",
  login: "Login",
};

const ENTITY_LABELS: Record<string, string> = {
  credit_note: "Nota de Crédito",
  pos_sale: "Venda POS",
  supplier_product: "Produto",
  supplier: "Fornecedor",
  farmer: "Produtor",
};

const Mosap3PayAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLogs((data as AuditLog[]) || []);
    setLoading(false);
  };

  const filtered = logs.filter(log => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterEntity !== "all" && log.entity_type !== filterEntity) return false;
    if (search) {
      const s = search.toLowerCase();
      return (log.user_name || "").toLowerCase().includes(s) ||
        (log.entity_id || "").toLowerCase().includes(s) ||
        log.action.toLowerCase().includes(s) ||
        log.entity_type.toLowerCase().includes(s);
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ["Data", "Utilizador", "Acção", "Entidade", "ID", "Detalhes"];
    const rows = filtered.map(l => [
      new Date(l.created_at).toLocaleString("pt-AO"),
      l.user_name || "—",
      l.action,
      l.entity_type,
      l.entity_id || "—",
      JSON.stringify(l.details || {}),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exportados para CSV");
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueEntities = [...new Set(logs.map(l => l.entity_type))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Logs de Auditoria
          </h1>
          <p className="text-muted-foreground text-sm">Rastreabilidade completa de acções no sistema</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground">Total Registos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{logs.filter(l => {
            const today = new Date().toDateString();
            return new Date(l.created_at).toDateString() === today;
          }).length}</p>
          <p className="text-xs text-muted-foreground">Hoje</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{new Set(logs.map(l => l.user_name)).size}</p>
          <p className="text-xs text-muted-foreground">Utilizadores</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{uniqueEntities.length}</p>
          <p className="text-xs text-muted-foreground">Tipos de Entidade</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por utilizador, entidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[160px]"><span className="flex items-center gap-1"><Filter className="h-4 w-4" /><SelectValue /></span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Acções</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Entidades</SelectItem>
            {uniqueEntities.map(e => <SelectItem key={e} value={e}>{ENTITY_LABELS[e] || e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Utilizador</TableHead>
                <TableHead>Acção</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registo</TableCell></TableRow>
              ) : filtered.slice(0, 100).map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(log.created_at).toLocaleString("pt-AO")}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {log.user_name || "Sistema"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${ACTION_COLORS[log.action] || ""}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{ENTITY_LABELS[log.entity_type] || log.entity_type}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">{log.entity_id || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetailLog(log)}>
                      <FileText className="h-3 w-3 mr-1" /> Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 100 && (
            <p className="text-center text-xs text-muted-foreground py-2">A mostrar 100 de {filtered.length} registos</p>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={o => !o && setDetailLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhe do Registo</DialogTitle></DialogHeader>
          {detailLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(detailLog.created_at).toLocaleString("pt-AO")}</span></div>
                <div><span className="text-muted-foreground">Utilizador:</span> <span className="font-medium">{detailLog.user_name || "Sistema"}</span></div>
                <div><span className="text-muted-foreground">Acção:</span> <Badge variant="outline" className={`text-[10px] ${ACTION_COLORS[detailLog.action] || ""}`}>{ACTION_LABELS[detailLog.action] || detailLog.action}</Badge></div>
                <div><span className="text-muted-foreground">Entidade:</span> <span className="font-medium">{ENTITY_LABELS[detailLog.entity_type] || detailLog.entity_type}</span></div>
              </div>
              {detailLog.entity_id && (
                <div className="text-sm"><span className="text-muted-foreground">ID:</span> <code className="text-xs bg-muted px-1 py-0.5 rounded">{detailLog.entity_id}</code></div>
              )}
              {detailLog.details && Object.keys(detailLog.details).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Detalhes:</p>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                    {JSON.stringify(detailLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mosap3PayAuditLogs;
