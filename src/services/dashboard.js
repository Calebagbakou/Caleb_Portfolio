/* =========================================================================
   SERVICE — STATISTIQUES DU DASHBOARD ADMIN
   -------------------------------------------------------------------------
   Compte les lignes des tables déjà présentes dans le schéma Supabase
   (voir supabase/schema.sql). Les écrans de gestion pour projects/
   services/products/orders/customers ne sont pas encore construits
   (identique au comportement d'avant la migration), mais les tables
   existent déjà et les compteurs sont donc lus en direct.
   ========================================================================= */

import { supabase } from './supabase';

export async function getDashboardStats() {
  const [projects, services, products, orders, customers, messages] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('services').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
  ]);

  const results = { projects, services, products, orders, customers, messages };
  const firstError = Object.values(results).find((r) => r.error)?.error || null;

  return {
    counts: {
      projects: projects.count ?? null,
      services: services.count ?? null,
      products: products.count ?? null,
      orders: orders.count ?? null,
      customers: customers.count ?? null,
      unreadMessages: messages.count ?? null,
    },
    error: firstError,
  };
}
