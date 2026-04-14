import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalInvoices: number;
    totalProducts: number;
    totalCustomers: number;
    totalCredit: string;
    totalDebit: string;
    fiscalYear: string;
    period: string;
  };
}

interface ValidationError {
  code: string;
  path: string;
  message: string;
}

interface ValidationWarning {
  code: string;
  path: string;
  message: string;
}

// SAF-T AO 1.01_01 required elements and structure
const REQUIRED_HEADER_FIELDS = [
  "AuditFileVersion", "CompanyID", "TaxRegistrationNumber",
  "TaxAccountingBasis", "CompanyName", "FiscalYear",
  "StartDate", "EndDate", "CurrencyCode", "DateCreated",
  "TaxEntity", "ProductCompanyTaxID", "SoftwareCertificateNumber",
  "ProductID", "ProductVersion",
];

const REQUIRED_ADDRESS_FIELDS = ["AddressDetail", "City", "PostalCode", "Country"];

const REQUIRED_INVOICE_FIELDS = [
  "InvoiceNo", "ATCUD", "DocumentStatus", "Hash", "HashControl",
  "Period", "InvoiceDate", "InvoiceType", "SpecialRegimes",
  "SourceID", "SystemEntryDate", "CustomerID",
];

const REQUIRED_LINE_FIELDS = [
  "LineNumber", "ProductCode", "ProductDescription", "Quantity",
  "UnitOfMeasure", "UnitPrice", "TaxPointDate", "Description",
];

const VALID_INVOICE_TYPES = ["FT", "FR", "ND", "NC"];
const VALID_INVOICE_STATUSES = ["N", "S", "A", "R", "F"];
const VALID_PAYMENT_MECHANISMS = ["CC", "CD", "CH", "CO", "CS", "DE", "LC", "MB", "NU", "OU", "PR", "TB", "TR"];
const VALID_TAX_TYPES = ["IVA", "IS", "NS"];
const NIF_REGEX = /^\d{9,14}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function getElement(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "s");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function getElementBlock(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "s");
  const match = xml.match(regex);
  return match ? match[0] : null;
}

function getAllBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "g");
  return xml.match(regex) || [];
}

function hasElement(xml: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s\\S]*?>`).test(xml);
}

function validateXml(xmlText: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let totalInvoices = 0;
  let totalProducts = 0;
  let totalCustomers = 0;
  let totalCreditDeclared = "0.00";
  let totalDebitDeclared = "0.00";
  let fiscalYear = "";
  let period = "";

  // 1. Basic XML structure
  if (!xmlText.startsWith("<?xml")) {
    errors.push({ code: "XML-001", path: "/", message: "Ficheiro não começa com declaração XML" });
  }

  const auditFile = getElementBlock(xmlText, "AuditFile");
  if (!auditFile) {
    errors.push({ code: "XML-002", path: "/AuditFile", message: "Elemento raiz AuditFile não encontrado" });
    return { valid: false, errors, warnings, summary: { totalInvoices: 0, totalProducts: 0, totalCustomers: 0, totalCredit: "0", totalDebit: "0", fiscalYear: "", period: "" } };
  }

  // Check namespace
  if (!auditFile.includes("urn:OECD:StandardAuditFile-Tax:AO_1.01_01")) {
    errors.push({ code: "XML-003", path: "/AuditFile", message: "Namespace SAF-T AO 1.01_01 não encontrado" });
  }

  // 2. Header validation
  const header = getElementBlock(xmlText, "Header");
  if (!header) {
    errors.push({ code: "HDR-001", path: "/AuditFile/Header", message: "Elemento Header obrigatório não encontrado" });
  } else {
    for (const field of REQUIRED_HEADER_FIELDS) {
      const value = getElement(header, field);
      if (!value) {
        errors.push({ code: "HDR-002", path: `/Header/${field}`, message: `Campo obrigatório ${field} ausente ou vazio` });
      }
    }

    // Validate AuditFileVersion
    const version = getElement(header, "AuditFileVersion");
    if (version && version !== "1.01_01") {
      errors.push({ code: "HDR-003", path: "/Header/AuditFileVersion", message: `Versão '${version}' inválida. Esperado: 1.01_01` });
    }

    // Validate NIF
    const nif = getElement(header, "TaxRegistrationNumber");
    if (nif && !NIF_REGEX.test(nif)) {
      errors.push({ code: "HDR-004", path: "/Header/TaxRegistrationNumber", message: `NIF '${nif}' inválido. Deve ter 9-14 dígitos` });
    }
    if (nif === "000000000") {
      warnings.push({ code: "HDR-W01", path: "/Header/TaxRegistrationNumber", message: "NIF do fornecedor não configurado (000000000)" });
    }

    // Validate TaxAccountingBasis
    const basis = getElement(header, "TaxAccountingBasis");
    if (basis && !["C", "E", "F", "I", "P", "R", "S", "T"].includes(basis)) {
      errors.push({ code: "HDR-005", path: "/Header/TaxAccountingBasis", message: `TaxAccountingBasis '${basis}' inválido` });
    }

    // Validate dates
    const startDate = getElement(header, "StartDate");
    const endDate = getElement(header, "EndDate");
    if (startDate && !DATE_REGEX.test(startDate)) {
      errors.push({ code: "HDR-006", path: "/Header/StartDate", message: `Formato de StartDate inválido: ${startDate}` });
    }
    if (endDate && !DATE_REGEX.test(endDate)) {
      errors.push({ code: "HDR-007", path: "/Header/EndDate", message: `Formato de EndDate inválido: ${endDate}` });
    }
    if (startDate && endDate && startDate > endDate) {
      errors.push({ code: "HDR-008", path: "/Header", message: "StartDate posterior a EndDate" });
    }

    fiscalYear = getElement(header, "FiscalYear") || "";
    period = `${startDate || "?"} a ${endDate || "?"}`;

    // Validate CurrencyCode
    const currency = getElement(header, "CurrencyCode");
    if (currency && currency !== "AOA") {
      warnings.push({ code: "HDR-W02", path: "/Header/CurrencyCode", message: `Moeda '${currency}' — esperado AOA para Angola` });
    }

    // Validate Country in CompanyAddress
    const companyAddress = getElementBlock(header, "CompanyAddress");
    if (!companyAddress) {
      errors.push({ code: "HDR-009", path: "/Header/CompanyAddress", message: "CompanyAddress obrigatório não encontrado" });
    } else {
      for (const field of REQUIRED_ADDRESS_FIELDS) {
        if (!getElement(companyAddress, field)) {
          errors.push({ code: "HDR-010", path: `/Header/CompanyAddress/${field}`, message: `Campo obrigatório ${field} ausente em CompanyAddress` });
        }
      }
      const country = getElement(companyAddress, "Country");
      if (country && country !== "AO") {
        warnings.push({ code: "HDR-W03", path: "/Header/CompanyAddress/Country", message: `País '${country}' — esperado AO para Angola` });
      }
    }
  }

  // 3. MasterFiles validation
  const masterFiles = getElementBlock(xmlText, "MasterFiles");
  if (!masterFiles) {
    errors.push({ code: "MF-001", path: "/AuditFile/MasterFiles", message: "MasterFiles obrigatório não encontrado" });
  } else {
    // Customers
    const customers = getAllBlocks(masterFiles, "Customer");
    totalCustomers = customers.length;
    if (customers.length === 0) {
      warnings.push({ code: "MF-W01", path: "/MasterFiles", message: "Nenhum cliente (Customer) declarado" });
    }
    const customerIds = new Set<string>();
    for (const cust of customers) {
      const custId = getElement(cust, "CustomerID");
      if (!custId) {
        errors.push({ code: "MF-002", path: "/MasterFiles/Customer", message: "CustomerID obrigatório ausente" });
      } else {
        if (customerIds.has(custId)) {
          errors.push({ code: "MF-003", path: `/MasterFiles/Customer/${custId}`, message: `CustomerID '${custId}' duplicado` });
        }
        customerIds.add(custId);
      }
      if (!getElement(cust, "CompanyName")) {
        errors.push({ code: "MF-004", path: `/MasterFiles/Customer/${custId || "?"}`, message: "CompanyName obrigatório ausente no Customer" });
      }
      if (!getElement(cust, "CustomerTaxID")) {
        errors.push({ code: "MF-005", path: `/MasterFiles/Customer/${custId || "?"}`, message: "CustomerTaxID obrigatório ausente" });
      }
      if (!hasElement(cust, "BillingAddress")) {
        errors.push({ code: "MF-006", path: `/MasterFiles/Customer/${custId || "?"}`, message: "BillingAddress obrigatório ausente" });
      }
      if (!hasElement(cust, "SelfBillingIndicator")) {
        errors.push({ code: "MF-007", path: `/MasterFiles/Customer/${custId || "?"}`, message: "SelfBillingIndicator obrigatório ausente" });
      }
    }

    // Products
    const products = getAllBlocks(masterFiles, "Product");
    totalProducts = products.length;
    for (const prod of products) {
      if (!getElement(prod, "ProductType")) {
        errors.push({ code: "MF-008", path: "/MasterFiles/Product", message: "ProductType obrigatório ausente" });
      }
      const pType = getElement(prod, "ProductType");
      if (pType && !["P", "S", "O", "E", "I"].includes(pType)) {
        errors.push({ code: "MF-009", path: "/MasterFiles/Product", message: `ProductType '${pType}' inválido` });
      }
      if (!getElement(prod, "ProductCode")) {
        errors.push({ code: "MF-010", path: "/MasterFiles/Product", message: "ProductCode obrigatório ausente" });
      }
      if (!getElement(prod, "ProductDescription")) {
        errors.push({ code: "MF-011", path: "/MasterFiles/Product", message: "ProductDescription obrigatório ausente" });
      }
    }

    // TaxTable
    const taxTable = getElementBlock(masterFiles, "TaxTable");
    if (!taxTable) {
      errors.push({ code: "MF-012", path: "/MasterFiles/TaxTable", message: "TaxTable obrigatório não encontrado" });
    } else {
      const taxEntries = getAllBlocks(taxTable, "TaxTableEntry");
      if (taxEntries.length === 0) {
        errors.push({ code: "MF-013", path: "/MasterFiles/TaxTable", message: "Pelo menos um TaxTableEntry obrigatório" });
      }
      for (const entry of taxEntries) {
        const taxType = getElement(entry, "TaxType");
        if (taxType && !VALID_TAX_TYPES.includes(taxType)) {
          errors.push({ code: "MF-014", path: "/MasterFiles/TaxTable/TaxTableEntry", message: `TaxType '${taxType}' inválido` });
        }
        if (!getElement(entry, "TaxCountryRegion")) {
          errors.push({ code: "MF-015", path: "/MasterFiles/TaxTable/TaxTableEntry", message: "TaxCountryRegion ausente" });
        }
        if (!getElement(entry, "Description")) {
          errors.push({ code: "MF-016", path: "/MasterFiles/TaxTable/TaxTableEntry", message: "Description ausente em TaxTableEntry" });
        }
        if (!getElement(entry, "TaxPercentage") && !getElement(entry, "TaxAmount")) {
          errors.push({ code: "MF-017", path: "/MasterFiles/TaxTable/TaxTableEntry", message: "TaxPercentage ou TaxAmount obrigatório" });
        }
      }
    }
  }

  // 4. SourceDocuments / SalesInvoices validation
  const sourceDocuments = getElementBlock(xmlText, "SourceDocuments");
  if (!sourceDocuments) {
    warnings.push({ code: "SD-W01", path: "/AuditFile/SourceDocuments", message: "SourceDocuments não encontrado" });
  } else {
    const salesInvoices = getElementBlock(sourceDocuments, "SalesInvoices");
    if (!salesInvoices) {
      warnings.push({ code: "SD-W02", path: "/SourceDocuments/SalesInvoices", message: "SalesInvoices não encontrado" });
    } else {
      const numEntries = getElement(salesInvoices, "NumberOfEntries");
      totalDebitDeclared = getElement(salesInvoices, "TotalDebit") || "0.00";
      totalCreditDeclared = getElement(salesInvoices, "TotalCredit") || "0.00";

      const invoices = getAllBlocks(salesInvoices, "Invoice");
      totalInvoices = invoices.length;

      // Validate NumberOfEntries matches actual count
      if (numEntries && parseInt(numEntries) !== invoices.length) {
        errors.push({
          code: "SI-001",
          path: "/SalesInvoices/NumberOfEntries",
          message: `NumberOfEntries (${numEntries}) não corresponde ao número de facturas (${invoices.length})`,
        });
      }

      // Validate each invoice
      let computedCredit = 0;
      const invoiceNumbers = new Set<string>();

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        const invNo = getElement(inv, "InvoiceNo") || `[${i + 1}]`;
        const invPath = `/SalesInvoices/Invoice[${invNo}]`;

        // Required fields
        for (const field of REQUIRED_INVOICE_FIELDS) {
          if (!hasElement(inv, field) && !getElement(inv, field)) {
            errors.push({ code: "INV-001", path: `${invPath}/${field}`, message: `Campo obrigatório ${field} ausente na factura ${invNo}` });
          }
        }

        // Unique InvoiceNo
        if (invoiceNumbers.has(invNo)) {
          errors.push({ code: "INV-002", path: invPath, message: `InvoiceNo '${invNo}' duplicado` });
        }
        invoiceNumbers.add(invNo);

        // InvoiceType
        const invType = getElement(inv, "InvoiceType");
        if (invType && !VALID_INVOICE_TYPES.includes(invType)) {
          errors.push({ code: "INV-003", path: `${invPath}/InvoiceType`, message: `InvoiceType '${invType}' inválido. Válidos: ${VALID_INVOICE_TYPES.join(", ")}` });
        }

        // InvoiceStatus
        const status = getElement(inv, "InvoiceStatus");
        if (status && !VALID_INVOICE_STATUSES.includes(status)) {
          errors.push({ code: "INV-004", path: `${invPath}/DocumentStatus/InvoiceStatus`, message: `InvoiceStatus '${status}' inválido` });
        }

        // InvoiceDate format
        const invDate = getElement(inv, "InvoiceDate");
        if (invDate && !DATE_REGEX.test(invDate)) {
          errors.push({ code: "INV-005", path: `${invPath}/InvoiceDate`, message: `Formato de InvoiceDate inválido: ${invDate}` });
        }

        // SystemEntryDate format
        const sysDate = getElement(inv, "SystemEntryDate");
        if (sysDate && !DATETIME_REGEX.test(sysDate)) {
          errors.push({ code: "INV-006", path: `${invPath}/SystemEntryDate`, message: `Formato de SystemEntryDate inválido: ${sysDate}` });
        }

        // Period validation (1-12)
        const periodVal = getElement(inv, "Period");
        if (periodVal) {
          const p = parseInt(periodVal);
          if (isNaN(p) || p < 1 || p > 12) {
            errors.push({ code: "INV-007", path: `${invPath}/Period`, message: `Period '${periodVal}' inválido (1-12)` });
          }
        }

        // CustomerID reference
        const custRef = getElement(inv, "CustomerID");
        if (custRef && masterFiles) {
          const customers = getAllBlocks(masterFiles, "Customer");
          const custIds = customers.map(c => getElement(c, "CustomerID")).filter(Boolean);
          if (!custIds.includes(custRef)) {
            warnings.push({ code: "INV-W01", path: `${invPath}/CustomerID`, message: `CustomerID '${custRef}' referenciado mas não declarado em MasterFiles` });
          }
        }

        // Lines
        const lines = getAllBlocks(inv, "Line");
        if (lines.length === 0) {
          errors.push({ code: "INV-008", path: invPath, message: `Factura ${invNo} sem linhas de produto` });
        }

        let lineCredit = 0;
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          const lineNo = getElement(line, "LineNumber") || `${j + 1}`;
          const linePath = `${invPath}/Line[${lineNo}]`;

          for (const field of REQUIRED_LINE_FIELDS) {
            if (!getElement(line, field)) {
              errors.push({ code: "LN-001", path: `${linePath}/${field}`, message: `Campo ${field} ausente na linha ${lineNo} da factura ${invNo}` });
            }
          }

          // Must have CreditAmount or DebitAmount
          const credit = getElement(line, "CreditAmount");
          const debit = getElement(line, "DebitAmount");
          if (!credit && !debit) {
            errors.push({ code: "LN-002", path: linePath, message: `Linha ${lineNo}: CreditAmount ou DebitAmount obrigatório` });
          }

          if (credit) lineCredit += parseFloat(credit) || 0;

          // Tax element
          if (!hasElement(line, "Tax")) {
            errors.push({ code: "LN-003", path: linePath, message: `Linha ${lineNo}: elemento Tax obrigatório ausente` });
          } else {
            const taxBlock = getElementBlock(line, "Tax");
            if (taxBlock) {
              if (!getElement(taxBlock, "TaxType")) {
                errors.push({ code: "LN-004", path: `${linePath}/Tax/TaxType`, message: "TaxType ausente" });
              }
              if (!getElement(taxBlock, "TaxCountryRegion")) {
                errors.push({ code: "LN-005", path: `${linePath}/Tax/TaxCountryRegion`, message: "TaxCountryRegion ausente" });
              }
              if (!getElement(taxBlock, "TaxCode")) {
                errors.push({ code: "LN-006", path: `${linePath}/Tax/TaxCode`, message: "TaxCode ausente" });
              }
              if (!getElement(taxBlock, "TaxPercentage") && !getElement(taxBlock, "TaxAmount")) {
                errors.push({ code: "LN-007", path: `${linePath}/Tax`, message: "TaxPercentage ou TaxAmount obrigatório" });
              }
            }
          }

          // Quantity > 0
          const qty = getElement(line, "Quantity");
          if (qty && (parseFloat(qty) <= 0)) {
            errors.push({ code: "LN-008", path: `${linePath}/Quantity`, message: `Quantity deve ser > 0 (actual: ${qty})` });
          }

          // UnitPrice >= 0
          const price = getElement(line, "UnitPrice");
          if (price && parseFloat(price) < 0) {
            errors.push({ code: "LN-009", path: `${linePath}/UnitPrice`, message: `UnitPrice não pode ser negativo: ${price}` });
          }
        }

        computedCredit += lineCredit;

        // DocumentTotals
        const docTotals = getElementBlock(inv, "DocumentTotals");
        if (!docTotals) {
          errors.push({ code: "INV-009", path: invPath, message: `DocumentTotals obrigatório ausente na factura ${invNo}` });
        } else {
          const taxPayable = getElement(docTotals, "TaxPayable");
          const netTotal = getElement(docTotals, "NetTotal");
          const grossTotal = getElement(docTotals, "GrossTotal");

          if (!taxPayable) errors.push({ code: "DT-001", path: `${invPath}/DocumentTotals/TaxPayable`, message: "TaxPayable ausente" });
          if (!netTotal) errors.push({ code: "DT-002", path: `${invPath}/DocumentTotals/NetTotal`, message: "NetTotal ausente" });
          if (!grossTotal) errors.push({ code: "DT-003", path: `${invPath}/DocumentTotals/GrossTotal`, message: "GrossTotal ausente" });

          // Validate GrossTotal = NetTotal + TaxPayable
          if (taxPayable && netTotal && grossTotal) {
            const tp = parseFloat(taxPayable);
            const nt = parseFloat(netTotal);
            const gt = parseFloat(grossTotal);
            const expected = Math.round((nt + tp) * 100) / 100;
            if (Math.abs(gt - expected) > 0.02) {
              errors.push({
                code: "DT-004",
                path: `${invPath}/DocumentTotals`,
                message: `GrossTotal (${gt}) ≠ NetTotal (${nt}) + TaxPayable (${tp}) = ${expected}`,
              });
            }
          }

          // Payment
          const payment = getElementBlock(docTotals, "Payment");
          if (payment) {
            const mechanism = getElement(payment, "PaymentMechanism");
            if (mechanism && !VALID_PAYMENT_MECHANISMS.includes(mechanism)) {
              warnings.push({ code: "DT-W01", path: `${invPath}/DocumentTotals/Payment/PaymentMechanism`, message: `PaymentMechanism '${mechanism}' não reconhecido` });
            }
          }
        }
      }

      // Validate TotalCredit matches sum
      const declaredCredit = parseFloat(totalCreditDeclared) || 0;
      if (Math.abs(declaredCredit - computedCredit) > 0.05) {
        warnings.push({
          code: "SI-W01",
          path: "/SalesInvoices/TotalCredit",
          message: `TotalCredit declarado (${declaredCredit.toFixed(2)}) difere da soma das linhas (${computedCredit.toFixed(2)})`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalInvoices,
      totalProducts,
      totalCustomers,
      totalCredit: totalCreditDeclared,
      totalDebit: totalDebitDeclared,
      fiscalYear,
      period,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check: require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const contentType = req.headers.get("content-type") || "";
    let xmlText: string;

    if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      xmlText = await req.text();
    } else {
      const body = await req.json();
      if (body.xml) {
        xmlText = body.xml;
      } else if (body.supplier_id && body.start_date && body.end_date) {
        // Generate SAF-T first, then validate
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-saft`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(body),
        });
        xmlText = await response.text();
        if (!response.ok) {
          throw new Error(`Erro ao gerar SAF-T: ${xmlText}`);
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Envie o XML no campo 'xml' ou forneça supplier_id, start_date e end_date" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const result = validateXml(xmlText);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
