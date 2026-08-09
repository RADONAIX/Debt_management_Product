export interface Customer360 {
  customer_id: string;
  customer_type: 'Consumer' | 'Enterprise';
  full_name?: string;
  company_name?: string;
  contact_number: string;
  email: string;
  country: string;
  risk_score: number;
  credit_score: number;
  days_past_due: number;
  aging_bucket: '0-30' | '31-60' | '61-90' | '90+';
  total_outstanding: number;
  status: string;
  assigned_agent?: string;
  ban?: string; // For Enterprise customers
  msisdn?: string; // Mobile number
}

export interface PTPPromise {
  ptp_id: string;
  customer_id: string;
  customer_type?: 'Consumer' | 'Enterprise';
  promised_amount: number;
  promised_date: string;
  status: 'Created' | 'Fulfilled' | 'Broken';
  created_at?: string;
  ban?: string;
  msisdn?: string;
  invoice_no?: string;
}

export interface Dispute {
  dispute_id: string;
  customer_id: string;
  customer_type?: 'Consumer' | 'Enterprise';
  invoice_id?: string;
  invoice_no?: string;
  ban?: string;
  msisdn?: string;
  line_item_id?: string;
  reason: string;
  status: 'Investigating' | 'Approved' | 'Rejected';
  filed_date: string;
  amount?: number;
}

export interface CaseManagement {
  case_id: string;
  customer_id: string;
  customer_type?: 'Consumer' | 'Enterprise';
  case_type: 'Billing Issue' | 'Broken PTP' | 'Legal Followup';
  opened_date: string;
  status: 'Open' | 'In Progress' | 'Closed';
  summary: string;
  assigned_agent?: string;
  ban?: string;
  msisdn?: string;
  invoice_no?: string;
  line_item_id?: string;
  amount_disputed?: number;
}

export interface LegalEscalation {
  escalation_id: string;
  customer_id: string;
  customer_type?: 'Consumer' | 'Enterprise';
  agency_name: string;
  outstanding_amount: number;
  recovered_amount: number;
  efficiency_score: number;
  status: 'Active' | 'Completed' | 'Pending';
  escalated_at: string;
  ban?: string;
  msisdn?: string;
  invoice_no?: string;
}

export interface Invoice {
  invoice_id: string;
  account_id: string;
  bill_period_start: string;
  bill_period_end: string;
  due_date: string;
  amount: number;
  service: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
}

export interface Payment {
  payment_id: string;
  customer_id: string;
  invoice_id?: string;
  amount_paid: number;
  payment_date: string;
  method: string;
  status: string;
}

export interface BehaviorInsights {
  customer_id: string;
  contactability: number;
  ptp_success_rate: number;
  dispute_rate: number;
  last_updated: string;
}
