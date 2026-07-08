// JazzCash Hosted Checkout return handler.
// JazzCash POSTs form-encoded response here. We verify the hash, update
// payment/order records, and 302-redirect the user back to the SPA.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SALT = Deno.env.get('JAZZCASH_INTEGRITY_SALT')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function buildSecureHash(fields: Record<string, string>): Promise<string> {
  const keys = Object.keys(fields)
    .filter(
      (k) =>
        k.startsWith('pp_') &&
        k !== 'pp_SecureHash' &&
        fields[k] !== '' &&
        fields[k] !== undefined &&
        fields[k] !== null,
    )
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

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  try {
    // Accept both POST (form) and GET (some fallback flows)
    const fields: Record<string, string> = {};
    if (req.method === 'POST') {
      const form = await req.formData();
      for (const [k, v] of form.entries()) fields[k] = String(v);
    } else {
      const url = new URL(req.url);
      url.searchParams.forEach((v, k) => (fields[k] = v));
    }

    const orderId = fields['ppmpf_1'] || '';
    const returnOrigin = fields['ppmpf_2'] || '';
    const responseCode = fields['pp_ResponseCode'] || '';
    const responseMsg = fields['pp_ResponseMessage'] || '';
    const receivedHash = fields['pp_SecureHash'] || '';

    const fallback = returnOrigin || 'https://food-xpress.lovable.app';
    const successRoute = `${fallback}/payment/callback`;

    // Verify hash
    const expected = await buildSecureHash(fields);
    const hashOk = expected === receivedHash;

    const success = hashOk && (responseCode === '000' || responseCode === '121');
    const status = success ? 'completed' : 'failed';

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (orderId) {
      await admin
        .from('payments')
        .update({
          status,
          gateway_response: fields,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      if (success) {
        await admin
          .from('orders')
          .update({ status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', orderId)
          .eq('status', 'pending');
      }
    }

    const qs = new URLSearchParams({
      status: success ? 'success' : 'failed',
      order: orderId,
      code: responseCode,
      message: responseMsg.slice(0, 200),
      hash_ok: hashOk ? '1' : '0',
    });
    return redirect(`${successRoute}?${qs.toString()}`);
  } catch (err) {
    console.error('jazzcash-return error:', err);
    const fallback = 'https://food-xpress.lovable.app/payment/callback?status=failed&message=' +
      encodeURIComponent(err instanceof Error ? err.message : 'Return handler error');
    return redirect(fallback);
  }
});
