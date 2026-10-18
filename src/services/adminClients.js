import { supabase } from './supabase';

const ORDER_PAGE_SIZE = 500;
const NOTES_BATCH_SIZE = 200;

function getCustomerIdentity(customer) {
  const email = String(customer.email || '').trim().toLowerCase();
  if (/^deleted-.+@invalid\.local$/.test(email)) {
    return { key: `deleted:${email}`, anonymized: true };
  }
  if (email) return { key: `email:${email}`, anonymized: false };

  const phone = String(customer.contact || '').replace(/\D/g, '');
  if (phone) return { key: `phone:${phone}`, anonymized: false };
  return { key: `customer:${customer.id}`, anonymized: false };
}

export async function listAdminClients() {
  const orders = [];
  for (let offset = 0; ; offset += ORDER_PAGE_SIZE) {
    const { data: page, error: ordersError } = await supabase
      .from('orders')
      .select(`
      id, ref, status, payment_status, total, created_at, fulfillment_status,
      customers ( id, name, contact, email ),
      order_items ( id, product_name, plan_label, qty, line_total )
    `)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + ORDER_PAGE_SIZE - 1);

    if (ordersError) return { data: null, error: ordersError, notesError: null };
    orders.push(...(page || []));
    if ((page || []).length < ORDER_PAGE_SIZE) break;
  }

  const groupedClients = new Map();
  for (const order of orders || []) {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    if (!customer?.id) continue;

    const { key, anonymized } = getCustomerIdentity(customer);
    let client = groupedClients.get(key);
    if (!client) {
      client = {
        id: key,
        name: anonymized ? 'Compte supprimé' : customer.name || 'Client sans nom',
        contact: anonymized ? '' : customer.contact || '',
        email: anonymized ? '' : customer.email || '',
        anonymized,
        noteCustomerId: customer.id,
        noteAnchorDate: order.created_at,
        orders: [],
      };
      groupedClients.set(key, client);
    }

    if (order.created_at && (!client.noteAnchorDate || order.created_at < client.noteAnchorDate)) {
      client.noteAnchorDate = order.created_at;
      client.noteCustomerId = customer.id;
    }
    client.orders.push(order);
  }

  const clients = [...groupedClients.values()].map((client) => {
    const paidOrders = client.orders.filter((order) => order.payment_status === 'confirme');
    const latestOrder = client.orders.reduce((latest, order) => (
      !latest || new Date(order.created_at).getTime() > new Date(latest.created_at).getTime()
        ? order
        : latest
    ), null);
    return {
      ...client,
      paidOrderCount: paidOrders.length,
      totalSpent: paidOrders.reduce((total, order) => total + (Number(order.total) || 0), 0),
      latestOrderAt: latestOrder?.created_at || null,
    };
  });

  let notesError = null;
  const noteClients = clients.filter((client) => !client.anonymized);
  for (let offset = 0; offset < noteClients.length; offset += NOTES_BATCH_SIZE) {
    const batch = noteClients.slice(offset, offset + NOTES_BATCH_SIZE);
    const { data: notes, error } = await supabase
      .from('admin_customer_notes')
      .select('customer_id, note, updated_at')
      .in('customer_id', batch.map((client) => client.noteCustomerId));
    if (error) {
      console.error('Impossible de charger les notes privées des clients :', error);
      notesError = error;
      break;
    }

    const notesByCustomer = new Map((notes || []).map((item) => [item.customer_id, item]));
    for (const client of batch) {
      const note = notesByCustomer.get(client.noteCustomerId);
      client.note = note?.note || '';
      client.noteUpdatedAt = note?.updated_at || null;
    }
  }

  return { data: clients, error: null, notesError };
}

export function saveAdminCustomerNote({ customerId, note, updatedBy }) {
  if (!customerId || typeof note !== 'string' || note.length > 3000) {
    return Promise.resolve({ error: new Error('La note doit contenir au maximum 3 000 caractères.') });
  }

  if (!note.trim()) {
    return supabase.from('admin_customer_notes').delete().eq('customer_id', customerId);
  }

  return supabase.from('admin_customer_notes').upsert({
    customer_id: customerId,
    note: note.trim(),
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  }, { onConflict: 'customer_id' });
}
