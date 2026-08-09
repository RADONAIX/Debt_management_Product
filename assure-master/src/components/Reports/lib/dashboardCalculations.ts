import { Customer } from "@/data/customerData";

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
  customers: Customer[],
  selectedCustomerId: string | null,
  filters: { segment: string; region: string; productType: string; agingBucket: string }
): DashboardMetrics => {
  // Filter customers based on selected customer or filters
  let filteredCustomers = customers;
  
  if (selectedCustomerId) {
    filteredCustomers = customers.filter(c => c.customerId === selectedCustomerId);
  } else {
    // Apply filters when no specific customer is selected
    filteredCustomers = customers.filter(customer => {
      // For now, we'll simulate filter logic since customer data doesn't have these fields
      // In a real app, you'd filter based on actual customer properties
      
      // Risk level based filtering for segment simulation
      if (filters.segment !== "all") {
        // Map segments to risk levels for demonstration
        if (filters.segment === "government" && customer.riskLevel !== "Low Risk") return false;
        if (filters.segment === "enterprise" && customer.riskLevel === "Low Risk") return false;
      }
      
      // Region filter - would normally check customer.region
      // For demo, we'll use address to simulate regions
      if (filters.region !== "all") {
        const address = customer.accountInformation.contactInformation.address.toLowerCase();
        if (filters.region === "north" && !address.includes("dubai")) return false;
        if (filters.region === "south" && !address.includes("sharjah")) return false;
        if (filters.region === "east" && !address.includes("ajman")) return false;
      }
      
      // Product type filter - using plan name as proxy
      if (filters.productType !== "all") {
        const planName = customer.accountInformation.contractDetails.planName.toLowerCase();
        if (filters.productType === "loan" && !planName.includes("postpaid")) return false;
        // Add more product type logic as needed
      }
      
      // Aging bucket filter - using tenure months as proxy
      if (filters.agingBucket !== "all") {
        const tenure = customer.accountInformation.contractDetails.tenureMonths;
        if (filters.agingBucket === "0-30" && tenure > 5) return false;
        if (filters.agingBucket === "31-60" && (tenure <= 5 || tenure > 12)) return false;
        if (filters.agingBucket === "61-90" && (tenure <= 12 || tenure > 18)) return false;
        if (filters.agingBucket === "90+" && tenure <= 18) return false;
      }
      
      return true;
    });
  }

  // Calculate metrics based on filtered customers
  const totalOutstanding = filteredCustomers.reduce((sum, customer) => {
    const billing = customer.currentMonthUsageBilling.billingBreakdown;
    return sum + billing.basePlan + billing.deviceFinancing + billing.roamingCharges + billing.valueAddedServices;
  }, 0);

  const atRiskCustomers = filteredCustomers.filter(c => c.riskLevel !== "Low Risk");
  const atRiskAmount = atRiskCustomers.reduce((sum, customer) => {
    const billing = customer.currentMonthUsageBilling.billingBreakdown;
    return sum + billing.basePlan + billing.deviceFinancing + billing.roamingCharges + billing.valueAddedServices;
  }, 0);

  const paidToday = filteredCustomers.reduce((sum, customer) => {
    const todayPayments = customer.paymentHistory.filter(p => {
      const paymentDate = new Date(p.date);
      const today = new Date();
      return paymentDate.toDateString() === today.toDateString() && p.status === "paid";
    });
    return sum + todayPayments.reduce((psum, p) => psum + p.amount, 0);
  }, 0);

  // Calculate 30-day forecast
  const monthlyTotal = filteredCustomers.reduce((sum, customer) => {
    const billing = customer.currentMonthUsageBilling.billingBreakdown;
    return sum + billing.basePlan + billing.deviceFinancing + billing.roamingCharges + billing.valueAddedServices;
  }, 0);
  const carForecast = monthlyTotal * 0.85; // 85% collection rate assumption

  // Determine risk level
  const highRiskCount = filteredCustomers.filter(c => c.riskLevel === "High Risk").length;
  const totalCount = filteredCustomers.length;
  const riskRatio = totalCount > 0 ? highRiskCount / totalCount : 0;
  
  let riskLevel: "low" | "medium" | "high" = "low";
  if (riskRatio > 0.3) riskLevel = "high";
  else if (riskRatio > 0.15) riskLevel = "medium";

  return {
    totalOutstanding: formatCurrency(totalOutstanding),
    totalOutstandingTrend: -3.7,
    atRiskAmount: formatCurrency(atRiskAmount),
    atRiskChange: 13,
    collectionsToday: formatCurrency(paidToday),
    collectionsTarget: "38-42.0M",
    carForecast: formatCurrency(carForecast),
    riskLevel
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
