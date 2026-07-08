// JazzCash Hosted Checkout (MIGS - Card Payment) — redirect flow
// Returns endpoint + signed fields; frontend auto-submits a form to JazzCash.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MERCHANT_ID = Deno.env.get('JAZZCASH_MERCHANT_ID')!;
const PASSWORD = Deno.env.get('JAZZCASH_PASSWORD')!;
const SALT = Deno.env.get('JAZZCASH_INTEGRITY_SALT')!;
const ENV = (Deno.env.get('JAZZCASH_ENV') ?? 'sandbox').toLowerCase();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

const ENDPOINT =
  ENV === 'live'
    ? 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/'
    : 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      SUPABASE_URL,
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

    const body = await req.json();
    const orderId: string | undefined = body.order_id;
    const returnOrigin: string | undefined = body.return_origin;

    if (!orderId || !returnOrigin) {
      return new Response(
        JSON.stringify({ error: 'order_id and return_origin are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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

    const now = new Date();
    const expiry = new Date(now.getTime() + 60 * 60 * 1000);
    const txnRef = 'T' + pktStamp(now) + Math.floor(Math.random() * 900 + 100).toString();
    const amountPaisa = Math.round(Number(order.total) * 100).toString();

    // Encode return origin in ppmpf_1 so the return handler can bounce back to the SPA
    const fields: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: 'MIGS',
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
      pp_Description: `FoodXpress order ${order.order_number ?? ''}`.slice(0, 50),
      pp_TxnExpiryDateTime: pktStamp(expiry),
      pp_ReturnURL: `${SUPABASE_URL}/functions/v1/jazzcash-return`,
      ppmpf_1: orderId,
      ppmpf_2: returnOrigin,
      ppmpf_3: '',
      ppmpf_4: '',
      ppmpf_5: '',
    };

    fields.pp_SecureHash = await buildSecureHash(fields);

    // Record txn ref on the payment row so we can look it up on return
    await admin
      .from('payments')
      .update({
        transaction_id: txnRef,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    return new Response(
      JSON.stringify({ endpoint: ENDPOINT, fields }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('jazzcash-hosted-checkout error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
