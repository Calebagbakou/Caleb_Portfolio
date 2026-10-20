import { useEffect, useState } from 'react';

export function useSlowLoading(isLoading) {
  const [phase, setPhase] = useState('normal');

  useEffect(() => {
    if (!isLoading) {
      setPhase((current) => (current === 'error' ? current : 'normal'));
      return undefined;
    }

    setPhase('normal');
    const slowTimer = window.setTimeout(() => setPhase('slow'), 8000);
    const errorTimer = window.setTimeout(() => setPhase('error'), 20000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(errorTimer);
    };
  }, [isLoading]);

  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowLoader(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowLoader(true), 300);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  return { phase, showLoader };
}
