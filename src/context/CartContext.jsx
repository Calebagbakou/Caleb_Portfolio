/* =========================================================================
   CART CONTEXT — CALEB CREATIVE BOUTIQUE
   -------------------------------------------------------------------------
   Port direct de l'ancien boutique/assets/cart.js, sous forme de contexte
   React. Le panier reste stocké dans le navigateur du visiteur
   (localStorage) : aucune donnée n'est envoyée à un serveur, il n'y a pas
   de vrai paiement — la commande se conclut via WhatsApp (voir la page
   Confirmation), exactement comme avant la migration.
   ========================================================================= */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { findProduct, findPlan } from '../data/products';

const CART_KEY = 'caleb_boutique_cart_v1';
export const LAST_ORDER_KEY = 'caleb_boutique_last_order_v1';

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    /* stockage indisponible (navigation privée, quota...) : on ignore silencieusement */
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readCart());

  useEffect(() => {
    writeCart(items);
  }, [items]);

  const add = useCallback((productId, planId, qty = 1) => {
    const safeQty = Math.max(1, parseInt(qty, 10) || 1);
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === productId && it.planId === planId);
      if (existing) {
        return prev.map((it) =>
          it.productId === productId && it.planId === planId ? { ...it, qty: it.qty + safeQty } : it
        );
      }
      return [...prev, { productId, planId, qty: safeQty }];
    });
  }, []);

  const updateQty = useCallback((productId, planId, qty) => {
    const parsed = parseInt(qty, 10);
    setItems((prev) => {
      if (!parsed || parsed < 1) {
        return prev.filter((it) => !(it.productId === productId && it.planId === planId));
      }
      return prev.map((it) =>
        it.productId === productId && it.planId === planId ? { ...it, qty: parsed } : it
      );
    });
  }, []);

  const remove = useCallback((productId, planId) => {
    setItems((prev) => prev.filter((it) => !(it.productId === productId && it.planId === planId)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const details = useMemo(() => {
    return items
      .map((it) => {
        const product = findProduct(it.productId);
        if (!product) return null;
        const plan = findPlan(product, it.planId);
        if (!plan) return null;
        return {
          productId: product.id,
          planId: plan.id,
          name: product.name,
          planLabel: plan.label,
          avatar: product.avatar,
          gradient: product.gradient,
          unitPrice: plan.price,
          qty: it.qty,
          lineTotal: plan.price * it.qty,
        };
      })
      .filter(Boolean);
  }, [items]);

  const count = useMemo(() => items.reduce((sum, it) => sum + it.qty, 0), [items]);
  const total = useMemo(() => details.reduce((sum, line) => sum + line.lineTotal, 0), [details]);

  const value = { items, details, count, total, add, updateQty, remove, clear };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé à l’intérieur de <CartProvider>.');
  return ctx;
}
