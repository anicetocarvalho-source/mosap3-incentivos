import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

const AcessoNegado = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <ShieldX className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-heading font-bold mb-2">Acesso Negado</h1>
      <p className="text-muted-foreground max-w-md mb-6">
        Não tem permissão para aceder a este módulo. Contacte o administrador do sistema se acredita que isto é um erro.
      </p>
      <Button onClick={() => navigate("/")} variant="default">
        Voltar ao Dashboard
      </Button>
    </div>
  );
};

export default AcessoNegado;
