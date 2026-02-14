import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DependentRegistrationFormProps {
  farmerCode: string;
  onSuccess: () => void;
}

const relationships = ["Cônjuge", "Filho(a)", "Pai", "Mãe", "Irmão(ã)", "Avô(ó)", "Neto(a)", "Sobrinho(a)", "Tio(a)", "Outro"];
const educationLevels = ["Nenhuma", "Primário", "Secundário", "Técnico", "Superior"];

const DependentRegistrationForm = ({ farmerCode, onSuccess }: DependentRegistrationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    relationship: "",
    gender: "",
    birth_date: "",
    education: "",
    occupation: "",
  });

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.relationship) {
      toast.error("Nome e parentesco são obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("farmer_dependents").insert({
        farmer_code: farmerCode,
        name: form.name.trim(),
        relationship: form.relationship,
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        age: calculateAge(form.birth_date),
        education: form.education || null,
        occupation: form.occupation || null,
      });

      if (error) throw error;

      toast.success("Dependente registado com sucesso!");
      setForm({ name: "", relationship: "", gender: "", birth_date: "", education: "", occupation: "" });
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao registar dependente: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label>Nome Completo *</Label>
        <Input
          placeholder="Nome do dependente"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Parentesco *</Label>
          <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {relationships.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Género</Label>
          <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de Nascimento</Label>
          <Input
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Escolaridade</Label>
          <Select value={form.education} onValueChange={(v) => setForm({ ...form, education: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {educationLevels.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Ocupação</Label>
        <Input
          placeholder="Ex: Estudante, Agricultor..."
          value={form.occupation}
          onChange={(e) => setForm({ ...form, occupation: e.target.value })}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Registar Dependente
      </Button>
    </form>
  );
};

export default DependentRegistrationForm;
