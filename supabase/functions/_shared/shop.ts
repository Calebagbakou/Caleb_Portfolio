import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('Les identifiants serveur Supabase ne sont pas configurés.');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function getSasPayConfig() {
  const apiKey = Deno.env.get('SAASPAY_API_KEY');
  const liveMode = Deno.env.get('SAASPAY_LIVE') === 'true';
  if (!apiKey) {
    throw new Error('La clé SAASPAY_API_KEY n’est pas configurée.');
  }
  if (liveMode && !apiKey.startsWith('sk_live_')) {
    throw new Error('SAASPAY_LIVE=true exige une clé SAASPAY_API_KEY commençant par sk_live_.');
  }
  return {
    apiBaseUrl: Deno.env.get('SAASPAY_API_URL') || 'https://api.saspay.me/api/v1',
    apiKey,
    liveMode,
    authorizationHeader: `Bearer ${apiKey}`,
  };
}

export function isPaymentSuccessful(result: Record<string, unknown>) {
  return String(result.status || '').toUpperCase() === 'SUCCESS';
}

export async function getOrderReceipt(client: ReturnType<typeof getServiceClient>, orderId: string) {
  const { data, error } = await client
    .from('orders')
    .select(`
      id, ref, status, payment_status, payment_method, total, currency,
      promo_code, promo_discount,
      payment_provider, payment_transaction_id, payment_verified_at,
      customers ( name, contact, email ),
      order_items ( id, product_id, plan_id, product_name, plan_label, unit_price, qty, line_total )
    `)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  return {
    ...data,
    customer: customer ? { name: customer.name, contact: customer.contact, email: customer.email } : null,
    subtotal: Number(data.total) + Number(data.promo_discount || 0),
    discountAmount: Number(data.promo_discount || 0),
    promoCode: data.promo_code || null,
    items: (data.order_items || []).map((item: Record<string, unknown>) => ({
      productId: item.product_id,
      planId: item.plan_id,
      name: item.product_name,
      planLabel: item.plan_label,
      unitPrice: Number(item.unit_price),
      qty: Number(item.qty),
      lineTotal: Number(item.line_total),
    })),
    total: Number(data.total),
  };
}
