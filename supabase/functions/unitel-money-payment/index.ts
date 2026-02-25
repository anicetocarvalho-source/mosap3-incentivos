import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Unitel Money API endpoints
const UNITEL_TOKEN_URL = "https://unitel.ao:9443/oauth2/token";
const UNITEL_BUYGOODS_URL = "https://unitel.ao:8443/transactions/v1/buyGoods_async";
const UNITEL_QUERY_URL = "https://unitel.ao:8443/transactions/v1/queryTransaction";

/** Get OAuth2 Bearer token from Unitel Money */
async function getUnitelToken(): Promise<string> {
  const consumerKey = Deno.env.get("UNITEL_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("UNITEL_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("UNITEL_CONSUMER_KEY ou UNITEL_CONSUMER_SECRET não configurados");
  }

  const credentials = btoa(`${consumerKey}:${consumerSecret}`);

  const res = await fetch(UNITEL_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unitel token error [${res.status}]: ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Initiate BuyGoods async payment */
async function initiateBuyGoods(
  token: string,
  params: {
    amount: number;
    phoneNumber: string;
    saleCode: string;
  }
) {
  const shortcode = Deno.env.get("UNITEL_SHORTCODE");
  const initiator = Deno.env.get("UNITEL_INITIATOR");
  const securityCredential = Deno.env.get("UNITEL_SECURITY_CREDENTIAL");

  if (!shortcode || !initiator || !securityCredential) {
    throw new Error("Credenciais Unitel Money incompletas (SHORTCODE, INITIATOR ou SECURITY_CREDENTIAL em falta)");
  }

  const payload = {
    CommandID: "BuyGoods",
    Amount: params.amount,
    Msisdn1: shortcode,       // Business shortcode (receiver)
    Msisdn2: params.phoneNumber, // Customer phone (payer)
    Initiator: initiator,
    SecurityCredential: securityCredential,
    OriginatorConversationID: params.saleCode,
    Remark: `MOSAP3Pay Venda ${params.saleCode}`,
  };

  const res = await fetch(UNITEL_BUYGOODS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`BuyGoods error [${res.status}]: ${JSON.stringify(body)}`);
  }

  return body;
}

/** Query transaction status */
async function queryTransaction(token: string, conversationId: string) {
  const shortcode = Deno.env.get("UNITEL_SHORTCODE");
  const initiator = Deno.env.get("UNITEL_INITIATOR");
  const securityCredential = Deno.env.get("UNITEL_SECURITY_CREDENTIAL");

  const payload = {
    CommandID: "QueryTransaction",
    OriginatorConversationID: conversationId,
    Initiator: initiator,
    SecurityCredential: securityCredential,
    PartyA: shortcode,
    IdentifierType: "4", // Shortcode type
  };

  const res = await fetch(UNITEL_QUERY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`QueryTransaction error [${res.status}]: ${JSON.stringify(body)}`);
  }

  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, sale_id, sale_code, amount, phone_number, conversation_id } = await req.json();

    if (action === "pay") {
      // Step 1: Get Unitel OAuth token
      const unitelToken = await getUnitelToken();

      // Step 2: Initiate BuyGoods
      const result = await initiateBuyGoods(unitelToken, {
        amount,
        phoneNumber: phone_number,
        saleCode: sale_code,
      });

      // Step 3: Update sale with transaction reference
      const conversationId =
        result.ConversationID || result.OriginatorConversationID || sale_code;

      await supabase
        .from("pos_sales")
        .update({
          payment_status: "processando",
          unitel_transaction_id: conversationId,
          payment_reference: result.ConversationID || null,
        })
        .eq("id", sale_id);

      return new Response(
        JSON.stringify({
          success: true,
          conversation_id: conversationId,
          response_code: result.ResponseCode,
          response_description: result.ResponseDescription,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "query") {
      const unitelToken = await getUnitelToken();
      const result = await queryTransaction(unitelToken, conversation_id);

      // Map Unitel status to our payment status
      let paymentStatus = "processando";
      const resultCode = result.ResultCode ?? result.ResponseCode;
      if (resultCode === "0" || resultCode === 0) {
        paymentStatus = "pago";
      } else if (resultCode && resultCode !== "1") {
        paymentStatus = "falhado";
      }

      // Update sale status
      if (sale_id && paymentStatus !== "processando") {
        await supabase
          .from("pos_sales")
          .update({ payment_status: paymentStatus })
          .eq("id", sale_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_status: paymentStatus,
          result_code: resultCode,
          result_description: result.ResultDesc || result.ResponseDescription,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'pay' ou 'query'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Unitel Money error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
