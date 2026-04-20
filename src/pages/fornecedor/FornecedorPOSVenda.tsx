import { useOutletContext } from "react-router-dom";
import Mosap3PayPOS from "@/pages/Mosap3PayPOS";

const FornecedorPOSVenda = () => {
  const { supplier } = useOutletContext<{ supplier: { id: string } }>();
  if (!supplier?.id) return null;
  return <Mosap3PayPOS forcedSupplierId={supplier.id} />;
};

export default FornecedorPOSVenda;
