import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function formatDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 19);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplier_id, start_date, end_date } = await req.json();

    if (!supplier_id || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: "supplier_id, start_date e end_date são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch supplier
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplier_id)
      .single();

    if (!supplier) {
      return new Response(
        JSON.stringify({ error: "Fornecedor não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch sales in period
    const { data: sales } = await supabase
      .from("pos_sales")
      .select("*")
      .eq("supplier_id", supplier_id)
      .gte("created_at", start_date)
      .lte("created_at", end_date + "T23:59:59.999Z")
      .order("created_at", { ascending: true });

    const allSales = sales || [];

    // Fetch sale items for all sales
    const saleIds = allSales.map((s) => s.id);
    let allItems: any[] = [];
    if (saleIds.length > 0) {
      const { data: items } = await supabase
        .from("pos_sale_items")
        .select("*")
        .in("sale_id", saleIds);
      allItems = items || [];
    }

    // Fetch products used
    const productIds = [...new Set(allItems.map((i) => i.product_id))];
    let allProducts: any[] = [];
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from("supplier_products")
        .select("*")
        .in("id", productIds);
      allProducts = products || [];
    }

    // Collect unique customers (farmers)
    const farmerCodes = [...new Set(allSales.map((s) => s.farmer_code))];
    let allFarmers: any[] = [];
    if (farmerCodes.length > 0) {
      const { data: farmers } = await supabase
        .from("farmers")
        .select("code, full_name, phone, bi, province, municipality")
        .in("code", farmerCodes);
      allFarmers = farmers || [];
    }

    // Build XML
    const now = new Date();
    const fiscalYear = new Date(start_date).getFullYear();
    const nif = supplier.nif || "000000000";
    const companyName = escapeXml(supplier.name);

    // Totals
    // TotalCredit = sum of all CreditAmounts (net amounts, without IVA)
    const totalCredit = allItems.reduce((s, item) => s + (Number(item.unit_price) * Number(item.quantity)), 0);
    const totalDebit = 0;
    const numberOfEntries = allSales.length;

    // Tax table entries (collect unique IVA rates)
    const taxRates = [...new Set(allItems.map((i) => Number(i.iva_rate)))];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>${escapeXml(nif)}</CompanyID>
    <TaxRegistrationNumber>${escapeXml(nif)}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${companyName}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXml(supplier.address || supplier.municipality || "Angola")}</AddressDetail>
      <City>${escapeXml(supplier.municipality || "Luanda")}</City>
      <PostalCode>0000</PostalCode>
      <Province>${escapeXml(supplier.province || "Luanda")}</Province>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${formatDate(start_date)}</StartDate>
    <EndDate>${formatDate(end_date)}</EndDate>
    <CurrencyCode>AOA</CurrencyCode>
    <DateCreated>${formatDate(now)}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${escapeXml(nif)}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>MOSAP3Pay/MOSAP3</ProductID>
    <ProductVersion>1.0</ProductVersion>
    <Telephone>${escapeXml(supplier.phone || "")}</Telephone>
    <Email>${escapeXml(supplier.email || "")}</Email>
  </Header>
  <MasterFiles>
    <Customer>
      <CustomerID>CONSUMIDOR_FINAL</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>999999999</CustomerTaxID>
      <CompanyName>Consumidor Final</CompanyName>
      <BillingAddress>
        <AddressDetail>Angola</AddressDetail>
        <City>Luanda</City>
        <PostalCode>0000</PostalCode>
        <Country>AO</Country>
      </BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`;

    // Individual customers (farmers)
    for (const farmer of allFarmers) {
      xml += `
    <Customer>
      <CustomerID>${escapeXml(farmer.code)}</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>${escapeXml(farmer.bi || "999999999")}</CustomerTaxID>
      <CompanyName>${escapeXml(farmer.full_name)}</CompanyName>
      <BillingAddress>
        <AddressDetail>${escapeXml((farmer.municipality || "") + ", " + (farmer.province || "Angola"))}</AddressDetail>
        <City>${escapeXml(farmer.municipality || "Desconhecida")}</City>
        <PostalCode>0000</PostalCode>
        <Country>AO</Country>
      </BillingAddress>
      <Telephone>${escapeXml(farmer.phone || "")}</Telephone>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`;
    }

    // Products
    for (const product of allProducts) {
      xml += `
    <Product>
      <ProductType>P</ProductType>
      <ProductCode>${escapeXml(product.id)}</ProductCode>
      <ProductDescription>${escapeXml(product.name)}</ProductDescription>
      <ProductNumberCode>${escapeXml(product.id)}</ProductNumberCode>
    </Product>`;
    }

    // Tax Table
    xml += `
    <TaxTable>`;
    for (const rate of taxRates) {
      xml += `
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>NOR</TaxCode>
        <Description>IVA ${rate}%</Description>
        <TaxPercentage>${rate.toFixed(2)}</TaxPercentage>
      </TaxTableEntry>`;
    }
    if (taxRates.length === 0) {
      xml += `
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>NOR</TaxCode>
        <Description>IVA 14%</Description>
        <TaxPercentage>14.00</TaxPercentage>
      </TaxTableEntry>`;
    }
    xml += `
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${numberOfEntries}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>`;

    // Invoices
    for (const sale of allSales) {
      const saleItems = allItems.filter((i) => i.sale_id === sale.id);
      const invoiceNo = sale.invoice_number || sale.sale_code;
      const saleDate = new Date(sale.created_at);
      const status = sale.payment_status === "pago" ? "N" : "N"; // Normal

      xml += `
      <Invoice>
        <InvoiceNo>${escapeXml(invoiceNo)}</InvoiceNo>
        <ATCUD>0</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>${status}</InvoiceStatus>
          <InvoiceStatusDate>${formatDateTime(saleDate)}</InvoiceStatusDate>
          <SourceID>MOSAP3Pay</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>0</Hash>
        <HashControl>1</HashControl>
        <Period>${saleDate.getMonth() + 1}</Period>
        <InvoiceDate>${formatDate(saleDate)}</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>MOSAP3Pay</SourceID>
        <SystemEntryDate>${formatDateTime(saleDate)}</SystemEntryDate>
        <CustomerID>${escapeXml(sale.farmer_code)}</CustomerID>`;

      // Lines
      let lineNumber = 1;
      for (const item of saleItems) {
        const netAmount = Number(item.unit_price) * Number(item.quantity);
        const taxAmount = Number(item.iva_amount);
        const grossTotal = Number(item.line_total);
        const taxRate = Number(item.iva_rate);

        xml += `
        <Line>
          <LineNumber>${lineNumber}</LineNumber>
          <ProductCode>${escapeXml(item.product_id)}</ProductCode>
          <ProductDescription>${escapeXml(item.product_name)}</ProductDescription>
          <Quantity>${Number(item.quantity).toFixed(2)}</Quantity>
          <UnitOfMeasure>un</UnitOfMeasure>
          <UnitPrice>${Number(item.unit_price).toFixed(2)}</UnitPrice>
          <TaxPointDate>${formatDate(saleDate)}</TaxPointDate>
          <Description>${escapeXml(item.product_name)}</Description>
          <CreditAmount>${netAmount.toFixed(2)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>NOR</TaxCode>
            <TaxPercentage>${taxRate.toFixed(2)}</TaxPercentage>
          </Tax>
          <TaxExemptionReason/>
          <SettlementAmount>0.00</SettlementAmount>
        </Line>`;
        lineNumber++;
      }

      // Document totals
      const taxPayable = Number(sale.iva_total);
      const netTotal = Number(sale.subtotal);
      const grossTotal = Number(sale.total);

      xml += `
        <DocumentTotals>
          <TaxPayable>${taxPayable.toFixed(2)}</TaxPayable>
          <NetTotal>${netTotal.toFixed(2)}</NetTotal>
          <GrossTotal>${grossTotal.toFixed(2)}</GrossTotal>
          <Payment>
            <PaymentMechanism>${sale.payment_method === "unitel_money" ? "MB" : "OU"}</PaymentMechanism>
            <PaymentAmount>${grossTotal.toFixed(2)}</PaymentAmount>
            <PaymentDate>${formatDate(saleDate)}</PaymentDate>
          </Payment>
        </DocumentTotals>
      </Invoice>`;
    }

    xml += `
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="SAFT-AO_${nif}_${start_date}_${end_date}.xml"`,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
