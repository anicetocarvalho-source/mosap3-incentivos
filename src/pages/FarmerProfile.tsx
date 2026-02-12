import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, User, MapPin, Phone, CreditCard, Wheat, ShoppingCart, Gift, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const farmersData: Record<string, any> = {
  "AGR-001": {
    id: "AGR-001", name: "João Mateus", bi: "001234567LA042", phone: "923 456 789", gender: "Masculino", birthDate: "15/03/1985", province: "Benguela", municipality: "Caimbambo", commune: "Caimbambo", village: "Aldeia Saca", school: "EC Caimbambo", status: "Ativo", registeredAt: "05/01/2025",
    parcels: [
      { id: "PRC-001", culture: "Milho", area: "2.5 ha", lat: "-12.5678", lon: "14.2345", status: "Verificada" },
      { id: "PRC-002", culture: "Feijão", area: "2.0 ha", lat: "-12.5690", lon: "14.2360", status: "Verificada" },
    ],
    production: [
      { id: "PRD-001", culture: "Milho", area: "2.5 ha", planted: "15/10/2025", expected: "15/03/2026", estimatedYield: "5.000 kg", actualYield: "4.800 kg", status: "Colhida" },
      { id: "PRD-002", culture: "Feijão", area: "2.0 ha", planted: "20/10/2025", expected: "20/02/2026", estimatedYield: "2.000 kg", actualYield: "-", status: "Em Crescimento" },
    ],
    valorRecebido: "1.017.600,00",
    totalGasto: "199.800,00",
    saldoFinal: "817.800,00",
    incentives: [
      { id: "INC-001", type: "Insumos Agrícolas", amount: "45.000 Kz", method: "Unitel Money", status: "Pago", date: "12/02/2026" },
    ],
    transactions: [
      { product: "Ad-Composto-50Kg", empresa: "AGROSAPI - COMERCIO, PRESTAÇÃO DE SERVIÇOS, IMPORTAÇÃO & EXPORTAÇÃO, (SU), LDA", valor: "38.000,00", date: "2025-09-01 10:10:09" },
      { product: "Ad-Composto-50Kg", empresa: "AGROSAPI - COMERCIO, PRESTAÇÃO DE SERVIÇOS, IMPORTAÇÃO & EXPORTAÇÃO, (SU), LDA", valor: "38.000,00", date: "2025-09-01 10:11:20" },
      { product: "S-Feijao-25kg", empresa: "AGROSAPI - COMERCIO, PRESTAÇÃO DE SERVIÇOS, IMPORTAÇÃO & EXPORTAÇÃO, (SU), LDA", valor: "20.000,00", date: "2025-09-01 10:12:59" },
      { product: "F-Enxada-3u", empresa: "AGROSAPI - COMERCIO, PRESTAÇÃO DE SERVIÇOS, IMPORTAÇÃO & EXPORTAÇÃO, (SU), LDA", valor: "15.000,00", date: "2025-09-01 10:14:31" },
      { product: "F-Catana-1u", empresa: "AGROSAPI - COMERCIO, PRESTAÇÃO DE SERVIÇOS, IMPORTAÇÃO & EXPORTAÇÃO, (SU), LDA", valor: "2.650,00", date: "2025-09-01 10:16:29" },
      { product: "Q-Insecticidas-0", empresa: "AGROSAPI - COMERCIO, PRESTAÇÃO DE SERVIÇOS, IMPORTAÇÃO & EXPORTAÇÃO, (SU), LDA", valor: "1.500,00", date: "2025-09-01 10:21:18" },
      { product: "F-Catana-2u", empresa: "TOPO AGRO - COMÉRCIO E AGROPECUÁRIA, LDA", valor: "5.000,00", date: "2025-08-22 14:38:13" },
    ],
    purchases: [
      { id: "CMP-001", empresa: "AgroSul Lda", items: "Enxada, Catana, Sementes Milho", total: "45.000,00", subsidio: "70%", valorPagar: "13.500,00", status: "Entregue", date: "12/02/2026" },
    ],
  },
  "AGR-002": {
    id: "AGR-002", name: "Maria Silva", bi: "002345678LA043", phone: "924 567 890", gender: "Feminino", birthDate: "22/07/1990", province: "Huambo", municipality: "Longonjo", commune: "Longonjo", village: "Aldeia Chiva", school: "EC Longonjo", status: "Pendente", registeredAt: "10/01/2025",
    parcels: [
      { id: "PRC-003", culture: "Mandioca", area: "3.2 ha", lat: "-14.9180", lon: "13.4920", status: "Pendente" },
    ],
    production: [
      { id: "PRD-003", culture: "Mandioca", area: "3.2 ha", planted: "01/09/2025", expected: "01/06/2026", estimatedYield: "8.000 kg", actualYield: "-", status: "Em Crescimento" },
    ],
    valorRecebido: "500.000,00",
    totalGasto: "0,00",
    saldoFinal: "500.000,00",
    incentives: [
      { id: "INC-002", type: "Sementes", amount: "30.000 Kz", method: "Unitel Money", status: "Pendente", date: "11/02/2026" },
    ],
    transactions: [],
    purchases: [],
  },
  "AGR-003": {
    id: "AGR-003", name: "Pedro Neto", bi: "003456789LA044", phone: "925 678 901", gender: "Masculino", birthDate: "03/11/1978", province: "Bié", municipality: "Cuemba", commune: "Cuemba", village: "Aldeia Soqui", school: "EC Cuemba", status: "Ativo", registeredAt: "15/01/2025",
    parcels: [
      { id: "PRC-004", culture: "Soja", area: "4.0 ha", lat: "-12.3456", lon: "13.5432", status: "Verificada" },
      { id: "PRC-005", culture: "Amendoim", area: "1.8 ha", lat: "-12.3470", lon: "13.5445", status: "Verificada" },
      { id: "PRC-006", culture: "Milho", area: "1.4 ha", lat: "-12.3480", lon: "13.5460", status: "Verificada" },
    ],
    production: [
      { id: "PRD-004", culture: "Soja", area: "4.0 ha", planted: "10/10/2025", expected: "10/03/2026", estimatedYield: "6.400 kg", actualYield: "6.100 kg", status: "Colhida" },
      { id: "PRD-005", culture: "Amendoim", area: "1.8 ha", planted: "05/11/2025", expected: "05/04/2026", estimatedYield: "1.800 kg", actualYield: "-", status: "Semeada" },
    ],
    valorRecebido: "850.000,00",
    totalGasto: "120.000,00",
    saldoFinal: "730.000,00",
    incentives: [
      { id: "INC-003", type: "Mecanização", amount: "60.000 Kz", method: "Unitel Money", status: "Pago", date: "10/02/2026" },
    ],
    transactions: [
      { product: "S-Soja-50kg", empresa: "SemPro Angola", valor: "60.000,00", date: "2025-10-05 09:30:00" },
      { product: "S-Feijao-25kg", empresa: "SemPro Angola", valor: "20.000,00", date: "2025-10-05 09:35:00" },
      { product: "F-Enxada-3u", empresa: "AGROSAPI - COMERCIO, (SU), LDA", valor: "15.000,00", date: "2025-09-20 11:00:00" },
      { product: "Ad-Fertilizante-25kg", empresa: "AGROSAPI - COMERCIO, (SU), LDA", valor: "25.000,00", date: "2025-09-20 11:10:00" },
    ],
    purchases: [
      { id: "CMP-003", empresa: "SemPro Angola", items: "Sementes Feijão, Sementes Soja", total: "30.000,00", subsidio: "80%", valorPagar: "6.000,00", status: "Aprovada", date: "10/02/2026" },
    ],
  },
  "AGR-004": {
    id: "AGR-004", name: "Ana Luísa Gomes", bi: "004567890LA045", phone: "926 789 012", gender: "Feminino", birthDate: "18/05/1992", province: "Benguela", municipality: "Lobito", commune: "Lobito", village: "Aldeia Hanha", school: "EC Lobito", status: "Ativo", registeredAt: "20/01/2025",
    parcels: [{ id: "PRC-007", culture: "Batata Doce", area: "1.8 ha", lat: "-12.3500", lon: "13.5500", status: "Verificada" }],
    production: [{ id: "PRD-006", culture: "Batata Doce", area: "1.5 ha", planted: "20/09/2025", expected: "20/01/2026", estimatedYield: "3.000 kg", actualYield: "2.750 kg", status: "Colhida" }],
    valorRecebido: "600.000,00", totalGasto: "75.000,00", saldoFinal: "525.000,00",
    incentives: [{ id: "INC-004", type: "Fertilizantes", amount: "25.000 Kz", method: "Unitel Money", status: "Processando", date: "09/02/2026" }],
    transactions: [{ product: "Ad-Composto-50Kg", empresa: "FertiPlus Lda", valor: "38.000,00", date: "2025-08-15 14:00:00" }, { product: "S-BatatDoce-10kg", empresa: "FertiPlus Lda", valor: "12.000,00", date: "2025-08-15 14:05:00" }, { product: "F-Regador-1u", empresa: "TOPO AGRO, LDA", valor: "25.000,00", date: "2025-08-10 10:00:00" }],
    purchases: [],
  },
  "AGR-005": {
    id: "AGR-005", name: "Carlos Manuel", bi: "005678901LA046", phone: "927 890 123", gender: "Masculino", birthDate: "30/09/1980", province: "Huambo", municipality: "Bailundo", commune: "Bailundo", village: "Aldeia Bimbe", school: "EC Bailundo", status: "Suspenso", registeredAt: "25/01/2025",
    parcels: [{ id: "PRC-008", culture: "Milho", area: "2.0 ha", lat: "-12.4000", lon: "15.8000", status: "Pendente" }, { id: "PRC-009", culture: "Feijão", area: "1.5 ha", lat: "-12.4010", lon: "15.8010", status: "Pendente" }],
    production: [],
    valorRecebido: "400.000,00", totalGasto: "0,00", saldoFinal: "400.000,00",
    incentives: [{ id: "INC-005", type: "Insumos Agrícolas", amount: "40.000 Kz", method: "Unitel Money", status: "Rejeitado", date: "08/02/2026" }],
    transactions: [],
    purchases: [],
  },
  "AGR-006": {
    id: "AGR-006", name: "Teresa Domingos", bi: "006789012LA047", phone: "928 901 234", gender: "Feminino", birthDate: "12/12/1988", province: "Huíla", municipality: "Lubango", commune: "Lubango", village: "Aldeia Chibia", school: "EC Lubango", status: "Ativo", registeredAt: "28/01/2025",
    parcels: [{ id: "PRC-010", culture: "Milho", area: "3.0 ha", lat: "-14.9200", lon: "13.5000", status: "Verificada" }, { id: "PRC-011", culture: "Mandioca", area: "2.1 ha", lat: "-14.9210", lon: "13.5010", status: "Verificada" }],
    production: [{ id: "PRD-007", culture: "Milho", area: "3.0 ha", planted: "12/10/2025", expected: "12/03/2026", estimatedYield: "6.000 kg", actualYield: "-", status: "Em Crescimento" }],
    valorRecebido: "750.000,00", totalGasto: "95.000,00", saldoFinal: "655.000,00",
    incentives: [{ id: "INC-006", type: "Sementes", amount: "35.000 Kz", method: "Unitel Money", status: "Pago", date: "07/02/2026" }],
    transactions: [{ product: "S-Milho-50kg", empresa: "Fazenda Verde", valor: "45.000,00", date: "2025-10-10 08:30:00" }, { product: "Ad-Fertilizante-25kg", empresa: "Fazenda Verde", valor: "25.000,00", date: "2025-10-10 08:35:00" }, { product: "F-Enxada-2u", empresa: "Fazenda Verde", valor: "10.000,00", date: "2025-10-10 08:40:00" }, { product: "Q-Insecticidas-1L", empresa: "Fazenda Verde", valor: "15.000,00", date: "2025-09-25 10:00:00" }],
    purchases: [],
  },
  "AGR-007": {
    id: "AGR-007", name: "Francisco Luís", bi: "007890123LA048", phone: "929 012 345", gender: "Masculino", birthDate: "05/06/1975", province: "Malanje", municipality: "Cacuso", commune: "Cacuso", village: "Aldeia Pungo", school: "EC Cacuso", status: "Ativo", registeredAt: "01/02/2025",
    parcels: [{ id: "PRC-012", culture: "Amendoim", area: "2.3 ha", lat: "-9.2000", lon: "16.0000", status: "Verificada" }],
    production: [],
    valorRecebido: "550.000,00", totalGasto: "45.000,00", saldoFinal: "505.000,00",
    incentives: [{ id: "INC-007", type: "Fertilizantes", amount: "28.000 Kz", method: "Unitel Money", status: "Pago", date: "06/02/2026" }],
    transactions: [{ product: "Ad-Fertilizante-50kg", empresa: "FertiPlus Lda", valor: "45.000,00", date: "2025-09-15 12:00:00" }],
    purchases: [],
  },
  "AGR-008": {
    id: "AGR-008", name: "Isabel Fernandes", bi: "008901234LA049", phone: "930 123 456", gender: "Feminino", birthDate: "25/01/1995", province: "Benguela", municipality: "Ganda", commune: "Ganda", village: "Aldeia Ebanga", school: "EC Ganda", status: "Validado", registeredAt: "05/02/2025",
    parcels: [{ id: "PRC-013", culture: "Soja", area: "2.0 ha", lat: "-12.9800", lon: "14.6500", status: "Pendente" }, { id: "PRC-014", culture: "Milho", area: "2.0 ha", lat: "-12.9810", lon: "14.6510", status: "Verificada" }],
    production: [{ id: "PRD-008", culture: "Massango", area: "3.5 ha", planted: "01/11/2025", expected: "01/04/2026", estimatedYield: "4.200 kg", actualYield: "-", status: "Semeada" }],
    valorRecebido: "680.000,00", totalGasto: "110.000,00", saldoFinal: "570.000,00",
    incentives: [{ id: "INC-008", type: "Mecanização", amount: "55.000 Kz", method: "Unitel Money", status: "Pendente", date: "05/02/2026" }],
    transactions: [{ product: "S-Massango-25kg", empresa: "Agro Cuando", valor: "30.000,00", date: "2025-11-01 09:00:00" }, { product: "F-Catana-3u", empresa: "Agro Cuando", valor: "8.000,00", date: "2025-11-01 09:10:00" }, { product: "Ad-Composto-50kg", empresa: "Agro Cuando", valor: "38.000,00", date: "2025-11-01 09:15:00" }, { product: "F-Enxada-2u", empresa: "TOPO AGRO, LDA", valor: "10.000,00", date: "2025-10-20 14:00:00" }, { product: "Q-Herbicida-2L", empresa: "TOPO AGRO, LDA", valor: "24.000,00", date: "2025-10-20 14:10:00" }],
    purchases: [],
  },
};

const FarmerProfile = () => {
  const { id } = useParams();
  const farmer = farmersData[id || ""];

  if (!farmer) {
    return (
      <div className="space-y-6">
        <Link to="/agricultores">
          <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        </Link>
        <Card className="p-12 text-center">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading font-semibold text-lg">Produtor não encontrado</h2>
          <p className="text-muted-foreground text-sm mt-1">O produtor com ID {id} não foi encontrado.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link to="/agricultores">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="page-title">{farmer.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{farmer.id} · Registado em {farmer.registeredAt}</p>
        </div>
        <span className={
          farmer.status === "Ativo" ? "badge-active" :
          farmer.status === "Pendente" || farmer.status === "Validado" ? "badge-pending" : "badge-suspended"
        }>{farmer.status}</span>
      </div>

      {/* Profile Summary Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <div className="flex items-start gap-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 flex-1">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Nome Completo</p>
                <p className="text-sm font-semibold mt-0.5">{farmer.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Nº BI</p>
                <p className="text-sm font-semibold mt-0.5 font-mono">{farmer.bi}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Telefone</p>
                <p className="text-sm font-semibold mt-0.5">{farmer.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Género</p>
                <p className="text-sm font-semibold mt-0.5">{farmer.gender}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Data de Nascimento</p>
                <p className="text-sm font-semibold mt-0.5">{farmer.birthDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Província / Município</p>
                <p className="text-sm font-semibold mt-0.5">{farmer.province}, {farmer.municipality}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Aldeia</p>
                <p className="text-sm font-semibold mt-0.5">{farmer.village}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Escola de Campo</p>
                <p className="text-sm font-semibold mt-0.5">{farmer.school}</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Tabs defaultValue="parcelas" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="parcelas" className="gap-2 data-[state=active]:bg-card">
              <MapPin className="h-4 w-4" /> Parcelas ({farmer.parcels.length})
            </TabsTrigger>
            <TabsTrigger value="producao" className="gap-2 data-[state=active]:bg-card">
              <Wheat className="h-4 w-4" /> Produção ({farmer.production.length})
            </TabsTrigger>
            <TabsTrigger value="incentivos" className="gap-2 data-[state=active]:bg-card">
              <Gift className="h-4 w-4" /> Incentivos ({farmer.incentives.length})
            </TabsTrigger>
            <TabsTrigger value="compras" className="gap-2 data-[state=active]:bg-card">
              <ShoppingCart className="h-4 w-4" /> Compras ({farmer.purchases.length})
            </TabsTrigger>
          </TabsList>

          {/* Parcelas Tab */}
          <TabsContent value="parcelas" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cultura</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Área</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Coordenadas</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmer.parcels.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Nenhuma parcela registada</td></tr>
                    ) : farmer.parcels.map((p: any) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                        <td className="px-4 py-3"><span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span></td>
                        <td className="px-4 py-3 text-right font-semibold">{p.area}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.lat}, {p.lon}</td>
                        <td className="px-4 py-3"><span className={p.status === "Verificada" ? "badge-active" : "badge-pending"}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Produção Tab */}
          <TabsContent value="producao" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cultura</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Área</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Plantio</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Colheita Prev.</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Est. (kg)</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Real (kg)</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmer.production.length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Nenhuma produção registada</td></tr>
                    ) : farmer.production.map((p: any) => (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                        <td className="px-4 py-3"><span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{p.culture}</span></td>
                        <td className="px-4 py-3 text-right font-semibold">{p.area}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.planted}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{p.expected}</td>
                        <td className="px-4 py-3 text-right">{p.estimatedYield}</td>
                        <td className="px-4 py-3 text-right font-semibold">{p.actualYield}</td>
                        <td className="px-4 py-3"><span className={p.status === "Colhida" ? "badge-active" : p.status === "Em Crescimento" ? "badge-pending" : "badge-suspended"}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Incentivos Tab */}
          <TabsContent value="incentivos" className="mt-4 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor Recebido</p>
                <p className="text-2xl font-bold font-heading text-primary mt-1">{farmer.valorRecebido} kz</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Gasto</p>
                <p className="text-2xl font-bold font-heading text-destructive mt-1">{farmer.totalGasto} kz</p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Saldo Final</p>
                <p className="text-2xl font-bold font-heading mt-1" style={{ color: "hsl(var(--success))" }}>{farmer.saldoFinal} kz</p>
              </Card>
            </div>

            {/* Transactions Table */}
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-heading font-semibold text-lg">Transações do Produtor</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produto</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!farmer.transactions || farmer.transactions.length === 0) ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Nenhuma transação registada</td></tr>
                    ) : farmer.transactions.map((t: any, i: number) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-medium">{t.product}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[300px]">{t.empresa}</td>
                        <td className="px-4 py-3 text-right font-semibold">{t.valor} kz</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{t.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Compras Tab */}
          <TabsContent value="compras" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Empresa</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Itens</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Total</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Subsídio</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">A Pagar</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmer.purchases.length === 0 ? (
                      <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Nenhuma compra registada</td></tr>
                    ) : farmer.purchases.map((c: any) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{c.id}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.empresa}</td>
                        <td className="px-4 py-3 text-xs max-w-[180px] truncate">{c.items}</td>
                        <td className="px-4 py-3 text-right font-semibold">{c.total}</td>
                        <td className="px-4 py-3 text-center"><span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">{c.subsidio}</span></td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">{c.valorPagar}</td>
                        <td className="px-4 py-3"><span className={c.status === "Entregue" ? "badge-active" : c.status === "Rejeitada" ? "badge-suspended" : "badge-pending"}>{c.status}</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{c.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default FarmerProfile;
