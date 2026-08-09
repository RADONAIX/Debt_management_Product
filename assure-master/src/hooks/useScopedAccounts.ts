import { useMemo } from "react";
import { useCustomerType } from "@/contexts/CustomerTypeContext";
import { ACCOUNTS, scopeAccounts, type Account } from "@/data/portfolioStore";

/**
 * The account list narrowed to the header's Customer Scope selector.
 *
 * Every data screen should derive from this instead of raw ACCOUNTS, so the
 * scope (All / Normal / Enterprise) forks the entire application at once.
 */
export function useScopedAccounts(): Account[] {
  const { customerType } = useCustomerType();
  return useMemo(() => scopeAccounts(ACCOUNTS, customerType), [customerType]);
}
