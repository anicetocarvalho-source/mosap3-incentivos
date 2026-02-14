import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate ECDSA P-256 key pair for VAPID
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    // URL-safe base64 encode the public key
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyRaw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // The private key in URL-safe base64
    const privateKeyBase64 = privateKeyJwk.d!;

    return new Response(
      JSON.stringify({
        publicKey: publicKeyBase64,
        privateKey: privateKeyBase64,
        message: "Store these as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets. Share the public key with the frontend.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
