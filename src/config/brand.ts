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

/**
 * Tailwind class / pixel size presets by context.
 * Single source of truth for logo dimensions across the app.
 */
export const LOGO_SIZES = {
  /** Main sidebar — square logo inside rounded tile */
  sidebar: {
    container: "h-10 w-10",
    image: "h-8 w-8",
  },
  /** Top navbar — fills header height */
  navbar: "h-full w-auto",
  /** Public auth page (admin/staff) */
  auth: "h-10 w-auto",
  /** Public auth page (supplier portal) */
  supplierAuth: "h-14 w-auto",
  /** Supplier portal sidebar */
  supplierSidebar: "h-8 w-auto",
  /** Supplier "pending account" screen */
  supplierPending: "h-16 mx-auto",
  /** Card verification public page */
  verification: "h-12 w-12 rounded-full mx-auto mb-2",
  /** Reports preview / print header */
  report: "h-12 w-auto",
  /** Farmer ID card — horizontal MOSAP3 mark */
  idCardMosap: "h-6 object-contain",
  /** Farmer ID card — Angola Republic insignia */
  idCardAngola: "h-10 w-10 object-contain drop-shadow-sm flex-shrink-0",
  /** Invoice PDF (react-pdf inline style, in pixels) */
  invoicePx: 40,
} as const;
