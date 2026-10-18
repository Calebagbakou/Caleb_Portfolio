import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { findProduct, findPlan } from '../data/products';
import { useShop } from './ShopContext';

const CHECKOUT_KEY = 'caleb_boutique_checkout_v1';
const LEGACY_CART_KEY = 'caleb_boutique_cart_v1';
export const LAST_ORDER_KEY = 'caleb_boutique_last_order_v1';

function readCheckoutItem() {
  try {
    const raw = localStorage.getItem(CHECKOUT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.productId === 'string' && typeof parsed.planId === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeCheckoutItem(item) {
  try {
    if (item) localStorage.setItem(CHECKOUT_KEY, JSON.stringify(item));
    else localStorage.removeItem(CHECKOUT_KEY);
  } catch (error) {
    console.error('La sélection de commande ne peut pas être conservée sur cet appareil :', error);
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [item, setItem] = useState(readCheckoutItem);
  const { products, loading: shopLoading, error: shopError } = useShop();

  useEffect(() => {
    localStorage.removeItem(LEGACY_CART_KEY);
  }, []);

  useEffect(() => {
    writeCheckoutItem(item);
  }, [item]);

  useEffect(() => {
    if (!item || shopLoading || shopError || !products.length) return;
    const product = findProduct(item.productId, products);
    const plan = findPlan(product, item.planId);
    if (!product || plan?.active === false) {
      setItem(null);
      return;
    }
    const maxQty = product.allow_multiple_qty ? 20 : 1;
    const qty = Math.min(maxQty, Math.max(1, parseInt(item.qty, 10) || 1));
    if (item.productId !== product.id || item.planId !== plan.id || item.qty !== qty) {
      setItem({ productId: product.id, planId: plan.id, qty });
    }
  }, [item, products, shopLoading, shopError]);

  const buyNow = useCallback((productId, planId, qty = 1) => {
    const product = findProduct(productId, products);
    const maxQty = product?.allow_multiple_qty ? 20 : 1;
    const safeQty = Math.min(maxQty, Math.max(1, parseInt(qty, 10) || 1));
    setItem({ productId, planId, qty: safeQty });
  }, [products]);

  const clear = useCallback(() => setItem(null), []);

  const details = useMemo(() => {
    if (!item) return [];
    const product = findProduct(item.productId, products);
    if (!product) return [];
    const plan = findPlan(product, item.planId);
    if (!plan || plan.active === false) return [];
    const unitPrice = product.promo_price ?? plan.price;
    return [{
      productId: product.id,
      planId: plan.id,
      name: product.name,
      deliveryType: product.delivery_type || 'activate',
      planLabel: plan.label,
      avatar: product.avatar,
      gradient: product.gradient,
      logoUrl: product.logo_url || '',
      imageUrl: product.image_url || '',
      unitPrice,
      currency: plan.currency,
      qty: item.qty,
      lineTotal: unitPrice * item.qty,
    }];
  }, [item, products]);

  const total = useMemo(() => details.reduce((sum, line) => sum + line.lineTotal, 0), [details]);
  const value = { item, details, total, buyNow, clear };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé à l’intérieur de <CartProvider>.');
  return ctx;
}
