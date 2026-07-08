// JazzCash Mobile Wallet (MWALLET) — server-side integration
// Docs: https://sandbox.jazzcash.com.pk / Merchant Portal MWALLET API
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MERCHANT_ID = Deno.env.get('JAZZCASH_MERCHANT_ID')!;
const PASSWORD = Deno.env.get('JAZZCASH_PASSWORD')!;
const SALT = Deno.env.get('JAZZCASH_INTEGRITY_SALT')!;
const ENV = (Deno.env.get('JAZZCASH_ENV') ?? 'sandbox').toLowerCase();

const ENDPOINT =
  ENV === 'live'
    ? 'https://payments.jazzcash.com.pk/ApplicationAPI/API/Purchase/DoMWalletTransaction'
    : 'https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Purchase/DoMWalletTransaction';

// Format date as yyyyMMddHHmmss in PKT (UTC+5)
function pktStamp(date: Date): string {
  const pkt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    pkt.getUTCFullYear().toString() +
    pad(pkt.getUTCMonth() + 1) +
    pad(pkt.getUTCDate()) +
    pad(pkt.getUTCHours()) +
    pad(pkt.getUTCMinutes()) +
    pad(pkt.getUTCSeconds())
  );
}

async function buildSecureHash(fields: Record<string, string>): Promise<string> {
  // Sort keys alphabetically, take non-empty pp_* values, join with '&', prefix with SALT&
  const keys = Object.keys(fields)
    .filter((k) => k.startsWith('pp_') && fields[k] !== '' && fields[k] !== undefined && fields[k] !== null)
    .sort();
  const raw = SALT + '&' + keys.map((k) => fields[k]).join('&');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SALT),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Input
    const body = await req.json();
    const orderId: string | undefined = body.order_id;
    const mobileNumber: string | undefined = body.mobile_number;
    const cnicLast6: string | undefined = body.cnic;
    const purpose: string = body.purpose ?? 'order';

    if (!orderId || !mobileNumber || !cnicLast6) {
      return new Response(
        JSON.stringify({ error: 'order_id, mobile_number and cnic are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!/^03\d{9}$/.test(mobileNumber)) {
      return new Response(
        JSON.stringify({ error: 'Mobile number must be 11 digits starting with 03' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!/^\d{6}$/.test(cnicLast6)) {
      return new Response(
        JSON.stringify({ error: 'CNIC must be last 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch order + verify ownership
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, customer_id, total, order_number')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (order.customer_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build JazzCash request
    const now = new Date();
    const expiry = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
    const txnRef = 'T' + pktStamp(now) + Math.floor(Math.random() * 900 + 100).toString();
    const amountPaisa = Math.round(Number(order.total) * 100).toString();

    const fields: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: MERCHANT_ID,
      pp_SubMerchantID: '',
      pp_Password: PASSWORD,
      pp_BankID: 'TBANK',
      pp_ProductID: 'RETL',
      pp_TxnRefNo: txnRef,
      pp_Amount: amountPaisa,
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: pktStamp(now),
      pp_BillReference: (order.order_number ?? orderId).toString().slice(0, 20),
      pp_Description: `FoodXpress ${purpose}`.slice(0, 50),
      pp_TxnExpiryDateTime: pktStamp(expiry),
      pp_ReturnURL: '',
      pp_MobileNumber: mobileNumber,
      pp_CNIC: cnicLast6,
      ppmpf_1: orderId,
      ppmpf_2: '',
      ppmpf_3: '',
      ppmpf_4: '',
      ppmpf_5: '',
    };

    fields.pp_SecureHash = await buildSecureHash(fields);

    // Call JazzCash
    const jcResp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(fields),
    });

    const jcText = await jcResp.text();
    let jcJson: Record<string, unknown> = {};
    try {
      jcJson = JSON.parse(jcText);
    } catch {
      // keep raw
    }

    const responseCode = (jcJson.pp_ResponseCode as string) ?? '';
    const responseMsg = (jcJson.pp_ResponseMessage as string) ?? jcText;
    const success = responseCode === '000' || responseCode === '121'; // 000 = success

    // Update payment record
    const paymentStatus = success ? 'completed' : 'failed';
    await admin
      .from('payments')
      .update({
        status: paymentStatus,
        transaction_id: txnRef,
        gateway_response: jcJson,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    // On success, confirm the order automatically
    if (success) {
      await admin
        .from('orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'pending');
    }

    return new Response(
      JSON.stringify({
        success,
        response_code: responseCode,
        message: responseMsg,
        transaction_id: txnRef,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('jazzcash-mwallet error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
