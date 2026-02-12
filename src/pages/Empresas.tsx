import { motion } from "framer-motion";
import { Plus, Building2, MapPin, Phone, Mail, ArrowLeft, ShoppingCart, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Venda {
  id: string;
  produto: string;
  quantidade: string;
  valor: number;
  provincia: string;
  escola: string;
  agricultor: string;
  data: string;
  status: string;
}

interface Empresa {
  id: number;
  name: string;
  nif: string;
  province: string;
  municipality: string;
  phone: string;
  email: string;
  status: string;
  products: number;
  vendas: Venda[];
}

const empresas: Empresa[] = [
  {
    id: 1, name: "AgroSul Lda", nif: "5417892301", province: "Benguela", municipality: "Lobito",
    phone: "+244 923 456 789", email: "info@agrosul.ao", status: "Ativa", products: 12,
    vendas: [
      { id: "V-001", produto: "Adubo NPK", quantidade: "50 kg", valor: 35000, provincia: "Benguela", escola: "EC Caimbambo", agricultor: "João Manuel Silva", data: "10/02/2026", status: "Entregue" },
      { id: "V-002", produto: "Enxada melhorada", quantidade: "10 un", valor: 22000, provincia: "Benguela", escola: "EC Lobito", agricultor: "Carlos Mendes", data: "08/02/2026", status: "Entregue" },
      { id: "V-003", produto: "Pulverizador manual", quantidade: "5 un", valor: 45000, provincia: "Huambo", escola: "EC Longonjo", agricultor: "Pedro Gaspar", data: "05/02/2026", status: "Entregue" },
      { id: "V-004", produto: "Adubo NPK", quantidade: "30 kg", valor: 21000, provincia: "Huíla", escola: "EC Lubango", agricultor: "Jorge Caetano", data: "03/02/2026", status: "Pendente" },
      { id: "V-005", produto: "Semente milho melhorada", quantidade: "20 kg", valor: 18000, provincia: "Benguela", escola: "EC Ganda", agricultor: "Pedro Alves", data: "01/02/2026", status: "Entregue" },
      { id: "V-006", produto: "Enxada melhorada", quantidade: "8 un", valor: 17600, provincia: "Malanje", escola: "EC Cacuso", agricultor: "Alberto Nascimento", data: "28/01/2026", status: "Entregue" },
    ],
  },
  {
    id: 2, name: "Fazenda Verde", nif: "5418234501", province: "Huíla", municipality: "Lubango",
    phone: "+244 924 567 890", email: "geral@fazendaverde.ao", status: "Ativa", products: 8,
    vendas: [
      { id: "V-010", produto: "Sementes feijão", quantidade: "40 kg", valor: 28000, provincia: "Huíla", escola: "EC Lubango", agricultor: "Jorge Caetano", data: "09/02/2026", status: "Entregue" },
      { id: "V-011", produto: "Fertilizante orgânico", quantidade: "100 kg", valor: 42000, provincia: "Huíla", escola: "EC Lubango", agricultor: "Jorge Caetano", data: "06/02/2026", status: "Entregue" },
      { id: "V-012", produto: "Sementes feijão", quantidade: "25 kg", valor: 17500, provincia: "Benguela", escola: "EC Caimbambo", agricultor: "Maria da Conceição", data: "02/02/2026", status: "Pendente" },
    ],
  },
  {
    id: 3, name: "SemPro Angola", nif: "5419876543", province: "Huambo", municipality: "Huambo",
    phone: "+244 925 678 901", email: "vendas@sempro.ao", status: "Ativa", products: 15,
    vendas: [
      { id: "V-020", produto: "Semente milho híbrido", quantidade: "60 kg", valor: 54000, provincia: "Huambo", escola: "EC Longonjo", agricultor: "Pedro Gaspar", data: "11/02/2026", status: "Entregue" },
      { id: "V-021", produto: "Semente soja", quantidade: "30 kg", valor: 27000, provincia: "Huambo", escola: "EC Longonjo", agricultor: "Rosa Mateus", data: "07/02/2026", status: "Entregue" },
      { id: "V-022", produto: "Semente mandioca", quantidade: "50 estacas", valor: 15000, provincia: "Bié", escola: "EC Cuemba", agricultor: "Domingos Campos", data: "04/02/2026", status: "Entregue" },
      { id: "V-023", produto: "Semente amendoim", quantidade: "20 kg", valor: 18000, provincia: "Malanje", escola: "EC Cacuso", agricultor: "Alberto Nascimento", data: "01/02/2026", status: "Entregue" },
      { id: "V-024", produto: "Semente milho híbrido", quantidade: "40 kg", valor: 36000, provincia: "Benguela", escola: "EC Caimbambo", agricultor: "João Manuel Silva", data: "29/01/2026", status: "Entregue" },
    ],
  },
  {
    id: 4, name: "MecAgro SA", nif: "5420123456", province: "Benguela", municipality: "Benguela",
    phone: "+244 926 789 012", email: "info@mecagro.ao", status: "Pendente", products: 6,
    vendas: [
      { id: "V-030", produto: "Tractor aluguer", quantidade: "1 dia", valor: 85000, provincia: "Benguela", escola: "EC Caimbambo", agricultor: "António Domingos", data: "10/02/2026", status: "Entregue" },
      { id: "V-031", produto: "Charrua", quantidade: "2 un", valor: 62000, provincia: "Benguela", escola: "EC Lobito", agricultor: "Luísa Bernardo", data: "05/02/2026", status: "Pendente" },
    ],
  },
  {
    id: 5, name: "FertiPlus", nif: "5421234567", province: "Namibe", municipality: "Moçâmedes",
    phone: "+244 927 890 123", email: "geral@fertiplus.ao", status: "Ativa", products: 10,
    vendas: [
      { id: "V-040", produto: "Fertilizante NPK 12-24-12", quantidade: "200 kg", valor: 78000, provincia: "Benguela", escola: "EC Caimbambo", agricultor: "Francisco Lopes", data: "09/02/2026", status: "Entregue" },
      { id: "V-041", produto: "Calcário agrícola", quantidade: "500 kg", valor: 45000, provincia: "Huambo", escola: "EC Longonjo", agricultor: "Carlos Henriques", data: "06/02/2026", status: "Entregue" },
      { id: "V-042", produto: "Fertilizante foliar", quantidade: "10 L", valor: 32000, provincia: "Bié", escola: "EC Cuemba", agricultor: "Esperança Matos", data: "03/02/2026", status: "Entregue" },
    ],
  },
  {
    id: 6, name: "Agro Cuando", nif: "5422345678", province: "Cuando Cubango", municipality: "Menongue",
    phone: "+244 928 901 234", email: "info@agrocuando.ao", status: "Inativa", products: 4,
    vendas: [],
  },
];

const ITEMS_PER_PAGE = 5;
const formatKz = (value: number) => `${value.toLocaleString("pt-AO")} Kz`;

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(200 80% 50%)",
];

const Empresas = () => {
  const [search, setSearch] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [vendaPage, setVendaPage] = useState(1);

  const filtered = empresas.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.province.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view
  if (selectedEmpresa) {
    const vendas = selectedEmpresa.vendas;
    const totalVendas = vendas.reduce((s, v) => s + v.valor, 0);
    const totalEntregue = vendas.filter(v => v.status === "Entregue").reduce((s, v) => s + v.valor, 0);

    // Vendas por província
    const provMap = new Map<string, number>();
    vendas.forEach(v => provMap.set(v.provincia, (provMap.get(v.provincia) || 0) + v.valor));
    const provData = Array.from(provMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const multiProvincia = provData.length > 1;

    const totalVendaPages = Math.ceil(vendas.length / ITEMS_PER_PAGE);
    const paginatedVendas = vendas.slice((vendaPage - 1) * ITEMS_PER_PAGE, vendaPage * ITEMS_PER_PAGE);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedEmpresa(null); setVendaPage(1); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="page-title">{selectedEmpresa.name}</h1>
              <Badge variant={selectedEmpresa.status === "Ativa" ? "default" : selectedEmpresa.status === "Pendente" ? "secondary" : "outline"}>
                {selectedEmpresa.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedEmpresa.municipality}, {selectedEmpresa.province}</span>
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selectedEmpresa.phone}</span>
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selectedEmpresa.email}</span>
              <span>NIF: {selectedEmpresa.nif}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Vendas</p>
              <p className="text-2xl font-bold">{formatKz(totalVendas)}</p>
              <p className="text-xs text-muted-foreground mt-1">{vendas.length} transacções</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Entregue</p>
              <p className="text-2xl font-bold text-primary">{formatKz(totalEntregue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{vendas.filter(v => v.status === "Entregue").length} entregas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-2xl font-bold">{formatKz(totalVendas - totalEntregue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{vendas.filter(v => v.status === "Pendente").length} pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart: vendas por província (only if multi-province) */}
        {multiProvincia && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Vendas por Província
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={provData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(value: number) => formatKz(value)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Total Vendas">
                    {provData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Vendas list */}
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-3 border-b border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Lista de Vendas
            </h3>
          </div>
          {vendas.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma venda registada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produto</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Qtd</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Valor</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Província</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escola</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Agricultor</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVendas.map((v) => (
                      <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{v.id}</td>
                        <td className="px-4 py-3 font-medium">{v.produto}</td>
                        <td className="px-4 py-3 text-muted-foreground">{v.quantidade}</td>
                        <td className="px-4 py-3 font-semibold">{formatKz(v.valor)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{v.provincia}</td>
                        <td className="px-4 py-3 text-muted-foreground">{v.escola}</td>
                        <td className="px-4 py-3">{v.agricultor}</td>
                        <td className="px-4 py-3 text-muted-foreground">{v.data}</td>
                        <td className="px-4 py-3">
                          <span className={v.status === "Entregue" ? "badge-active" : "badge-pending"}>{v.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>A mostrar {(vendaPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(vendaPage * ITEMS_PER_PAGE, vendas.length)} de {vendas.length}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={vendaPage <= 1} onClick={() => setVendaPage(vendaPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">{vendaPage} / {totalVendaPages || 1}</span>
                  <Button variant="outline" size="sm" disabled={vendaPage >= totalVendaPages} onClick={() => setVendaPage(vendaPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de empresas fornecedoras e parceiras</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Pesquisar empresas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((empresa, i) => (
          <motion.div
            key={empresa.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className="p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setSelectedEmpresa(empresa); setVendaPage(1); }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-base">{empresa.name}</h3>
                    <p className="text-xs text-muted-foreground">NIF: {empresa.nif}</p>
                  </div>
                </div>
                <span className={
                  empresa.status === "Ativa" ? "badge-active" :
                  empresa.status === "Pendente" ? "badge-pending" : "badge-suspended"
                }>
                  {empresa.status}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{empresa.municipality}, {empresa.province}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{empresa.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{empresa.email}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{empresa.products} produtos registados</span>
                <span className="text-xs font-medium">{empresa.vendas.length} vendas</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Empresas;
