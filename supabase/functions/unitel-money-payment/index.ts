import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

/** Load Unitel Money credentials from system_settings table */
async function loadUnitelConfig(supabase: any) {
  const keys = [
    "unitel_api_endpoint",
    "unitel_consumer_key",
    "unitel_consumer_secret",
    "unitel_initiator",
    "unitel_shortcode",
    "unitel_security_credential",
    "unitel_payment_enabled",
  ];
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", keys);

  if (error) throw new Error("Erro ao carregar configurações: " + error.message);

  const config: Record<string, string> = {};
  (data || []).forEach((row: { key: string; value: string }) => {
    config[row.key] = row.value;
  });

  if (config.unitel_payment_enabled !== "true") {
    throw new Error("Pagamentos Unitel Money não estão activados. Active nas Configurações do MOSAP3Pay.");
  }

  const endpoint = config.unitel_api_endpoint || "https://api.unitel.ao/v2/partners/1.0.0";
  const consumerKey = config.unitel_consumer_key;
  const consumerSecret = config.unitel_consumer_secret;
  const initiator = config.unitel_initiator;
  const shortcode = config.unitel_shortcode;
  const securityCredential = config.unitel_security_credential;

  if (!consumerKey || !consumerSecret) {
    throw new Error("Consumer Key ou Consumer Secret não configurados");
  }
  if (!initiator || !shortcode || !securityCredential) {
    throw new Error("Credenciais do comerciante incompletas (Initiator, ShortCode ou Security Credential)");
  }

  return { endpoint, consumerKey, consumerSecret, initiator, shortcode, securityCredential };
}

/** Get OAuth2 Bearer token from Unitel Money */
async function getUnitelToken(endpoint: string, consumerKey: string, consumerSecret: string): Promise<string> {
  // Token URL uses the gateway host from the endpoint
  const url = new URL(endpoint);
  const tokenUrl = `${url.protocol}//${url.host}/oauth2/token`;

  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  const res = await fetch(tokenUrl, {
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

/** Initiate BuyGoods async payment (API V4.7) */
async function initiateBuyGoods(
  token: string,
  endpoint: string,
  config: { initiator: string; shortcode: string; securityCredential: string },
  params: {
    amount: number;
    phoneNumber: string;
    saleCode: string;
    posCode?: string;
    callbackUrl?: string;
  }
) {
  const referenceItems: Array<{ Key: string; Value: string }> = [
    { Key: "POSDeviceID", Value: params.posCode || "MOSAP3POS" },
  ];
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
          Identifier: config.initiator,
          SecurityCredential: config.securityCredential,
          ShortCode: config.shortcode,
        },
        PrimaryParty: { IdentifierType: 1, Identifier: params.phoneNumber },
        ReceiverParty: { IdentifierType: 4, Identifier: config.shortcode },
      },
      TransactionRequest: {
        Parameters: { Amount: String(params.amount), Currency: "AOA" },
        ReferenceData: { ReferenceItem: referenceItems },
      },
    },
  };

  const res = await fetch(`${endpoint}/buyGoods_async`, {
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
  return body.Response || body;
}

/** Query Transaction Status (API V4.7 - sync) */
async function queryTransaction(
  token: string,
  endpoint: string,
  config: { initiator: string; shortcode: string; securityCredential: string },
  originalConversationId: string
) {
  const payload = {
    QueryTransactionStatus: {
      Timestamp: generateTimestamp(),
      OriginatorConversationID: `query_${Date.now()}`,
      IdentityRec: {
        Initiator: {
          IdentifierType: 12,
          Identifier: config.initiator,
          SecurityCredential: config.securityCredential,
          ShortCode: config.shortcode,
        },
      },
      QueryTransactionStatusRequest: {
        OriginalConversationID: originalConversationId,
      },
      Remark: "MOSAP3Pay query transaction status",
    },
  };

  const res = await fetch(`${endpoint}/queryTransactionStatus_sync`, {
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
  return body.QueryTransStatusRs || body.QueryTransactionStatusResult || body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Use service role to read system_settings (bypasses RLS)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Validate user auth
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const jwtToken = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser(jwtToken);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, sale_id, sale_code, amount, phone_number, conversation_id, pos_code, callback_url } = await req.json();

    // Test connection action
    if (action === "test_connection") {
      try {
        const cfg = await loadUnitelConfig(supabaseAdmin);
        const token = await getUnitelToken(cfg.endpoint, cfg.consumerKey, cfg.consumerSecret);
        return new Response(
          JSON.stringify({ success: true, message: "Token obtido com sucesso", token_preview: token.substring(0, 10) + "..." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Load config from DB
    const cfg = await loadUnitelConfig(supabaseAdmin);
    const merchantConfig = { initiator: cfg.initiator, shortcode: cfg.shortcode, securityCredential: cfg.securityCredential };

    if (action === "pay") {
      const unitelToken = await getUnitelToken(cfg.endpoint, cfg.consumerKey, cfg.consumerSecret);
      const result = await initiateBuyGoods(unitelToken, cfg.endpoint, merchantConfig, {
        amount,
        phoneNumber: phone_number,
        saleCode: sale_code,
        posCode: pos_code,
        callbackUrl: callback_url,
      });

      const conversationId = result.ConversationID || result.OriginatorConversationID || sale_code;
      if (sale_id) {
        await supabaseAdmin
          .from("pos_sales")
          .update({
            payment_status: "processando",
            unitel_transaction_id: conversationId,
            payment_reference: result.ConversationID || null,
          })
          .eq("id", sale_id);
      }

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
      const unitelToken = await getUnitelToken(cfg.endpoint, cfg.consumerKey, cfg.consumerSecret);
      const result = await queryTransaction(unitelToken, cfg.endpoint, merchantConfig, conversation_id);

      let paymentStatus = "processando";
      const resultCode = result.ResultCode ?? result.ResponseCode;
      if (resultCode === 0 || resultCode === "0") {
        paymentStatus = "pago";
      } else if (resultCode === 3011) {
        paymentStatus = "processando";
      } else if (resultCode) {
        paymentStatus = "falhado";
      }

      if (sale_id && paymentStatus !== "processando") {
        await supabaseAdmin
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

    return new Response(JSON.stringify({ error: "Ação inválida. Use 'pay', 'query', 'test_connection' ou 'callback_ack'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Unitel Money error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    const notConfigured = /não estão activados|não configurados|incompletas/i.test(msg);
    // Return 200 with structured fallback so the client handles gracefully
    // (avoids FunctionsHttpError / blank-screen runtime error in POS).
    return new Response(
      JSON.stringify({ success: false, error: msg, fallback: true, not_configured: notConfigured }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
