import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { SimStatusBadge } from "./SimStatusBadge";
import { Loader2 } from "lucide-react";

type Entry = {
  id: string;
  old_status: string | null;
  new_status: string;
  source: string;
  notes: string | null;
  changed_by_name: string | null;
  created_at: string;
};

export function SimStatusHistoryDrawer({
  farmerCode,
  farmerName,
  open,
  onOpenChange,
}: {
  farmerCode: string | null;
  farmerName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !farmerCode) return;
    setLoading(true);
    supabase
      .from("sim_status_history")
      .select("id, old_status, new_status, source, notes, changed_by_name, created_at")
      .eq("farmer_code", farmerCode)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows((data as Entry[]) || []);
        setLoading(false);
      });
  }, [open, farmerCode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico do Estado SIM</SheetTitle>
          <SheetDescription>{farmerName} · {farmerCode}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sem alterações registadas.</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="border rounded-md p-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <SimStatusBadge status={r.old_status} />
                <span className="text-muted-foreground">→</span>
                <SimStatusBadge status={r.new_status} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-AO")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Fonte: <span className="font-medium">{r.source}</span>
                {r.changed_by_name && <> · por {r.changed_by_name}</>}
              </div>
              {r.notes && <p className="text-xs italic">{r.notes}</p>}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
