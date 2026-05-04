import { useState, useEffect, useCallback } from "react";
import { Fingerprint, CreditCard, CheckCircle2, XCircle, Loader2, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getFarmerBiometricSummary,
  deactivateFingerprint,
  deactivateNfcTag,
  FINGER_LABELS,
  getQualityLabel,
  type FarmerBiometricSummary,
  type FingerPosition,
} from "@/lib/deviceBridge";

interface Props {
  farmerCode: string;
  refreshKey?: number;
}

const FarmerBiometricStatus = ({ farmerCode, refreshKey }: Props) => {
  const [summary, setSummary] = useState<FarmerBiometricSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getFarmerBiometricSummary(farmerCode);
      setSummary(s);
    } catch { /* ignore */ }
    setLoading(false);
  }, [farmerCode]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        A verificar dados biométricos...
      </div>
    );
  }

  if (!summary || (!summary.hasFingerprint && !summary.hasNfc)) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
        <XCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Nenhum dado biométrico vinculado
        </span>
      </div>
    );
  }

  const handleDeactivateFp = async (id: string) => {
    await deactivateFingerprint(id);
    toast.success("Impressão digital desvinculada");
    load();
  };

  const handleDeactivateNfc = async (id: string) => {
    await deactivateNfcTag(id);
    toast.success("Tag NFC desvinculada");
    load();
  };

  return (
    <div className="space-y-2">
      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={`text-[10px] gap-1 ${summary.hasFingerprint ? "border-success/50 text-success" : "border-muted"}`}
        >
          <Fingerprint className="h-3 w-3" />
          {summary.fingerprintCount} impressão(ões)
        </Badge>
        <Badge
          variant="outline"
          className={`text-[10px] gap-1 ${summary.hasNfc ? "border-info/50 text-info" : "border-muted"}`}
        >
          <CreditCard className="h-3 w-3" />
          {summary.nfcCount} tag(s) NFC
        </Badge>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={load}>
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      {/* Fingerprint details */}
      {summary.fingerprints.length > 0 && (
        <div className="space-y-1">
          {summary.fingerprints.map((fp) => {
            const q = getQualityLabel(fp.quality_score);
            return (
              <div key={fp.id} className="flex items-center justify-between rounded bg-success/5 px-2.5 py-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span>{FINGER_LABELS[fp.finger_position]}</span>
                  <span className={`${q.color}`}>({q.label})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">
                    {new Date(fp.created_at).toLocaleDateString("pt-AO")}
                  </span>
                  <button
                    onClick={() => handleDeactivateFp(fp.id)}
                    className="text-destructive/40 hover:text-destructive p-0.5"
                    title="Desvincular"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NFC details */}
      {summary.nfcTags.length > 0 && (
        <div className="space-y-1">
          {summary.nfcTags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between rounded bg-info/5 px-2.5 py-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-info" />
                <span className="font-mono">{tag.nfc_uid}</span>
                {tag.nfc_type && tag.nfc_type !== "unknown" && (
                  <Badge variant="outline" className="text-[9px] py-0">{tag.nfc_type}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">
                  {new Date(tag.created_at).toLocaleDateString("pt-AO")}
                </span>
                <button
                  onClick={() => handleDeactivateNfc(tag.id)}
                  className="text-destructive/40 hover:text-destructive p-0.5"
                  title="Desvincular"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FarmerBiometricStatus;
