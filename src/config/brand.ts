// Centralized brand asset configuration for MOSAP3
// Update imports here to change logos across the entire application.
// This file is the single source of truth for brand imagery.

import _mosapLogo from "@/assets/mosap3-logo.png";
import _mosapLogoHorizontal from "@/assets/mosap3-horizontal.png";
import _angolaInsignia from "@/assets/republica-angola.png";

/** Main square logo — used in sidebar, auth page, navbar, reports, invoices */
export const mosapLogo = _mosapLogo;

/** Horizontal logo — used in ID cards and wide layouts */
export const mosapLogoHorizontal = _mosapLogoHorizontal;

/** Angola Republic insignia — used in official documents and ID cards */
export const angolaInsignia = _angolaInsignia;

/** Brand display metadata */
export const BRAND = {
  name: "MOSAP3",
  fullName: "Projecto Mosap3",
  slogan: "Modernização do Setor Agrário de Angola",
  altText: "MOSAP3",
} as const;

/** Tailwind / pixel size presets by context */
export const LOGO_SIZES = {
  sidebar: { container: "h-10 w-10", image: "h-8 w-8" },
  auth: { height: "h-10" },
  navbar: { height: "h-full" },
  idCard: { height: "h-6", width: "w-auto" },
  report: { height: "h-12", width: "w-auto" },
  invoice: { height: 40 },
  verification: { height: "h-12", width: "w-12" },
} as const;
