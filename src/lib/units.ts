// Lista canónica de unidades usadas no MOSAP3 (formulários de Catálogo, Stock, PATEC, Produção, etc).
// Mantém o valor gravado em DB como string livre para retro-compatibilidade.

export interface UnitOption {
  value: string;
  label: string;
  group: "Peso" | "Volume" | "Embalagem" | "Animal/Vegetal" | "Área/Medida" | "Outro";
}

export const UNIT_OPTIONS: UnitOption[] = [
  { value: "Kg", label: "Quilograma (Kg)", group: "Peso" },
  { value: "g", label: "Grama (g)", group: "Peso" },
  { value: "Tonelada", label: "Tonelada (t)", group: "Peso" },

  { value: "L", label: "Litro (L)", group: "Volume" },
  { value: "ml", label: "Mililitro (ml)", group: "Volume" },
  { value: "Dose", label: "Dose", group: "Volume" },

  { value: "un", label: "Unidade (un)", group: "Embalagem" },
  { value: "Saco", label: "Saco", group: "Embalagem" },
  { value: "Caixa", label: "Caixa", group: "Embalagem" },
  { value: "Pacote", label: "Pacote", group: "Embalagem" },
  { value: "Frasco", label: "Frasco", group: "Embalagem" },
  { value: "Ampola", label: "Ampola", group: "Embalagem" },

  { value: "Cabeça", label: "Cabeça (animal)", group: "Animal/Vegetal" },
  { value: "Feixe", label: "Feixe", group: "Animal/Vegetal" },
  { value: "Muda", label: "Muda", group: "Animal/Vegetal" },
  { value: "Planta", label: "Planta", group: "Animal/Vegetal" },

  { value: "Hectare", label: "Hectare (ha)", group: "Área/Medida" },
  { value: "m²", label: "Metro quadrado (m²)", group: "Área/Medida" },
  { value: "Metro", label: "Metro (m)", group: "Área/Medida" },
];

export const UNIT_VALUES = UNIT_OPTIONS.map((u) => u.value);

export function isCanonicalUnit(v: string | null | undefined): boolean {
  if (!v) return false;
  return UNIT_VALUES.includes(v);
}
