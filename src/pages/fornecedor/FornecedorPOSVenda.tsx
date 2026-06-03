import { useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import Mosap3PayPOS from "@/pages/Mosap3PayPOS";
import ShiftGate from "@/components/fornecedor/ShiftGate";
import type { PosShiftSession } from "@/hooks/usePosShift";

const FornecedorPOSVenda = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string; name?: string } }>();
  const [shift, setShift] = useState<PosShiftSession | null>(null);
  const onShiftReady = useCallback((s: PosShiftSession) => setShift(s), []);
  if (!supplier?.id) return null;

  return (
    <ShiftGate supplierId={supplier.id} supplierName={supplier.name} onShiftReady={onShiftReady}>
      {shift && (
        <Mosap3PayPOS
          forcedSupplierId={supplier.id}
          shiftContext={{
            shift_id: shift.shift_id,
            seller_id: shift.seller_id,
            seller_name: shift.seller_name,
            pos_id: shift.pos_id,
          }}
        />
      )}
    </ShiftGate>
  );
};

export default FornecedorPOSVenda;
