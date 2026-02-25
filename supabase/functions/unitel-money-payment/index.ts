import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Unitel Money API V4.7 endpoints
const UNITEL_TOKEN_URL = "https://apigateway.unitel.co.ao:9443/oauth2/token";
const UNITEL_BUYGOODS_ASYNC_URL = "https://apigateway.unitel.co.ao:8343/v2/partners/1.0.0/buyGoods_async";
const UNITEL_BUYGOODS_SYNC_URL = "https://apigateway.unitel.co.ao:8343/v2/partners/1.0.0/buyGoods_sync";
const UNITEL_QUERY_URL = "https://apigateway.unitel.co.ao:8343/v2/partners/1.0.0/queryTransactionStatus_sync";

/** Generate timestamp in yyyyMMddHHmmss format */
function generateTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${h}${mi}${s}`;
}

/** Get OAuth2 Bearer token from Unitel Money (client_credentials grant) */
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

/**
 * Initiate BuyGoods async payment (API V4.7)
 * Payload structure based on official documentation:
 * - BuyGoodRec > IdentityRec > Initiator (IdentifierType=12, Identifier, SecurityCredential, ShortCode)
 * - BuyGoodRec > IdentityRec > PrimaryParty (IdentifierType=1, Identifier=customer phone)
 * - BuyGoodRec > IdentityRec > ReceiverParty (IdentifierType=4, Identifier=shortcode)
 * - BuyGoodRec > TransactionRequest > Parameters (Amount, Currency=AOA)
 * - BuyGoodRec > TransactionRequest > ReferenceData > ReferenceItem (POSDeviceID, Callback)
 */
async function initiateBuyGoods(
  token: string,
  params: {
    amount: number;
    phoneNumber: string;
    saleCode: string;
    posCode?: string;
    callbackUrl?: string;
  }
) {
  const shortcode = Deno.env.get("UNITEL_SHORTCODE");
  const initiator = Deno.env.get("UNITEL_INITIATOR");
  const securityCredential = Deno.env.get("UNITEL_SECURITY_CREDENTIAL");

  if (!shortcode || !initiator || !securityCredential) {
    throw new Error("Credenciais Unitel Money incompletas (SHORTCODE, INITIATOR ou SECURITY_CREDENTIAL em falta)");
  }

  const referenceItems: Array<{ Key: string; Value: string }> = [
    { Key: "POSDeviceID", Value: params.posCode || "MOSAP3POS" },
  ];

  // Add callback URL if provided (required for async mode)
  if (params.callbackUrl) {
    referenceItems.push({ Key: "Callback", Value: params.callbackUrl });
  }

  const payload = {
    BuyGoodRec: {
      Timestamp: generateTimestamp(),
      OriginatorConversationID: params.saleCode,
      IdentityRec: {
        Initiator: {
          IdentifierType: 12,
          Identifier: initiator,
          SecurityCredential: securityCredential,
          ShortCode: shortcode,
        },
        PrimaryParty: {
          IdentifierType: 1,
          Identifier: params.phoneNumber,
        },
        ReceiverParty: {
          IdentifierType: 4,
          Identifier: shortcode,
        },
      },
      TransactionRequest: {
        Parameters: {
          Amount: String(params.amount),
          Currency: "AOA",
        },
        ReferenceData: {
          ReferenceItem: referenceItems,
        },
      },
    },
  };

  const res = await fetch(UNITEL_BUYGOODS_ASYNC_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`BuyGoods error [${res.status}]: ${JSON.stringify(body)}`);
  }

  // Response structure: { Response: { OriginatorConversationID, ConversationID, ResponseCode, ResponseDesc, ServiceStatus } }
  return body.Response || body;
}

/**
 * Query Transaction Status (API V4.7 - sync)
 * Payload: QueryTransactionStatus > IdentityRec > Initiator + QueryTransactionStatusRequest > OriginalConversationID
 */
async function queryTransaction(token: string, originalConversationId: string) {
  const shortcode = Deno.env.get("UNITEL_SHORTCODE");
  const initiator = Deno.env.get("UNITEL_INITIATOR");
  const securityCredential = Deno.env.get("UNITEL_SECURITY_CREDENTIAL");

  if (!shortcode || !initiator || !securityCredential) {
    throw new Error("Credenciais Unitel Money incompletas");
  }

  const payload = {
    QueryTransactionStatus: {
      Timestamp: generateTimestamp(),
      OriginatorConversationID: `query_${Date.now()}`,
      IdentityRec: {
        Initiator: {
          IdentifierType: 12,
          Identifier: initiator,
          SecurityCredential: securityCredential,
          ShortCode: shortcode,
        },
      },
      QueryTransactionStatusRequest: {
        OriginalConversationID: originalConversationId,
      },
      Remark: "MOSAP3Pay query transaction status",
    },
  };

  const res = await fetch(UNITEL_QUERY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`QueryTransaction error [${res.status}]: ${JSON.stringify(body)}`);
  }

  // Response: { QueryTransStatusRs: { ResultType, ResultCode, ResultDesc, Transaction: { TransactionStatus, ReceiptNumber } } }
  return body.QueryTransStatusRs || body.QueryTransactionStatusResult || body;
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

  const jwtToken = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(jwtToken);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, sale_id, sale_code, amount, phone_number, conversation_id, pos_code, callback_url } = await req.json();

    if (action === "pay") {
      // Step 1: Get Unitel OAuth2 token (client_credentials)
      const unitelToken = await getUnitelToken();

      // Step 2: Initiate BuyGoods async
      const result = await initiateBuyGoods(unitelToken, {
        amount,
        phoneNumber: phone_number,
        saleCode: sale_code,
        posCode: pos_code,
        callbackUrl: callback_url,
      });

      // Step 3: Update sale with transaction reference
      const conversationId = result.ConversationID || result.OriginatorConversationID || sale_code;

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
          response_description: result.ResponseDesc,
          service_status: result.ServiceStatus,
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

      if (resultCode === 0 || resultCode === "0") {
        // Check TransactionStatus from query response
        const txStatus = result.Transaction?.TransactionStatus;
        if (txStatus === "Completed") {
          paymentStatus = "pago";
        } else {
          paymentStatus = "pago"; // ResultCode 0 = success
        }
      } else if (resultCode === 3011) {
        // Transaction not found / still processing
        paymentStatus = "processando";
      } else if (resultCode) {
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
          transaction_id: result.Transaction?.ReceiptNumber || null,
          transaction_status: result.Transaction?.TransactionStatus || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle callback acknowledgment (for async BuyGoods callback responses)
    if (action === "callback_ack") {
      return new Response(
        JSON.stringify({
          status: "success",
          message: "Callback recebido com sucesso",
          OriginatorConversationID: conversation_id,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'pay', 'query' ou 'callback_ack'." }), {
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
