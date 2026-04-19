import React, { createContext, useContext, useState } from 'react';

export interface Business {
  id: string;
  name: string;
  mode: string;
  currency_code: string;
  country: string;
  settings?: Record<string, any>;
}

interface BusinessContextType {
  activeBusiness: Business | null;
  setActiveBusiness: (b: Business) => void;
  businesses: Business[];
  setBusinesses: (b: Business[]) => void;
}

const BusinessContext = createContext<BusinessContextType>({
  activeBusiness: null,
  setActiveBusiness: () => {},
  businesses: [],
  setBusinesses: () => {},
});

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusinessState] = useState<Business | null>(null);

  function setActiveBusiness(b: Business) {
    setActiveBusinessState(b);
    // SecureStore persistence is handled by _layout.tsx (saves full JSON under active_business_json)
  }

  return (
    <BusinessContext.Provider value={{ activeBusiness, setActiveBusiness, businesses, setBusinesses }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}
