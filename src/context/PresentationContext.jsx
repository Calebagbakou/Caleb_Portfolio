import { createContext, useContext, useMemo, useState } from 'react';

const PresentationContext = createContext(null);

export function PresentationProvider({ children }) {
  const [presentation, setPresentation] = useState('professional');

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
