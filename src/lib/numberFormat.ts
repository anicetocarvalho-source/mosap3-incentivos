/**
 * Parser unificado de valores numéricos (Kz).
 *
 * Aceita os dois formatos historicamente usados na BD:
 *   - EN-US: "200,000.00" (vírgula = milhar, ponto = decimal)
 *   - PT/EU: "200.000,00" (ponto = milhar, vírgula = decimal)
 *
 * Também aceita números puros ("200000.00", "200000") e valores numéricos.
 *
 * Heurística:
 *   1. Se vier `number`, devolve directamente.
 *   2. Limpa para conter apenas dígitos, ".", "," e "-".
 *   3. Se tiver os dois separadores, o último (mais à direita) é o decimal.
 *   4. Se só tiver um separador:
 *        - aparece >1 vez  → é separador de milhar (remove)
 *        - aparece 1 vez e seguido de exactamente 3 dígitos → milhar
 *        - caso contrário  → decimal
 */
export const parseAmount = (input: string | number | null | undefined): number => {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return isNaN(input) ? 0 : input;

  const raw = String(input).trim();
  if (!raw) return 0;

  // Mantém apenas caracteres relevantes
  const cleaned = raw.replace(/[^0-9.,\-]/g, "");
  if (!cleaned || cleaned === "-") return 0;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized = cleaned;

  if (hasDot && hasComma) {
    // O separador mais à direita é o decimal.
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastComma > lastDot) {
      // Formato PT: "200.000,00"
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato EN-US: "200,000.00"
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Só vírgulas
    const parts = cleaned.split(",");
    const multipleSeparators = parts.length > 2;
    const lastGroupIs3 = parts[parts.length - 1].length === 3;
    if (multipleSeparators || lastGroupIs3) {
      // Vírgula é separador de milhar
      normalized = cleaned.replace(/,/g, "");
    } else {
      // Vírgula é decimal (formato PT)
      normalized = cleaned.replace(",", ".");
    }
  } else if (hasDot) {
    // Só pontos
    const parts = cleaned.split(".");
    const multipleSeparators = parts.length > 2;
    const lastGroupIs3 = parts[parts.length - 1].length === 3;
    if (multipleSeparators || (parts.length === 2 && lastGroupIs3 && parts[0].length <= 3 && /^\d+$/.test(parts[0]))) {
      // Ponto é separador de milhar (ex: "200.000" ou "1.234.567")
      // Nota: "1234.56" tem lastGroup=2 → fica como decimal
      normalized = cleaned.replace(/\./g, "");
    }
    // caso contrário: ponto é decimal — deixa como está
  }

  const n = Number(normalized);
  return isNaN(n) ? 0 : n;
};

/** Formata um número como "200.000,00 Kz" (pt-AO). */
export const formatKz = (value: number | string | null | undefined, withCurrency = true): string => {
  const n = typeof value === "number" ? value : parseAmount(value);
  const formatted = new Intl.NumberFormat("pt-AO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return withCurrency ? `${formatted} Kz` : formatted;
};

/** Formata sem casas decimais — útil para listagens compactas. */
export const formatKzCompact = (value: number | string | null | undefined): string => {
  const n = typeof value === "number" ? value : parseAmount(value);
  return new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(n) + " Kz";
};

/**
 * Serializa um número para guardar na BD (texto), em formato canónico
 * EN-US sem separadores de milhar: "200000.00".
 * Fácil de parsear em qualquer ferramenta e compatível com `Number()`.
 */
export const serializeAmount = (n: number): string => {
  if (!isFinite(n)) return "0.00";
  return n.toFixed(2);
};
