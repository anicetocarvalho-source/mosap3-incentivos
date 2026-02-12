import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, User, MapPin, Phone, CreditCard, Wheat, Calendar, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const farmersData: Record<string, any> = {
  "AGR-001": {
    id: "AGR-001", name: "João Mateus", bi: "001234567LA042", phone: "923 456 789", gender: "Masculino", birthDate: "15/03/1985", province: "Benguela", municipality: "Caimbambo", commune: "Caimbambo", village: "Aldeia Saca", school: "EC Caimbambo", status: "Ativo", registeredAt: "05/01/2025",
    estadoProdutor: "Em produção",
    parcels: [
      { id: "PRC-001", culture: "Milho", area: "2.5 ha", lat: "-12.5678", lon: "14.2345", status: "Verificada" },
      { id: "PRC-002", culture: "Feijão", area: "2.0 ha", lat: "-12.5690", lon: "14.2360", status: "Verificada" },
    ],
    production: [
      { culture: "Milho", area: "2.5 ha", planted: "15/10/2025", expected: "15/03/2026", currentPhase: "Pós-Colheita", status: "Colhida", estimatedYield: "5.000 kg", actualYield: "4.800 kg" },
      { culture: "Feijão", area: "2.0 ha", planted: "20/10/2025", expected: "20/02/2026", currentPhase: "Crescimento", status: "Em Crescimento", estimatedYield: "2.000 kg", actualYield: "-" },
    ],
    valorRecebido: "1.017.600,00", totalGasto: "199.800,00", saldoFinal: "817.800,00",
    transactions: [
      { product: "Ad-Composto-50Kg", empresa: "AGROSAPI", valor: "38.000,00", date: "2025-09-01" },
      { product: "S-Feijao-25kg", empresa: "AGROSAPI", valor: "20.000,00", date: "2025-09-01" },
      { product: "F-Enxada-3u", empresa: "AGROSAPI", valor: "15.000,00", date: "2025-09-01" },
      { product: "F-Catana-1u", empresa: "AGROSAPI", valor: "2.650,00", date: "2025-09-01" },
      { product: "Q-Insecticidas-0", empresa: "AGROSAPI", valor: "1.500,00", date: "2025-09-01" },
      { product: "F-Catana-2u", empresa: "TOPO AGRO", valor: "5.000,00", date: "2025-08-22" },
    ],
    dependentes: [
      { name: "Maria José Mateus", relationship: "Cônjuge", gender: "Feminino", birthDate: "20/06/1988", age: 37, education: "Ensino Primário", occupation: "Agricultora" },
      { name: "António Mateus", relationship: "Filho", gender: "Masculino", birthDate: "10/03/2005", age: 20, education: "Ensino Secundário", occupation: "Estudante" },
      { name: "Luísa Mateus", relationship: "Filha", gender: "Feminino", birthDate: "15/08/2010", age: 15, education: "Ensino Primário", occupation: "Estudante" },
      { name: "Pedro Mateus", relationship: "Filho", gender: "Masculino", birthDate: "22/01/2015", age: 11, education: "Ensino Primário", occupation: "Estudante" },
      { name: "Rosa Mateus", relationship: "Mãe", gender: "Feminino", birthDate: "05/04/1958", age: 67, education: "Sem escolaridade", occupation: "Doméstica" },
    ],
  },
  "AGR-002": {
    id: "AGR-002", name: "Maria Silva", bi: "002345678LA043", phone: "924 567 890", gender: "Feminino", birthDate: "22/07/1990", province: "Huambo", municipality: "Longonjo", commune: "Longonjo", village: "Aldeia Chiva", school: "EC Longonjo", status: "Pendente", registeredAt: "10/01/2025",
    estadoProdutor: "Em produção",
    parcels: [{ id: "PRC-003", culture: "Mandioca", area: "3.2 ha", lat: "-14.9180", lon: "13.4920", status: "Pendente" }],
    production: [{ culture: "Mandioca", area: "3.2 ha", planted: "01/09/2025", expected: "01/06/2026", currentPhase: "Crescimento", status: "Em Crescimento", estimatedYield: "8.000 kg", actualYield: "-" }],
    valorRecebido: "500.000,00", totalGasto: "0,00", saldoFinal: "500.000,00",
    transactions: [],
    dependentes: [
      { name: "José Silva", relationship: "Cônjuge", gender: "Masculino", birthDate: "14/02/1987", age: 38, education: "Ensino Secundário", occupation: "Agricultor" },
      { name: "Ana Silva", relationship: "Filha", gender: "Feminino", birthDate: "30/11/2012", age: 13, education: "Ensino Primário", occupation: "Estudante" },
    ],
  },
  "AGR-003": {
    id: "AGR-003", name: "Pedro Neto", bi: "003456789LA044", phone: "925 678 901", gender: "Masculino", birthDate: "03/11/1978", province: "Bié", municipality: "Cuemba", commune: "Cuemba", village: "Aldeia Soqui", school: "EC Cuemba", status: "Ativo", registeredAt: "15/01/2025",
    estadoProdutor: "Em produção",
    parcels: [{ id: "PRC-004", culture: "Soja", area: "4.0 ha", lat: "-12.3456", lon: "13.5432", status: "Verificada" }, { id: "PRC-005", culture: "Amendoim", area: "1.8 ha", lat: "-12.3470", lon: "13.5445", status: "Verificada" }],
    production: [
      { culture: "Soja", area: "4.0 ha", planted: "10/10/2025", expected: "10/03/2026", currentPhase: "Pós-Colheita", status: "Colhida", estimatedYield: "6.400 kg", actualYield: "6.100 kg" },
      { culture: "Amendoim", area: "1.8 ha", planted: "05/11/2025", expected: "05/04/2026", currentPhase: "Sementeira", status: "Semeada", estimatedYield: "1.800 kg", actualYield: "-" },
    ],
    valorRecebido: "850.000,00", totalGasto: "120.000,00", saldoFinal: "730.000,00",
    transactions: [{ product: "S-Soja-50kg", empresa: "SemPro Angola", valor: "60.000,00", date: "2025-10-05" }],
    dependentes: [
      { name: "Joana Neto", relationship: "Cônjuge", gender: "Feminino", birthDate: "18/04/1980", age: 45, education: "Ensino Primário", occupation: "Agricultora" },
      { name: "Miguel Neto", relationship: "Filho", gender: "Masculino", birthDate: "07/07/2002", age: 23, education: "Ensino Secundário", occupation: "Agricultor" },
      { name: "Clara Neto", relationship: "Filha", gender: "Feminino", birthDate: "25/12/2008", age: 17, education: "Ensino Secundário", occupation: "Estudante" },
    ],
  },
};

const FichaProdutor = () => {
  const { id } = useParams();
  const farmer = farmersData[id || ""];

  if (!farmer) {
    return (
      <div className="space-y-6">
        <Link to="/agricultores"><Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button></Link>
        <p className="text-muted-foreground">Produtor não encontrado.</p>
      </div>
    );
  }

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* Screen-only header */}
      <div className="flex items-center justify-between print:hidden">
        <Link to={`/agricultores/${farmer.id}`}>
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar ao perfil</Button>
        </Link>
        <Button onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" />Imprimir Ficha</Button>
      </div>

      {/* Printable content */}
      <div className="bg-card border rounded-lg p-8 print:border-0 print:shadow-none print:p-4 space-y-6 text-sm" id="ficha-produtor">
        {/* Header */}
        <div className="text-center border-b border-border pb-4">
          <h1 className="text-xl font-bold font-heading">FICHA DO PRODUTOR</h1>
          <p className="text-xs text-muted-foreground mt-1">Programa MOSAP III — Ficha Individual de Produtor</p>
        </div>

        {/* Section 1: Personal Info */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />1. Dados Pessoais
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground text-xs">Nome Completo:</span><p className="font-semibold">{farmer.name}</p></div>
            <div><span className="text-muted-foreground text-xs">Nº BI:</span><p className="font-semibold font-mono">{farmer.bi}</p></div>
            <div><span className="text-muted-foreground text-xs">Telefone:</span><p className="font-semibold">{farmer.phone}</p></div>
            <div><span className="text-muted-foreground text-xs">Género:</span><p className="font-semibold">{farmer.gender}</p></div>
            <div><span className="text-muted-foreground text-xs">Data de Nascimento:</span><p className="font-semibold">{farmer.birthDate}</p></div>
            <div><span className="text-muted-foreground text-xs">Estado:</span>
              <Badge variant={farmer.status === "Ativo" ? "default" : "secondary"} className="mt-0.5">{farmer.status}</Badge>
            </div>
            <div><span className="text-muted-foreground text-xs">Estado na ECA:</span>
              <Badge variant="outline" className="mt-0.5">{farmer.estadoProdutor || "Em produção"}</Badge>
            </div>
            <div><span className="text-muted-foreground text-xs">Data de Registo:</span><p className="font-semibold">{farmer.registeredAt}</p></div>
          </div>
        </div>

        {/* Section 2: Location */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />2. Localização
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2">
            <div><span className="text-muted-foreground text-xs">Província:</span><p className="font-semibold">{farmer.province}</p></div>
            <div><span className="text-muted-foreground text-xs">Município:</span><p className="font-semibold">{farmer.municipality}</p></div>
            <div><span className="text-muted-foreground text-xs">Comuna:</span><p className="font-semibold">{farmer.commune}</p></div>
            <div><span className="text-muted-foreground text-xs">Aldeia:</span><p className="font-semibold">{farmer.village}</p></div>
            <div><span className="text-muted-foreground text-xs">Escola de Campo:</span><p className="font-semibold">{farmer.school}</p></div>
          </div>
        </div>

        {/* Section 3: Parcels */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />3. Parcelas ({farmer.parcels.length})
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border-b border-border">ID</th>
                <th className="text-left px-3 py-2 border-b border-border">Cultura</th>
                <th className="text-right px-3 py-2 border-b border-border">Área</th>
                <th className="text-left px-3 py-2 border-b border-border">Coordenadas</th>
                <th className="text-left px-3 py-2 border-b border-border">Estado</th>
              </tr>
            </thead>
            <tbody>
              {farmer.parcels.map((p: any) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono">{p.id}</td>
                  <td className="px-3 py-2">{p.culture}</td>
                  <td className="px-3 py-2 text-right font-semibold">{p.area}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{p.lat}, {p.lon}</td>
                  <td className="px-3 py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Production */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <Wheat className="h-4 w-4 text-primary" />4. Produção ({farmer.production.length})
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border-b border-border">Cultura</th>
                <th className="text-right px-3 py-2 border-b border-border">Área</th>
                <th className="text-left px-3 py-2 border-b border-border">Plantio</th>
                <th className="text-left px-3 py-2 border-b border-border">Colheita Prev.</th>
                <th className="text-left px-3 py-2 border-b border-border">Fase Actual</th>
                <th className="text-left px-3 py-2 border-b border-border">Estado</th>
                <th className="text-right px-3 py-2 border-b border-border">Est. (kg)</th>
                <th className="text-right px-3 py-2 border-b border-border">Real (kg)</th>
              </tr>
            </thead>
            <tbody>
              {farmer.production.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">Sem produção registada</td></tr>
              ) : farmer.production.map((p: any, i: number) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{p.culture}</td>
                  <td className="px-3 py-2 text-right">{p.area}</td>
                  <td className="px-3 py-2">{p.planted}</td>
                  <td className="px-3 py-2">{p.expected}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{p.currentPhase}</Badge></td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 text-right">{p.estimatedYield}</td>
                  <td className="px-3 py-2 text-right font-semibold">{p.actualYield}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 5: Financial */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />5. Resumo Financeiro
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Recebido</p>
              <p className="font-bold text-primary">{farmer.valorRecebido} Kz</p>
            </div>
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Gasto</p>
              <p className="font-bold text-destructive">{farmer.totalGasto} Kz</p>
            </div>
            <div className="border border-border rounded p-3 text-center">
              <p className="text-xs text-muted-foreground">Saldo Final</p>
              <p className="font-bold">{farmer.saldoFinal} Kz</p>
            </div>
          </div>
          {farmer.transactions.length > 0 && (
            <table className="w-full text-xs border border-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 border-b border-border">Produto</th>
                  <th className="text-left px-3 py-2 border-b border-border">Empresa</th>
                  <th className="text-right px-3 py-2 border-b border-border">Valor</th>
                  <th className="text-left px-3 py-2 border-b border-border">Data</th>
                </tr>
              </thead>
              <tbody>
                {farmer.transactions.map((t: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{t.product}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.empresa}</td>
                    <td className="px-3 py-2 text-right font-semibold">{t.valor} Kz</td>
                    <td className="px-3 py-2">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Section 6: Dependents */}
        <div>
          <h2 className="font-heading font-semibold text-base border-b border-border pb-1 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />6. Agregado Familiar ({farmer.dependentes?.length || 0})
          </h2>
          <table className="w-full text-xs border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border-b border-border">Nome</th>
                <th className="text-left px-3 py-2 border-b border-border">Parentesco</th>
                <th className="text-left px-3 py-2 border-b border-border">Género</th>
                <th className="text-left px-3 py-2 border-b border-border">Data Nasc.</th>
                <th className="text-center px-3 py-2 border-b border-border">Idade</th>
                <th className="text-left px-3 py-2 border-b border-border">Escolaridade</th>
                <th className="text-left px-3 py-2 border-b border-border">Ocupação</th>
              </tr>
            </thead>
            <tbody>
              {(!farmer.dependentes || farmer.dependentes.length === 0) ? (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Sem dependentes</td></tr>
              ) : farmer.dependentes.map((d: any, i: number) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2">{d.relationship}</td>
                  <td className="px-3 py-2">{d.gender}</td>
                  <td className="px-3 py-2">{d.birthDate}</td>
                  <td className="px-3 py-2 text-center">{d.age}</td>
                  <td className="px-3 py-2">{d.education}</td>
                  <td className="px-3 py-2">{d.occupation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-4 mt-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-muted-foreground mb-8">Assinatura do Produtor</p>
              <div className="border-b border-border" />
              <p className="text-xs text-muted-foreground mt-1">{farmer.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-8">Assinatura do Técnico</p>
              <div className="border-b border-border" />
              <p className="text-xs text-muted-foreground mt-1">Técnico responsável</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-6">Documento gerado automaticamente pelo MOSAP III — {new Date().toLocaleDateString("pt-AO")}</p>
        </div>
      </div>
    </div>
  );
};

export default FichaProdutor;
