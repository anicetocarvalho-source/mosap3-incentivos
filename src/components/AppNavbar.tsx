import {
  LayoutDashboard,
  Users,
  Building2,
  ArrowLeftRight,
  UserCog,
  Settings,
  ChevronDown,
  UserPlus,
  School,
  Wheat,
  Gift,
  ShoppingCart,
  MapPin,
  Smartphone,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type NavItem = {
  icon: any;
  label: string;
  path?: string;
  children?: { label: string; path: string; icon?: any }[];
  allowedRoles?: AppRole[];
  sidebar?: boolean;
};

export type { NavItem, AppRole };

const ALL_ROLES: AppRole[] = [
  "admin", "gestor_incentivos",
  "senior_agricultura", "senior_monitoria", "senior_agronegocio",
  "junior_agricultura", "junior_monitoria", "junior_agronegocio",
  "tecnico_extensionista",
];

export const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", sidebar: true },
  {
    icon: Users,
    label: "Produtores",
    sidebar: true,
    children: [
      { label: "Registo do Pequeno Produtor", path: "/agricultores", icon: UserPlus },
    ],
  },
  { icon: School, label: "Escolas", path: "/escolas" },
  {
    icon: Gift,
    label: "Incentivos",
    sidebar: true,
    allowedRoles: ["admin", "gestor_incentivos"],
    children: [
      { label: "Incentivos", path: "/incentivos", icon: Gift },
      { label: "Transações", path: "/transacoes", icon: ArrowLeftRight },
    ],
  },
  {
    icon: ShoppingCart,
    label: "Compras",
    path: "/compras",
    sidebar: true,
    allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"],
  },
  { icon: MapPin, label: "Parcelas", path: "/parcelas" },
  {
    icon: Building2,
    label: "Empresas",
    path: "/empresas",
    sidebar: true,
    allowedRoles: ["admin", "gestor_incentivos", "senior_agronegocio", "junior_agronegocio"],
  },
  { icon: Wheat, label: "Produção", path: "/producao" },
  {
    icon: UserCog,
    label: "Utilizadores",
    sidebar: true,
    allowedRoles: ["admin"],
    children: [
      { label: "Lista de Utilizadores", path: "/utilizadores" },
      { label: "Perfis", path: "/perfis" },
    ],
  },
  {
    icon: Settings,
    label: "Configurações",
    sidebar: true,
    allowedRoles: ["admin"],
    children: [
      { label: "Geral", path: "/configuracoes", icon: Settings },
      { label: "Províncias", path: "/provincias", icon: MapPin },
    ],
  },
  { icon: Smartphone, label: "Instalar", path: "/instalar" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gestor_incentivos: "Gestor de Incentivos",
  senior_agricultura: "Sénior Agricultura",
  senior_monitoria: "Sénior Monitoria",
  junior_monitoria: "Júnior Monitoria",
  junior_agricultura: "Júnior Agricultura",
  senior_agronegocio: "Sénior Agronegócio",
  junior_agronegocio: "Júnior Agronegócio",
  tecnico_extensionista: "Técnico Extensionista",
};

// AppNavbar is now integrated into AppLayout.
// This file is kept for the navItems export.
const AppNavbar = () => null;

export default AppNavbar;
