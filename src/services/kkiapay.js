const PUBLIC_KEY = import.meta.env.VITE_KKIAPAY_PUBLIC_KEY || '';
const SANDBOX = import.meta.env.VITE_KKIAPAY_SANDBOX !== 'false';
const CALLBACKS_KEY = '__calebKkiaPayCallbacks';
let sdkLoadPromise;

export function isKkiaPayConfigured() {
  return Boolean(PUBLIC_KEY);
}

function loadKkiaPaySdk() {
  if (window.openKkiapayWidget && window.addSuccessListener && window.addFailedListener) {
    return Promise.resolve();
  }
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://cdn.kkiapay.me/k.js"]');
    const script = existing || document.createElement('script');
    const onLoad = () => {
      if (window.openKkiapayWidget && window.addSuccessListener && window.addFailedListener) resolve();
      else reject(new Error('Le SDK KKiaPay a été chargé mais son widget est indisponible.'));
    };
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Impossible de charger le SDK officiel KKiaPay.')), { once: true });
    if (!existing) {
      script.src = 'https://cdn.kkiapay.me/k.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    sdkLoadPromise = null;
    throw error;
  });

  return sdkLoadPromise;
}

function installKkiaPayListeners() {
  if (window[CALLBACKS_KEY]) return window[CALLBACKS_KEY];
  const subscribers = { success: new Set(), failure: new Set() };
  window[CALLBACKS_KEY] = subscribers;
  window.addSuccessListener((response) => {
    subscribers.success.forEach((callback) => callback(response));
  });
  window.addFailedListener((error) => {
    subscribers.failure.forEach((callback) => callback(error));
  });
  return subscribers;
}

export async function startKkiaPayPayment({ order, customer }) {
  if (!PUBLIC_KEY) {
    throw new Error('La clé publique KKiaPay n’est pas configurée pour le site.');
  }
  await loadKkiaPaySdk();
  const subscribers = installKkiaPayListeners();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      subscribers.success.delete(onSuccess);
      subscribers.failure.delete(onFailure);
    };
    const onSuccess = (response) => {
      cleanup();
      resolve(response);
    };
    const onFailure = (error) => {
      cleanup();
      reject(new Error(error?.message || 'Le paiement KKiaPay n’a pas abouti.'));
    };
    subscribers.success.add(onSuccess);
    subscribers.failure.add(onFailure);

    try {
      window.openKkiapayWidget({
        amount: Number(order.total),
        key: PUBLIC_KEY,
        sandbox: SANDBOX,
        position: 'center',
        theme: '#CCFF00',
        partnerId: order.ref,
        data: order.ref,
        name: customer.name,
        phone: customer.contact,
        email: customer.email || undefined,
        countries: ['BJ'],
      });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
