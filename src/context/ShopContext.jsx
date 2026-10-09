import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { listShopCatalog, getShopContent } from '../services/shop';

export const DEFAULT_SHOP_CONTENT = {
  shop_hero_title: 'Des outils IA et créatifs premium, activés rapidement.',
  shop_hero_description: 'Abonnements Gemini Pro, CapCut Pro, Canva Pro et plus — sélectionnés par Caleb Creative, activés après commande, avec un accompagnement direct.',
  shop_activation_title: 'Activation rapide',
  shop_activation_description: 'Sous 24 à 48h après commande',
  shop_contact_title: 'Suivi par WhatsApp',
  shop_contact_description: 'Un échange direct, sans robot',
  shop_payment_title: 'Paiement local',
  shop_payment_description: 'Paiement sécurisé par KKiaPay',
};

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [content, setContent] = useState(DEFAULT_SHOP_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadShop() {
      const [catalogResult, contentResult] = await Promise.all([listShopCatalog(), getShopContent()]);
      if (!active) return;
      const loadError = catalogResult.error || contentResult.error;
      if (loadError) {
        console.error('Impossible de charger le catalogue de la boutique depuis Supabase :', loadError);
        setError(loadError.message);
      } else {
        setCatalog(catalogResult.data);
        setContent({ ...DEFAULT_SHOP_CONTENT, ...contentResult.data });
        setError('');
      }
      setLoading(false);
    }

    loadShop();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({
    ...catalog,
    content,
    loading,
    error,
  }), [catalog, content, loading, error]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop doit être utilisé à l’intérieur de <ShopProvider>.');
  return context;
}
