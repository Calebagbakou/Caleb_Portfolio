import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import kkiapay from 'npm:@kkiapay-org/nodejs-sdk@1.0.7';

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

export function getPaymentClient() {
  const privatekey = Deno.env.get('KKIAPAY_PRIVATE_KEY');
  const publickey = Deno.env.get('KKIAPAY_PUBLIC_KEY');
  const secretkey = Deno.env.get('KKIAPAY_SECRET_KEY');
  if (!privatekey || !publickey || !secretkey) {
    throw new Error('Les clés serveur KKiaPay ne sont pas toutes configurées.');
  }
  return kkiapay({
    privatekey,
    publickey,
    secretkey,
    sandbox: Deno.env.get('KKIAPAY_SANDBOX') !== 'false',
  });
}

export function isPaymentSuccessful(result: Record<string, unknown>) {
  return String(result.status || '').toUpperCase() === 'SUCCESS';
}

export async function getOrderReceipt(client: ReturnType<typeof getServiceClient>, orderId: string) {
  const { data, error } = await client
    .from('orders')
    .select(`
      id, ref, status, payment_status, payment_method, total, currency,
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
