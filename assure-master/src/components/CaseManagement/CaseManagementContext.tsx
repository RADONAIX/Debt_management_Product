import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Case, mockCases } from './data/mockCases';

interface FilterState {
  search: string;
  segment: string;
  dpd: string;
  status: string;
  priority: string;
  assignedTo: string;
  strategy: string;
}

interface CaseManagementContextType {
  cases: Case[];
  selectedCase: Case | null;
  setSelectedCase: (caseItem: Case | null) => void;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  filteredCases: Case[];
}

const CaseManagementContext = createContext<CaseManagementContextType | undefined>(undefined);

export const CaseManagementProvider = ({ children }: { children: ReactNode }) => {
  const [cases] = useState<Case[]>(mockCases);
  const [selectedCase, setSelectedCase] = useState<Case | null>(mockCases[0]);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    segment: 'all',
    dpd: 'all',
    status: 'all',
    priority: 'all',
    assignedTo: 'all',
    strategy: 'all',
  });

  const filteredCases = cases.filter(caseItem => {
    if (filters.search && !caseItem.customerName.toLowerCase().includes(filters.search.toLowerCase()) &&
        !caseItem.id.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.segment !== 'all' && caseItem.segment !== filters.segment) return false;
    if (filters.status !== 'all' && caseItem.status !== filters.status) return false;
    if (filters.priority !== 'all' && caseItem.priority !== filters.priority) return false;
    if (filters.assignedTo !== 'all' && caseItem.assignedTo !== filters.assignedTo) return false;
    if (filters.strategy !== 'all' && caseItem.strategy !== filters.strategy) return false;
    if (filters.dpd !== 'all') {
      const [min, max] = filters.dpd.split('-').map(Number);
      if (max) {
        if (caseItem.dpd < min || caseItem.dpd > max) return false;
      } else {
        if (caseItem.dpd < min) return false;
      }
    }
    return true;
  });

  return (
    <CaseManagementContext.Provider value={{
      cases,
      selectedCase,
      setSelectedCase,
      filters,
      setFilters,
      filteredCases,
    }}>
      {children}
    </CaseManagementContext.Provider>
  );
};

export const useCaseManagement = () => {
  const context = useContext(CaseManagementContext);
  if (!context) {
    throw new Error('useCaseManagement must be used within CaseManagementProvider');
  }
  return context;
};
