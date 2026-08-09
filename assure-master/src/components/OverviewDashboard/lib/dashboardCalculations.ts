import { Customer, UnifiedCustomer } from "../data/customerData";

export interface DashboardMetrics {
  totalOutstanding: string;
  totalOutstandingTrend: number;
  atRiskAmount: string;
  atRiskChange: number;
  collectionsToday: string;
  collectionsTarget: string;
  carForecast: string;
  riskLevel: "low" | "medium" | "high";
}

export const calculateDashboardMetrics = (
  customers: UnifiedCustomer[],
  selectedCustomerId: string | null,
  filters: { segment: string; region: string; productType: string; agingBucket: string }
): DashboardMetrics => {

  // 1 — FILTER SECTION
  let filtered = selectedCustomerId
    ? customers.filter((c) => c.customerId === selectedCustomerId)
    : customers;

  // Segment filter
  if (filters.segment !== "all") {
    filtered = filtered.filter((c) =>
      c.segment?.toLowerCase() === filters.segment.toLowerCase()
    );
  }

  // 2 — NORMALIZATION HELPERS

  // Get outstanding amount
  const getOutstanding = (c: UnifiedCustomer) => {
    if ("currentMonthUsageBilling" in c) {
      const b = c.currentMonthUsageBilling.billingBreakdown;
      return b.basePlan + b.deviceFinancing + b.roamingCharges + b.valueAddedServices;
    }
    return c.totalOutstanding ?? 0;
  };

  // Map portfolio riskScore → riskLevel
  const getRiskLevel = (c: UnifiedCustomer) => {
    if ("riskLevel" in c) return c.riskLevel;

    if (c.riskScore >= 75) return "High Risk";
    if (c.riskScore >= 55) return "Medium Risk";
    return "Low Risk";
  };

  const getPaidToday = (c: UnifiedCustomer) => {
    if ("paymentHistory" in c) {
      return c.paymentHistory
        .filter((p) => p.status === "paid" && new Date(p.date).toDateString() === new Date().toDateString())
        .reduce((sum, p) => sum + p.amount, 0);
    }
    return 0;
  };

  // 3 — CALCULATIONS

  const totalOutstanding = filtered.reduce((s, c) => s + getOutstanding(c), 0);

  const atRiskAmount = filtered
    .filter((c) => getRiskLevel(c) !== "Low Risk")
    .reduce((s, c) => s + getOutstanding(c), 0);

  const paidToday = filtered.reduce((s, c) => s + getPaidToday(c), 30000);

  const carForecast = totalOutstanding * 0.85;

  // risk Level Calculation
  const highRiskCount = filtered.filter((c) => getRiskLevel(c) === "High Risk").length;
  const riskRatio = filtered.length ? highRiskCount / filtered.length : 0;

  const riskLevel = riskRatio > 0.3 ? "high" : riskRatio > 0.15 ? "medium" : "low";

  return {
    totalOutstanding: formatCurrency(totalOutstanding),
    totalOutstandingTrend: -3.7,
    atRiskAmount: formatCurrency(atRiskAmount),
    atRiskChange: 13,
    collectionsToday: formatCurrency(paidToday),
    collectionsTarget: "80k-100k",
    carForecast: formatCurrency(carForecast),
    riskLevel,
  };
};


const formatCurrency = (amount: number): string => {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2)} B`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)} M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)} K`;
  }
  return amount.toFixed(0);
};
