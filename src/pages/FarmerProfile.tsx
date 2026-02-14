import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, MapPin, Phone, CreditCard, Wheat, ShoppingCart, Gift, Calendar, FileText, Users, Sprout, Sun, Droplets, CheckCircle2, Camera, ChevronDown, ChevronUp, Clock, Printer, Beef, Plus, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import LivestockRegistrationForm from "@/components/LivestockRegistrationForm";

const farmersData: Record<string, any> = {
  "AGR-001": {
    id: "AGR-001", name: "João Mateus", bi: "001234567LA042", phone: "923 456 789", gender: "Masculino", birthDate: "15/03/1985", province: "Benguela", municipality: "Caimbambo", commune: "Caimbambo", village: "Aldeia Saca", school: "EC Caimbambo", status: "Ativo", registeredAt: "05/01/2025",
    photos: {
      frontal: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=260&fit=crop&crop=face",
      perfilEsq: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=260&fit=crop&crop=face",
      perfilDir: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=260&fit=crop&crop=face",
    },
    biometrics: { polegarDir: true, indicadorDir: true, polegarEsq: true, indicadorEsq: true },
    parcels: [
      { id: "PRC-001", culture: "Milho", area: "2.5 ha", lat: "-12.5678", lon: "14.2345", status: "Verificada" },
      { id: "PRC-002", culture: "Feijão", area: "2.0 ha", lat: "-12.5690", lon: "14.2360", status: "Verificada" },
    ],
    production: [
      {
        id: "PRD-001", culture: "Milho", area: "2.5 ha", planted: "15/10/2025", expected: "15/03/2026", estimatedYield: "5.000 kg", actualYield: "4.800 kg", status: "Colhida",
        currentPhase: "Pós-Colheita",
        technician: "José Fernandes",
        escola: "EC Caimbambo",
        phases: [
          { phase: "Preparação", date: "01/10/2025", notes: "Terreno limpo e arado. Solo com boa textura.", photos: ["https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=300&h=200&fit=crop"], techNote: "Solo preparado, pH adequado" },
          { phase: "Sementeira", date: "15/10/2025", notes: "Sementeira concluída com sementes melhoradas OPV.", photos: ["https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300&h=200&fit=crop"], techNote: "Espaçamento correcto 75x25cm" },
          { phase: "Crescimento", date: "15/11/2025", notes: "Plantas com 40cm, boa coloração verde. Primeira sacha realizada.", photos: ["https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=300&h=200&fit=crop"], techNote: "Aplicar adubação de cobertura" },
          { phase: "Floração", date: "20/12/2025", notes: "Floração uniforme. Sem sinais de pragas.", photos: ["https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=300&h=200&fit=crop"], techNote: "Monitorar lagarta do cartucho" },
          { phase: "Colheita", date: "10/03/2026", notes: "Colheita manual realizada. Rendimento de 4.800 kg.", photos: ["https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=300&h=200&fit=crop"], techNote: "Rendimento acima da média regional" },
          { phase: "Pós-Colheita", date: "15/03/2026", notes: "Secagem e armazenamento em silos metálicos.", photos: [], techNote: "Armazenamento adequado, sem perdas" },
        ],
      },
      {
        id: "PRD-002", culture: "Feijão", area: "2.0 ha", planted: "20/10/2025", expected: "20/02/2026", estimatedYield: "2.000 kg", actualYield: "-", status: "Em Crescimento",
        currentPhase: "Crescimento",
        technician: "José Fernandes",
        escola: "EC Caimbambo",
        phases: [
          { phase: "Preparação", date: "10/10/2025", notes: "Terreno preparado com tracção animal.", photos: ["https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=300&h=200&fit=crop"], techNote: "Solo com boa drenagem" },
          { phase: "Sementeira", date: "20/10/2025", notes: "Sementeira em linhas, sementes tratadas.", photos: ["https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300&h=200&fit=crop"], techNote: "Densidade de 250.000 plantas/ha" },
          { phase: "Crescimento", date: "20/11/2025", notes: "Germinação de 90%. Plantas vigorosas, primeira sacha feita.", photos: ["https://images.unsplash.com/photo-1518843875459-f738682238a6?w=300&h=200&fit=crop"], techNote: "Necessita segunda sacha em 15 dias" },
        ],
      },
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
    dependentes: [
      { name: "Maria José Mateus", relationship: "Cônjuge", gender: "Feminino", birthDate: "20/06/1988", age: 37, education: "Ensino Primário", occupation: "Agricultora" },
      { name: "António Mateus", relationship: "Filho", gender: "Masculino", birthDate: "10/03/2005", age: 20, education: "Ensino Secundário", occupation: "Estudante" },
      { name: "Luísa Mateus", relationship: "Filha", gender: "Feminino", birthDate: "15/08/2010", age: 15, education: "Ensino Primário", occupation: "Estudante" },
      { name: "Pedro Mateus", relationship: "Filho", gender: "Masculino", birthDate: "22/01/2015", age: 11, education: "Ensino Primário", occupation: "Estudante" },
      { name: "Rosa Mateus", relationship: "Mãe", gender: "Feminino", birthDate: "05/04/1958", age: 67, education: "Sem escolaridade", occupation: "Doméstica" },
    ],
    pecuaria: [
      { species: "Bovinos", breed: "Nelore", quantity: 12, male: 3, female: 7, young: 2, pastureArea: "5.0 ha", infrastructure: "Curral cercado, bebedouro", monthlyProduction: 180,
        healthRecords: [
          { type: "Vacinação", description: "Febre aftosa", date: "15/01/2026" },
          { type: "Desparasitação", description: "Ivermectina", date: "10/12/2025" },
        ],
        production: [
          { product: "Leite", quantity: 180, unit: "litros", period: "Jan/2026" },
          { product: "Leite", quantity: 165, unit: "litros", period: "Dez/2025" },
        ],
      },
      { species: "Caprinos", breed: "Boer", quantity: 8, male: 2, female: 5, young: 1, pastureArea: "2.0 ha", infrastructure: "Aprisco", monthlyProduction: 12,
        healthRecords: [
          { type: "Vacinação", description: "Clostridiose", date: "20/01/2026" },
        ],
        production: [
          { product: "Leite", quantity: 12, unit: "litros", period: "Jan/2026" },
        ],
      },
      { species: "Aves", breed: "Caipira", quantity: 35, male: 5, female: 30, young: 0, infrastructure: "Galinheiro", monthlyProduction: 450,
        healthRecords: [],
        production: [
          { product: "Ovos", quantity: 450, unit: "unidades", period: "Jan/2026" },
        ],
      },
    ],
  },
  "AGR-002": {
    id: "AGR-002", name: "Maria Silva", bi: "002345678LA043", phone: "924 567 890", gender: "Feminino", birthDate: "22/07/1990", province: "Huambo", municipality: "Longonjo", commune: "Longonjo", village: "Aldeia Chiva", school: "EC Longonjo", status: "Pendente", registeredAt: "10/01/2025",
    photos: {
      frontal: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=260&fit=crop&crop=face",
    },
    biometrics: { polegarDir: true, indicadorDir: true },
    parcels: [
      { id: "PRC-003", culture: "Mandioca", area: "3.2 ha", lat: "-14.9180", lon: "13.4920", status: "Pendente" },
    ],
    production: [
      {
        id: "PRD-003", culture: "Mandioca", area: "3.2 ha", planted: "01/09/2025", expected: "01/06/2026", estimatedYield: "8.000 kg", actualYield: "-", status: "Em Crescimento",
        currentPhase: "Crescimento",
        technician: "Ana Pereira",
        escola: "EC Longonjo",
        phases: [
          { phase: "Preparação", date: "20/08/2025", notes: "Terreno limpo e preparado.", photos: [], techNote: "Solo adequado para mandioca" },
          { phase: "Sementeira", date: "01/09/2025", notes: "Plantio de estacas de variedade melhorada.", photos: ["https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300&h=200&fit=crop"], techNote: "Espaçamento 1m x 1m" },
          { phase: "Crescimento", date: "01/11/2025", notes: "Brotação de 85%. Plantas em desenvolvimento.", photos: ["https://images.unsplash.com/photo-1518843875459-f738682238a6?w=300&h=200&fit=crop"], techNote: "Realizar monda e amontoa" },
        ],
      },
    ],
    valorRecebido: "500.000,00",
    totalGasto: "0,00",
    saldoFinal: "500.000,00",
    incentives: [
      { id: "INC-002", type: "Sementes", amount: "30.000 Kz", method: "Unitel Money", status: "Pendente", date: "11/02/2026" },
    ],
    transactions: [],
    purchases: [],
    dependentes: [
      { name: "José Silva", relationship: "Cônjuge", gender: "Masculino", birthDate: "14/02/1987", age: 38, education: "Ensino Secundário", occupation: "Agricultor" },
      { name: "Ana Silva", relationship: "Filha", gender: "Feminino", birthDate: "30/11/2012", age: 13, education: "Ensino Primário", occupation: "Estudante" },
    ],
  },
  "AGR-003": {
    id: "AGR-003", name: "Pedro Neto", bi: "003456789LA044", phone: "925 678 901", gender: "Masculino", birthDate: "03/11/1978", province: "Bié", municipality: "Cuemba", commune: "Cuemba", village: "Aldeia Soqui", school: "EC Cuemba", status: "Ativo", registeredAt: "15/01/2025",
    photos: {
      frontal: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=260&fit=crop&crop=face",
      perfilEsq: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=200&h=260&fit=crop&crop=face",
    },
    biometrics: { polegarDir: true, indicadorDir: true, polegarEsq: true, indicadorEsq: true },
    parcels: [
      { id: "PRC-004", culture: "Soja", area: "4.0 ha", lat: "-12.3456", lon: "13.5432", status: "Verificada" },
      { id: "PRC-005", culture: "Amendoim", area: "1.8 ha", lat: "-12.3470", lon: "13.5445", status: "Verificada" },
      { id: "PRC-006", culture: "Milho", area: "1.4 ha", lat: "-12.3480", lon: "13.5460", status: "Verificada" },
    ],
    production: [
      {
        id: "PRD-004", culture: "Soja", area: "4.0 ha", planted: "10/10/2025", expected: "10/03/2026", estimatedYield: "6.400 kg", actualYield: "6.100 kg", status: "Colhida",
        currentPhase: "Pós-Colheita",
        technician: "Manuel Costa",
        escola: "EC Cuemba",
        phases: [
          { phase: "Preparação", date: "25/09/2025", notes: "Terreno arado e gradeado.", photos: [], techNote: "Calagem aplicada" },
          { phase: "Sementeira", date: "10/10/2025", notes: "Sementeira mecanizada.", photos: [], techNote: "Inoculante aplicado" },
          { phase: "Crescimento", date: "10/11/2025", notes: "Germinação excelente.", photos: [], techNote: "Sem problemas" },
          { phase: "Floração", date: "15/12/2025", notes: "Floração abundante.", photos: [], techNote: "Bom potencial produtivo" },
          { phase: "Colheita", date: "10/03/2026", notes: "Colheita realizada.", photos: [], techNote: "6.100 kg colhidos" },
          { phase: "Pós-Colheita", date: "15/03/2026", notes: "Grãos em secagem.", photos: [], techNote: "Humidade a 13%" },
        ],
      },
      {
        id: "PRD-005", culture: "Amendoim", area: "1.8 ha", planted: "05/11/2025", expected: "05/04/2026", estimatedYield: "1.800 kg", actualYield: "-", status: "Semeada",
        currentPhase: "Sementeira",
        technician: "Manuel Costa",
        escola: "EC Cuemba",
        phases: [
          { phase: "Preparação", date: "25/10/2025", notes: "Terreno preparado.", photos: [], techNote: "Solo arenoso, adequado" },
          { phase: "Sementeira", date: "05/11/2025", notes: "Sementeira manual concluída.", photos: ["https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300&h=200&fit=crop"], techNote: "Aguardar germinação" },
        ],
      },
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
    dependentes: [
      { name: "Joana Neto", relationship: "Cônjuge", gender: "Feminino", birthDate: "18/04/1980", age: 45, education: "Ensino Primário", occupation: "Agricultora" },
      { name: "Miguel Neto", relationship: "Filho", gender: "Masculino", birthDate: "07/07/2002", age: 23, education: "Ensino Secundário", occupation: "Agricultor" },
      { name: "Clara Neto", relationship: "Filha", gender: "Feminino", birthDate: "25/12/2008", age: 17, education: "Ensino Secundário", occupation: "Estudante" },
    ],
  },
  "AGR-004": {
    id: "AGR-004", name: "Ana Luísa Gomes", bi: "004567890LA045", phone: "926 789 012", gender: "Feminino", birthDate: "18/05/1992", province: "Benguela", municipality: "Lobito", commune: "Lobito", village: "Aldeia Hanha", school: "EC Lobito", status: "Ativo", registeredAt: "20/01/2025",
    parcels: [{ id: "PRC-007", culture: "Batata Doce", area: "1.8 ha", lat: "-12.3500", lon: "13.5500", status: "Verificada" }],
    production: [{
      id: "PRD-006", culture: "Batata Doce", area: "1.5 ha", planted: "20/09/2025", expected: "20/01/2026", estimatedYield: "3.000 kg", actualYield: "2.750 kg", status: "Colhida",
      currentPhase: "Pós-Colheita", technician: "Teresa Luís", escola: "EC Lobito",
      phases: [
        { phase: "Preparação", date: "10/09/2025", notes: "Canteiros preparados.", photos: [], techNote: "Solo fértil" },
        { phase: "Sementeira", date: "20/09/2025", notes: "Ramas plantadas.", photos: [], techNote: "Variedade local" },
        { phase: "Crescimento", date: "20/10/2025", notes: "Bom desenvolvimento foliar.", photos: ["https://images.unsplash.com/photo-1518843875459-f738682238a6?w=300&h=200&fit=crop"], techNote: "Amontoa realizada" },
        { phase: "Colheita", date: "20/01/2026", notes: "Colheita manual, 2.750 kg.", photos: [], techNote: "Bom calibre dos tubérculos" },
        { phase: "Pós-Colheita", date: "25/01/2026", notes: "Armazenamento em local fresco.", photos: [], techNote: "Sem perdas" },
      ],
    }],
    valorRecebido: "600.000,00", totalGasto: "75.000,00", saldoFinal: "525.000,00",
    incentives: [{ id: "INC-004", type: "Fertilizantes", amount: "25.000 Kz", method: "Unitel Money", status: "Processando", date: "09/02/2026" }],
    transactions: [{ product: "Ad-Composto-50Kg", empresa: "FertiPlus Lda", valor: "38.000,00", date: "2025-08-15 14:00:00" }, { product: "S-BatatDoce-10kg", empresa: "FertiPlus Lda", valor: "12.000,00", date: "2025-08-15 14:05:00" }, { product: "F-Regador-1u", empresa: "TOPO AGRO, LDA", valor: "25.000,00", date: "2025-08-10 10:00:00" }],
    purchases: [],
    dependentes: [
      { name: "Carlos Gomes", relationship: "Cônjuge", gender: "Masculino", birthDate: "03/09/1989", age: 36, education: "Ensino Secundário", occupation: "Comerciante" },
      { name: "Sofia Gomes", relationship: "Filha", gender: "Feminino", birthDate: "14/06/2014", age: 11, education: "Ensino Primário", occupation: "Estudante" },
    ],
  },
  "AGR-005": {
    id: "AGR-005", name: "Carlos Manuel", bi: "005678901LA046", phone: "927 890 123", gender: "Masculino", birthDate: "30/09/1980", province: "Huambo", municipality: "Bailundo", commune: "Bailundo", village: "Aldeia Bimbe", school: "EC Bailundo", status: "Suspenso", registeredAt: "25/01/2025",
    parcels: [{ id: "PRC-008", culture: "Milho", area: "2.0 ha", lat: "-12.4000", lon: "15.8000", status: "Pendente" }, { id: "PRC-009", culture: "Feijão", area: "1.5 ha", lat: "-12.4010", lon: "15.8010", status: "Pendente" }],
    production: [],
    valorRecebido: "400.000,00", totalGasto: "0,00", saldoFinal: "400.000,00",
    incentives: [{ id: "INC-005", type: "Insumos Agrícolas", amount: "40.000 Kz", method: "Unitel Money", status: "Rejeitado", date: "08/02/2026" }],
    transactions: [],
    purchases: [],
    dependentes: [
      { name: "Helena Manuel", relationship: "Cônjuge", gender: "Feminino", birthDate: "17/03/1983", age: 42, education: "Ensino Primário", occupation: "Agricultora" },
      { name: "José Manuel", relationship: "Filho", gender: "Masculino", birthDate: "08/08/2003", age: 22, education: "Ensino Secundário", occupation: "Jornaleiro" },
      { name: "Francisca Manuel", relationship: "Filha", gender: "Feminino", birthDate: "01/01/2007", age: 19, education: "Ensino Secundário", occupation: "Estudante" },
    ],
  },
  "AGR-006": {
    id: "AGR-006", name: "Teresa Domingos", bi: "006789012LA047", phone: "928 901 234", gender: "Feminino", birthDate: "12/12/1988", province: "Huíla", municipality: "Lubango", commune: "Lubango", village: "Aldeia Chibia", school: "EC Lubango", status: "Ativo", registeredAt: "28/01/2025",
    parcels: [{ id: "PRC-010", culture: "Milho", area: "3.0 ha", lat: "-14.9200", lon: "13.5000", status: "Verificada" }, { id: "PRC-011", culture: "Mandioca", area: "2.1 ha", lat: "-14.9210", lon: "13.5010", status: "Verificada" }],
    production: [{
      id: "PRD-007", culture: "Milho", area: "3.0 ha", planted: "12/10/2025", expected: "12/03/2026", estimatedYield: "6.000 kg", actualYield: "-", status: "Em Crescimento",
      currentPhase: "Crescimento", technician: "Isabel Santos", escola: "EC Lubango",
      phases: [
        { phase: "Preparação", date: "01/10/2025", notes: "Terreno arado.", photos: [], techNote: "Solo argiloso, boa retenção" },
        { phase: "Sementeira", date: "12/10/2025", notes: "Sementeira em linhas.", photos: ["https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300&h=200&fit=crop"], techNote: "Variedade híbrida" },
        { phase: "Crescimento", date: "12/11/2025", notes: "Plantas com 50cm. Sacha e adubação de cobertura.", photos: ["https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=300&h=200&fit=crop"], techNote: "Aplicar ureia 46%" },
      ],
    }],
    valorRecebido: "750.000,00", totalGasto: "95.000,00", saldoFinal: "655.000,00",
    incentives: [{ id: "INC-006", type: "Sementes", amount: "35.000 Kz", method: "Unitel Money", status: "Pago", date: "07/02/2026" }],
    transactions: [{ product: "S-Milho-50kg", empresa: "Fazenda Verde", valor: "45.000,00", date: "2025-10-10 08:30:00" }, { product: "Ad-Fertilizante-25kg", empresa: "Fazenda Verde", valor: "25.000,00", date: "2025-10-10 08:35:00" }, { product: "F-Enxada-2u", empresa: "Fazenda Verde", valor: "10.000,00", date: "2025-10-10 08:40:00" }, { product: "Q-Insecticidas-1L", empresa: "Fazenda Verde", valor: "15.000,00", date: "2025-09-25 10:00:00" }],
    purchases: [],
    dependentes: [
      { name: "Manuel Domingos", relationship: "Cônjuge", gender: "Masculino", birthDate: "28/07/1985", age: 40, education: "Ensino Secundário", occupation: "Agricultor" },
      { name: "Beatriz Domingos", relationship: "Filha", gender: "Feminino", birthDate: "09/04/2009", age: 16, education: "Ensino Secundário", occupation: "Estudante" },
      { name: "Ricardo Domingos", relationship: "Filho", gender: "Masculino", birthDate: "15/11/2013", age: 12, education: "Ensino Primário", occupation: "Estudante" },
    ],
  },
  "AGR-007": {
    id: "AGR-007", name: "Francisco Luís", bi: "007890123LA048", phone: "929 012 345", gender: "Masculino", birthDate: "05/06/1975", province: "Malanje", municipality: "Cacuso", commune: "Cacuso", village: "Aldeia Pungo", school: "EC Cacuso", status: "Ativo", registeredAt: "01/02/2025",
    parcels: [{ id: "PRC-012", culture: "Amendoim", area: "2.3 ha", lat: "-9.2000", lon: "16.0000", status: "Verificada" }],
    production: [],
    valorRecebido: "550.000,00", totalGasto: "45.000,00", saldoFinal: "505.000,00",
    incentives: [{ id: "INC-007", type: "Fertilizantes", amount: "28.000 Kz", method: "Unitel Money", status: "Pago", date: "06/02/2026" }],
    transactions: [{ product: "Ad-Fertilizante-50kg", empresa: "FertiPlus Lda", valor: "45.000,00", date: "2025-09-15 12:00:00" }],
    purchases: [],
    dependentes: [
      { name: "Margarida Luís", relationship: "Cônjuge", gender: "Feminino", birthDate: "10/10/1978", age: 47, education: "Sem escolaridade", occupation: "Agricultora" },
      { name: "Ernesto Luís", relationship: "Filho", gender: "Masculino", birthDate: "02/02/2000", age: 26, education: "Ensino Secundário", occupation: "Agricultor" },
    ],
  },
  "AGR-008": {
    id: "AGR-008", name: "Isabel Fernandes", bi: "008901234LA049", phone: "930 123 456", gender: "Feminino", birthDate: "25/01/1995", province: "Benguela", municipality: "Ganda", commune: "Ganda", village: "Aldeia Ebanga", school: "EC Ganda", status: "Validado", registeredAt: "05/02/2025",
    parcels: [{ id: "PRC-013", culture: "Soja", area: "2.0 ha", lat: "-12.9800", lon: "14.6500", status: "Pendente" }, { id: "PRC-014", culture: "Milho", area: "2.0 ha", lat: "-12.9810", lon: "14.6510", status: "Verificada" }],
    production: [{
      id: "PRD-008", culture: "Massango", area: "3.5 ha", planted: "01/11/2025", expected: "01/04/2026", estimatedYield: "4.200 kg", actualYield: "-", status: "Semeada",
      currentPhase: "Sementeira", technician: "Francisco Miguel", escola: "EC Ganda",
      phases: [
        { phase: "Preparação", date: "20/10/2025", notes: "Limpeza e queima controlada.", photos: [], techNote: "Preparação tradicional" },
        { phase: "Sementeira", date: "01/11/2025", notes: "Sementeira a lanço.", photos: ["https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=300&h=200&fit=crop"], techNote: "Aguardar chuvas para germinação" },
      ],
    }],
    valorRecebido: "680.000,00", totalGasto: "110.000,00", saldoFinal: "570.000,00",
    incentives: [{ id: "INC-008", type: "Mecanização", amount: "55.000 Kz", method: "Unitel Money", status: "Pendente", date: "05/02/2026" }],
    transactions: [{ product: "S-Massango-25kg", empresa: "Agro Cuando", valor: "30.000,00", date: "2025-11-01 09:00:00" }, { product: "F-Catana-3u", empresa: "Agro Cuando", valor: "8.000,00", date: "2025-11-01 09:10:00" }, { product: "Ad-Composto-50kg", empresa: "Agro Cuando", valor: "38.000,00", date: "2025-11-01 09:15:00" }, { product: "F-Enxada-2u", empresa: "TOPO AGRO, LDA", valor: "10.000,00", date: "2025-10-20 14:00:00" }, { product: "Q-Herbicida-2L", empresa: "TOPO AGRO, LDA", valor: "24.000,00", date: "2025-10-20 14:10:00" }],
    purchases: [],
    dependentes: [
      { name: "Jorge Fernandes", relationship: "Cônjuge", gender: "Masculino", birthDate: "30/06/1993", age: 32, education: "Ensino Secundário", occupation: "Comerciante" },
      { name: "Marta Fernandes", relationship: "Filha", gender: "Feminino", birthDate: "18/09/2017", age: 8, education: "Ensino Primário", occupation: "Estudante" },
      { name: "Joaquina Fernandes", relationship: "Mãe", gender: "Feminino", birthDate: "02/03/1965", age: 60, education: "Sem escolaridade", occupation: "Doméstica" },
    ],
  },
};

const allPhases = ["Preparação", "Sementeira", "Crescimento", "Floração", "Colheita", "Pós-Colheita"];

const phaseIcons: Record<string, any> = {
  "Preparação": Sprout,
  "Sementeira": Sprout,
  "Crescimento": Sun,
  "Floração": Droplets,
  "Colheita": Wheat,
  "Pós-Colheita": CheckCircle2,
};

const phaseColors: Record<string, string> = {
  "Preparação": "bg-muted text-muted-foreground",
  "Sementeira": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Crescimento": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Floração": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "Colheita": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Pós-Colheita": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const FarmerProfile = () => {
  const { id } = useParams();
  const farmer = farmersData[id || ""];
  const [expandedProduction, setExpandedProduction] = useState<string | null>(null);

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
        <Link to={`/agricultores/${farmer.id}/ficha`}>
          <Button variant="outline" className="gap-2"><Printer className="h-4 w-4" />Ficha</Button>
        </Link>
        <span className={
          farmer.status === "Ativo" ? "badge-active" :
          farmer.status === "Pendente" || farmer.status === "Validado" ? "badge-pending" : "badge-suspended"
        }>{farmer.status}</span>
      </div>

      {/* Profile Summary Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <div className="flex items-start gap-6">
            {/* Photo or avatar */}
            {farmer.photos?.frontal ? (
              <img
                src={farmer.photos.frontal}
                alt={farmer.name}
                className="h-20 w-20 rounded-2xl object-cover flex-shrink-0 border border-border"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-10 w-10 text-primary" />
              </div>
            )}
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

          {/* Photos & Biometrics row */}
          {(farmer.photos || farmer.biometrics) && (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Photos */}
                {farmer.photos && Object.keys(farmer.photos).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5" /> Fotografias
                    </h3>
                    <div className="flex gap-3">
                      {[
                        { key: "frontal", label: "Frontal" },
                        { key: "perfilEsq", label: "Perfil Esq." },
                        { key: "perfilDir", label: "Perfil Dir." },
                      ].map((slot) => (
                        <div key={slot.key} className="text-center">
                          {farmer.photos[slot.key] ? (
                            <img
                              src={farmer.photos[slot.key]}
                              alt={slot.label}
                              className="h-20 w-16 rounded-lg object-cover border border-border"
                            />
                          ) : (
                            <div className="h-20 w-16 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
                              <Camera className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">{slot.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Biometrics */}
                {farmer.biometrics && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Fingerprint className="h-3.5 w-3.5" /> Biometria
                    </h3>
                    <div className="flex gap-3">
                      {[
                        { key: "polegarDir", label: "Polegar Dir." },
                        { key: "indicadorDir", label: "Indicador Dir." },
                        { key: "polegarEsq", label: "Polegar Esq." },
                        { key: "indicadorEsq", label: "Indicador Esq." },
                      ].map((slot) => (
                        <div key={slot.key} className="text-center">
                          <div className={`h-14 w-14 rounded-lg border flex items-center justify-center ${
                            farmer.biometrics[slot.key]
                              ? "bg-primary/10 border-primary/30"
                              : "bg-muted/30 border-dashed border-border"
                          }`}>
                            <Fingerprint className={`h-6 w-6 ${
                              farmer.biometrics[slot.key] ? "text-primary" : "text-muted-foreground/30"
                            }`} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{slot.label}</p>
                          {farmer.biometrics[slot.key] && (
                            <p className="text-[9px] text-primary font-medium">✓ Capturada</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
            <TabsTrigger value="pecuaria" className="gap-2 data-[state=active]:bg-card">
              <Beef className="h-4 w-4" /> Pecuária ({farmer.pecuaria?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="incentivos" className="gap-2 data-[state=active]:bg-card">
              <Gift className="h-4 w-4" /> Incentivos ({farmer.incentives.length})
            </TabsTrigger>
            <TabsTrigger value="dependentes" className="gap-2 data-[state=active]:bg-card">
              <Users className="h-4 w-4" /> Dependentes ({farmer.dependentes?.length || 0})
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
          <TabsContent value="producao" className="mt-4 space-y-4">
            {farmer.production.length === 0 ? (
              <Card className="p-12 text-center">
                <Wheat className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma produção registada</p>
              </Card>
            ) : farmer.production.map((p: any) => {
              const isExpanded = expandedProduction === p.id;
              const phaseIndex = allPhases.indexOf(p.currentPhase);
              const progress = ((phaseIndex + 1) / allPhases.length) * 100;

              return (
                <Card key={p.id} className="overflow-hidden">
                  {/* Production Header */}
                  <div
                    className="p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedProduction(isExpanded ? null : p.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                          <Wheat className="h-6 w-6 text-accent-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading font-semibold">{p.culture}</h3>
                            <Badge variant="outline" className="text-xs">{p.area}</Badge>
                            <span className={p.status === "Colhida" ? "badge-active" : p.status === "Em Crescimento" ? "badge-pending" : "badge-suspended"}>{p.status}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Plantio: {p.planted}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Colheita prev.: {p.expected}</span>
                            <span>Est: {p.estimatedYield} | Real: {p.actualYield}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${phaseColors[p.currentPhase] || "bg-muted"}`}>
                            {p.currentPhase}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">Técnico: {p.technician}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={progress} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground font-medium">{Math.round(progress)}%</span>
                    </div>

                    {/* Phase indicators */}
                    <div className="mt-2 flex items-center gap-1">
                      {allPhases.map((phase, i) => {
                        const completed = i <= phaseIndex;
                        const isCurrent = phase === p.currentPhase;
                        return (
                          <div key={phase} className="flex-1 flex flex-col items-center">
                            <div className={`h-1.5 w-full rounded-full ${completed ? "bg-primary" : "bg-muted"} ${isCurrent ? "ring-1 ring-primary ring-offset-1" : ""}`} />
                            <span className={`text-[10px] mt-1 ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>{phase}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expanded Phase Details */}
                  {isExpanded && p.phases && (
                    <div className="border-t border-border">
                      {/* Technician info */}
                      <div className="px-5 py-3 bg-muted/30 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-primary" /><span className="font-medium">{p.technician}</span></span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{p.escola}</span>
                      </div>

                      {/* Phase timeline */}
                      <div className="p-5 space-y-0">
                        {p.phases.map((phase: any, i: number) => {
                          const PhaseIcon = phaseIcons[phase.phase] || Sprout;
                          const isLast = i === p.phases.length - 1;
                          return (
                            <div key={i} className="flex gap-4">
                              {/* Timeline line */}
                              <div className="flex flex-col items-center">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${phaseColors[phase.phase]}`}>
                                  <PhaseIcon className="h-4 w-4" />
                                </div>
                                {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[20px]" />}
                              </div>
                              {/* Content */}
                              <div className={`flex-1 ${!isLast ? "pb-5" : "pb-2"}`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{phase.phase}</span>
                                  <span className="text-xs text-muted-foreground">{phase.date}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{phase.notes}</p>
                                {phase.techNote && (
                                  <div className="mt-1.5 flex items-start gap-1.5 text-xs">
                                    <FileText className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                    <span className="text-primary font-medium">Nota do técnico: </span>
                                    <span className="text-muted-foreground">{phase.techNote}</span>
                                  </div>
                                )}
                                {/* Photos */}
                                {phase.photos && phase.photos.length > 0 && (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {phase.photos.map((photo: string, pi: number) => (
                                      <div key={pi} className="relative group">
                                        <img
                                          src={photo}
                                          alt={`${phase.phase} - foto ${pi + 1}`}
                                          className="h-20 w-28 object-cover rounded-lg border border-border"
                                        />
                                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 rounded-lg transition-colors flex items-center justify-center">
                                          <Camera className="h-4 w-4 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          {/* Pecuária Tab */}
          <TabsContent value="pecuaria" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-lg">Pecuária</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" /> Registar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registar Pecuária — {farmer.name}</DialogTitle>
                  </DialogHeader>
                  <LivestockRegistrationForm
                    farmerId={farmer.id}
                    schoolId={undefined}
                    existingLivestock={
                      (farmer.pecuaria || []).map((a: any, i: number) => ({
                        id: `mock-${i}`,
                        species: a.species,
                        breed: a.breed || null,
                        quantity: a.quantity,
                      }))
                    }
                    onSuccess={() => {
                      toast.success("Dados actualizados!");
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
            {(!farmer.pecuaria || farmer.pecuaria.length === 0) ? (
              <Card className="p-12 text-center">
                <Beef className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Nenhum registo pecuário</p>
                <p className="text-sm text-muted-foreground mt-1">Os dados de pecuária deste produtor serão apresentados aqui.</p>
              </Card>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Total Animais</p>
                    <p className="text-2xl font-bold">{farmer.pecuaria.reduce((s: number, a: any) => s + a.quantity, 0)}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Espécies</p>
                    <p className="text-2xl font-bold">{farmer.pecuaria.length}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Área Pastagem</p>
                    <p className="text-2xl font-bold">{farmer.pecuaria[0]?.pastureArea || "—"}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted-foreground">Prod. Mensal</p>
                    <p className="text-2xl font-bold">{farmer.pecuaria.reduce((s: number, a: any) => s + (a.monthlyProduction || 0), 0)} un.</p>
                  </Card>
                </div>

                {/* Species cards */}
                {farmer.pecuaria.map((animal: any, i: number) => (
                  <Card key={i} className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
                          <Beef className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <h3 className="font-heading font-semibold">{animal.species}</h3>
                          {animal.breed && <p className="text-xs text-muted-foreground">Raça: {animal.breed}</p>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">{animal.quantity} cabeças</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="text-xs text-muted-foreground">Machos</span><p className="font-semibold">{animal.male}</p></div>
                      <div><span className="text-xs text-muted-foreground">Fêmeas</span><p className="font-semibold">{animal.female}</p></div>
                      <div><span className="text-xs text-muted-foreground">Crias</span><p className="font-semibold">{animal.young}</p></div>
                      <div><span className="text-xs text-muted-foreground">Infraestrutura</span><p className="font-semibold">{animal.infrastructure || "—"}</p></div>
                    </div>
                    {animal.healthRecords && animal.healthRecords.length > 0 && (
                      <div className="mt-4 border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Registos de Saúde</p>
                        <div className="space-y-1.5">
                          {animal.healthRecords.map((h: any, hi: number) => (
                            <div key={hi} className="flex items-center justify-between text-xs bg-muted/40 rounded px-3 py-1.5">
                              <span className="font-medium">{h.type}: {h.description}</span>
                              <span className="text-muted-foreground">{h.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {animal.production && animal.production.length > 0 && (
                      <div className="mt-4 border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Produção Animal</p>
                        <div className="space-y-1.5">
                          {animal.production.map((pr: any, pi: number) => (
                            <div key={pi} className="flex items-center justify-between text-xs bg-muted/40 rounded px-3 py-1.5">
                              <span className="font-medium">{pr.product}: {pr.quantity} {pr.unit}</span>
                              <span className="text-muted-foreground">{pr.period}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </>
            )}
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

          {/* Dependentes Tab */}
          <TabsContent value="dependentes" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-heading font-semibold text-lg">Agregado Familiar</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Membros do agregado familiar do produtor</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-6 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Nome</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Parentesco</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Género</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Data Nasc.</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Idade</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Escolaridade</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Ocupação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!farmer.dependentes || farmer.dependentes.length === 0) ? (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Nenhum dependente registado</td></tr>
                    ) : farmer.dependentes.map((d: any, i: number) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{d.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{d.relationship}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.gender}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{d.birthDate}</td>
                        <td className="px-4 py-3 text-center font-semibold">{d.age}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.education}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.occupation}</td>
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
