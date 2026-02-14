import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TransactionRegistrationFormProps {
  farmerCode: string;
  onSuccess: () => void;
}

const TransactionRegistrationForm = ({ farmerCode, onSuccess }: TransactionRegistrationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    product: "",
    empresa: "",
    valor: "",
    transaction_date: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product || !form.empresa || !form.valor) {
      toast.error("Produto, empresa e valor são obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("farmer_transactions").insert({
        farmer_code: farmerCode,
        product: form.product.trim(),
        empresa: form.empresa.trim(),
        valor: form.valor,
        transaction_date: form.transaction_date || null,
      });

      if (error) throw error;

      toast.success("Transação registada com sucesso!");
      setForm({ product: "", empresa: "", valor: "", transaction_date: "" });
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar transação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label>Produto *</Label>
        <Input
          placeholder="Ex: Enxadas, Sementes, Fertilizante..."
          value={form.product}
          onChange={(e) => setForm({ ...form, product: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Empresa *</Label>
        <Input
          placeholder="Nome da empresa fornecedora"
          value={form.empresa}
          onChange={(e) => setForm({ ...form, empresa: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor (Kz) *</Label>
          <Input
            placeholder="Ex: 15.000"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Data da Transação</Label>
          <Input
            type="date"
            value={form.transaction_date}
            onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Registar Transação
      </Button>
    </form>
  );
};

export default TransactionRegistrationForm;
