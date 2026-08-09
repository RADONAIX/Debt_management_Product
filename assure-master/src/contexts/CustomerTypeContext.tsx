import React, { createContext, useContext, useState, ReactNode } from 'react';

type CustomerType = 'all' | 'normal' | 'enterprise';

interface CustomerTypeContextType {
  customerType: CustomerType;
  setCustomerType: (type: CustomerType) => void;
}

const CustomerTypeContext = createContext<CustomerTypeContextType | undefined>(undefined);

export const useCustomerType = () => {
  const context = useContext(CustomerTypeContext);
  if (context === undefined) {
    throw new Error('useCustomerType must be used within a CustomerTypeProvider');
  }
  return context;
};

export const CustomerTypeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customerType, setCustomerType] = useState<CustomerType>('all');

  return (
    <CustomerTypeContext.Provider value={{ customerType, setCustomerType }}>
      {children}
    </CustomerTypeContext.Provider>
  );
};