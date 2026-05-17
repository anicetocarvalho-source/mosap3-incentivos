// Centralized brand configuration for MOSAP3
// Update this file to change logos across the entire application

// Main square logo (sidebar, auth, navbar, reports, invoices)
export const mosapLogo = "/src/assets/mosap3-logo.png";

// Horizontal logo (ID cards, wide layouts)
export const mosapLogoHorizontal = "/src/assets/mosap3-horizontal.png";

// Angola Republic insignia (ID cards, official documents)
export const angolaInsignia = "/src/assets/republica-angola.png";

// Brand metadata
export const BRAND = {
  name: "MOSAP3",
  fullName: "Projecto Mosap3",
  slogan: "Modernização do Setor Agrário de Angola",
  altText: "MOSAP3",
} as const;

// Logo sizes by context (Tailwind classes or pixel values)
export const LOGO_SIZES = {
  sidebar: { container: "h-10 w-10", image: "h-8 w-8" },
  auth: { height: "h-10" },
  navbar: { height: "h-full" },
  idCard: { height: "h-6", width: "w-auto" },
  report: { height: "h-12", width: "w-auto" },
  invoice: { height: 40 },
  verification: { height: "h-12", width: "w-12" },
} as const;
