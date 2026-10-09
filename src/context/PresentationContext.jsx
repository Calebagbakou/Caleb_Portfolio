import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const PRESENTATION_KEY = 'caleb-portfolio-presentation';
const PresentationContext = createContext(null);

export function PresentationProvider({ children }) {
  const [presentation, setPresentation] = useState(() => {
    try {
      return localStorage.getItem(PRESENTATION_KEY) === 'professional' ? 'professional' : 'creative';
    } catch (error) {
      console.warn('Impossible de lire la présentation mémorisée :', error);
      return 'creative';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PRESENTATION_KEY, presentation);
    } catch (error) {
      console.warn('Impossible de mémoriser la présentation choisie :', error);
    }
  }, [presentation]);

  const value = useMemo(() => ({
    presentation,
    isProfessional: presentation === 'professional',
    togglePresentation: () => setPresentation((current) => (
      current === 'professional' ? 'creative' : 'professional'
    )),
  }), [presentation]);

  return (
    <PresentationContext.Provider value={value}>
      <div className={`public-site${presentation === 'professional' ? ' professional-presentation' : ''}`}>
        {children}
      </div>
    </PresentationContext.Provider>
  );
}

export function usePresentation() {
  const context = useContext(PresentationContext);
  if (!context) throw new Error('usePresentation doit être utilisé dans <PresentationProvider>.');
  return context;
}
