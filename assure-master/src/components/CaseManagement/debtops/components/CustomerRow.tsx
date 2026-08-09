import { useState } from 'react';
import { ChevronRight, Eye, Pencil } from 'lucide-react';
import { Customer360 } from '../types/customer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { CustomerDetails } from './CustomerDetails';
import { mockPTPs, mockDisputes, mockCases, mockLegalEscalations, mockInvoices, mockPayments } from '../lib/mockData';

interface CustomerRowProps {
  customer: Customer360;
  onViewProfile: (customer: Customer360) => void;
}

export function CustomerRow({ customer, onViewProfile }: CustomerRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getInitials = () => {
    if (customer.customer_type === 'Enterprise' && customer.company_name) {
      return customer.company_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    }
    return customer.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'NA';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'bg-risk-high text-white';
    if (score >= 60) return 'bg-risk-medium text-white';
    return 'bg-risk-low text-white';
  };

  const getAgingColor = (bucket: string) => {
    switch (bucket) {
      case '0-30': return 'bg-aging-0-30 text-white';
      case '31-60': return 'bg-aging-31-60 text-white';
      case '61-90': return 'bg-aging-61-90 text-white';
      case '90+': return 'bg-aging-90-plus text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden transition-all hover:shadow-md">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-90"
          )}
        />
        
        <Avatar className="h-10 w-10 border-2 border-border">
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 grid grid-cols-[2fr,1fr,1fr,1fr,1.5fr,1fr,1fr,1fr,1fr,1.5fr,auto] gap-4 items-center">
          <div>
            <div className="font-semibold text-foreground">
              {customer.customer_type === 'Enterprise' ? customer.company_name : customer.full_name}
            </div>
            <div className="text-xs text-muted-foreground">{customer.customer_id}</div>
          </div>

          <Badge variant="outline" className="justify-center">
            {customer.customer_type}
          </Badge>

          <div className="text-sm text-muted-foreground">{customer.country}</div>

          <div className="font-semibold text-foreground">
            ${customer.total_outstanding.toLocaleString()}
          </div>

          <Badge className={getAgingColor(customer.aging_bucket)}>
            {customer.aging_bucket} days
          </Badge>

          <div className="text-sm text-muted-foreground">{customer.days_past_due}d</div>

          <Badge className={getRiskColor(customer.risk_score)}>
            {customer.risk_score}
          </Badge>

          <div className="text-sm text-muted-foreground">{customer.credit_score}</div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{customer.assigned_agent || 'Unassigned'}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile(customer);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border bg-muted/30 p-4 animate-in slide-in-from-top-2">
              <CustomerDetails
                customer={customer}
                ptps={mockPTPs[customer.customer_id] || []}
                disputes={mockDisputes[customer.customer_id] || []}
                cases={mockCases[customer.customer_id] || []}
                legalEscalations={mockLegalEscalations[customer.customer_id] || []}
                invoices={mockInvoices[customer.customer_id] || []}
                payments={mockPayments[customer.customer_id] || []}
              />
        </div>
      )}
    </div>
  );
}
