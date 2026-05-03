import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ShieldCheck, Loader2 } from "lucide-react";
import mosapLogo from "@/assets/mosap3-logo.png";

interface VerificationData {
  farmer_name: string;
  farmer_code: string;
  status: string;
  province: string | null;
  has_credit: boolean;
  card_status: string;
  updated_at: string;
}

const VerificacaoCartao = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    async function verify() {
      // Get card by token
      const { data: card, error } = await supabase
        .from("farmer_cards")
        .select("*")
        .eq("card_token", token)
        .maybeSingle();

      if (error || !card) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Get farmer info (limited)
      const { data: farmer } = await supabase
        .from("farmers")
        .select("full_name, code, status, province, valor_recebido")
        .eq("code", card.farmer_code)
        .maybeSingle();

      if (!farmer) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const hasCredit = farmer.valor_recebido && parseFloat(
        (farmer.valor_recebido || "0").replace(/[^\d,-]/g, "").replace(",", ".")
      ) > 0;

      setData({
        farmer_name: farmer.full_name,
        farmer_code: farmer.code,
        status: farmer.status || "Pendente",
        province: farmer.province,
        has_credit: !!hasCredit,
        card_status: card.status,
        updated_at: card.updated_at,
      });
      setLoading(false);
    }

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Cartão Não Encontrado</h2>
            <p className="text-muted-foreground">
              O cartão com este token de verificação não foi encontrado ou foi revogado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = data!.card_status !== "Revogado" &&
    (data!.status === "Aprovado" || data!.status === "Ativo" || data!.status === "Validado");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-2">
          <img src={mosapLogo} alt="MOSAP3" className="h-12 w-12 rounded-full mx-auto mb-2" />
          <CardTitle className="text-lg">Verificação de Cartão MOSAP3</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            {isActive ? (
              <>
                <ShieldCheck className="h-8 w-8 text-success" />
                <span className="text-lg font-semibold text-success">Cartão Válido</span>
              </>
            ) : (
              <>
                <XCircle className="h-8 w-8 text-destructive" />
                <span className="text-lg font-semibold text-destructive">Cartão Inválido</span>
              </>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome:</span>
              <span className="font-medium">{data!.farmer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID SIGAF:</span>
              <span className="font-mono">{data!.farmer_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado:</span>
              <Badge variant={isActive ? "default" : "destructive"}>
                {data!.status}
              </Badge>
            </div>
            {data!.province && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Província:</span>
                <span>{data!.province}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Elegibilidade:</span>
              <Badge variant={data!.has_credit ? "default" : "outline"}>
                {data!.has_credit ? "Crédito / Incentivo" : "Sem crédito"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última actualização:</span>
              <span className="text-xs">
                {new Date(data!.updated_at).toLocaleString("pt-AO")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificacaoCartao;
