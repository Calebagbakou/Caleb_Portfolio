import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listShopCatalog, getShopContent } from '../services/shop';
import { getShopErrorMessage } from '../utils/shopErrors';

export const DEFAULT_SHOP_CONTENT = {
  shop_hero_title: 'Des outils IA et créatifs premium, activés rapidement.',
  shop_hero_description: 'Abonnements Gemini Pro, CapCut Pro, Canva Pro et plus — sélectionnés par Caleb Creative, activés après commande, avec un accompagnement direct.',
  shop_activation_title: 'Activation rapide',
  shop_activation_description: 'Sous 24 à 48h après commande',
  shop_contact_title: 'Suivi par WhatsApp',
  shop_contact_description: 'Un échange direct, sans robot',
  shop_payment_title: 'Paiement local',
  shop_payment_description: 'Paiement sécurisé par SasPay',
};

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [content, setContent] = useState(DEFAULT_SHOP_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const retryLoad = useCallback(() => {
    setError('');
    setLoading(true);
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 21000);
    setLoading(true);
    setError('');

    async function loadShop() {
      try {
        const [catalogResult, contentResult] = await Promise.all([
          listShopCatalog({ signal: controller.signal }),
          getShopContent({ signal: controller.signal }),
        ]);
        if (!active) return;
        if (controller.signal.aborted) {
          setError('La connexion prend trop de temps. Réessayez ou contactez Caleb sur WhatsApp.');
          return;
        }
        const loadError = catalogResult.error || contentResult.error;
        if (loadError) {
          console.error('Impossible de charger le catalogue de la boutique depuis Supabase :', loadError);
          setError(getShopErrorMessage(loadError, 'La boutique est momentanément indisponible. Réessayez dans quelques instants.'));
        } else {
          setCatalog(catalogResult.data);
          setContent({ ...DEFAULT_SHOP_CONTENT, ...contentResult.data });
          setError('');
        }
      } catch (loadError) {
        if (!active) return;
        console.error('Erreur inattendue pendant le chargement de la boutique :', loadError);
        setError(controller.signal.aborted
          ? 'La connexion prend trop de temps. Réessayez ou contactez Caleb sur WhatsApp.'
          : getShopErrorMessage(loadError, 'La boutique est momentanément indisponible. Réessayez dans quelques instants.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadShop();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [reloadKey]);

  const value = useMemo(() => ({
    ...catalog,
    content,
    loading,
    error,
    retryLoad,
  }), [catalog, content, loading, error, retryLoad]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop doit être utilisé à l’intérieur de <ShopProvider>.');
  return context;
}
