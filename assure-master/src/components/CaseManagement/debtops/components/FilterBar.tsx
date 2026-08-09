import { Search, Filter, X, LayoutGrid, List } from 'lucide-react';
import { AGENT_OPTIONS, COMPANY_OPTIONS, COUNTRY_OPTIONS } from "../lib/mockData";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface FilterOptions {
  viewMode: 'customer' | 'agent' | 'cases';
  casesViewMode: 'grid' | 'table';
  groupEnterpriseByCompany: boolean;
  selectedAgent: string;
  searchQuery: string;
  customerType: string;
  company: string;
  country: string;
  agingBucket: string;
  riskLevel: string;
  creditScoreRange: string;
  dpdRange: string;
  assignedAgent: string;
  ptpStatus: string;
  disputeStatus: string;
  caseStatus: string;
  legalStatus: string;
  paymentStatus: string;
  dateFrom: string;
  dateTo: string;
}

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void;
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    viewMode: 'customer',
    casesViewMode: 'grid',
    groupEnterpriseByCompany: false,
    selectedAgent: '',
    searchQuery: '',
    customerType: '',
    company: '',
    country: '',
    agingBucket: '',
    riskLevel: '',
    creditScoreRange: '',
    dpdRange: '',
    assignedAgent: '',
    ptpStatus: '',
    disputeStatus: '',
    caseStatus: '',
    legalStatus: '',
    paymentStatus: '',
    dateFrom: '',
    dateTo: ''
  });

  const updateFilter = (key: keyof FilterOptions, value: string | boolean) => {
    const newFilters = { ...filters, [key]: value };
    if (key === 'customerType' && value !== 'Enterprise') {
      newFilters.company = '';
    }
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    const clearedFilters: FilterOptions = {
      viewMode: filters.viewMode,
      casesViewMode: filters.casesViewMode,
      groupEnterpriseByCompany: filters.groupEnterpriseByCompany,
      selectedAgent: '',
      searchQuery: '',
      customerType: '',
      company: '',
      country: '',
      agingBucket: '',
      riskLevel: '',
      creditScoreRange: '',
      dpdRange: '',
      assignedAgent: '',
      ptpStatus: '',
      disputeStatus: '',
      caseStatus: '',
      legalStatus: '',
      paymentStatus: '',
      dateFrom: '',
      dateTo: ''
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(v => v !== '').length;
  };

  const getActiveFilterBadges = () => {
    const badges: { key: keyof FilterOptions; label: string }[] = [];
    if (filters.customerType) badges.push({ key: 'customerType', label: `Type: ${filters.customerType}` });
    if (filters.company) badges.push({ key: 'company', label: `Company: ${filters.company}` });
    if (filters.country) badges.push({ key: 'country', label: `Country: ${filters.country}` });
    if (filters.agingBucket) badges.push({ key: 'agingBucket', label: `Aging: ${filters.agingBucket}` });
    if (filters.riskLevel) badges.push({ key: 'riskLevel', label: `Risk: ${filters.riskLevel}` });
    if (filters.creditScoreRange) badges.push({ key: 'creditScoreRange', label: `Credit: ${filters.creditScoreRange}` });
    if (filters.dpdRange) badges.push({ key: 'dpdRange', label: `DPD: ${filters.dpdRange}` });
    if (filters.assignedAgent) badges.push({ key: 'assignedAgent', label: `Agent: ${filters.assignedAgent}` });
    if (filters.ptpStatus) badges.push({ key: 'ptpStatus', label: `PTP: ${filters.ptpStatus}` });
    if (filters.disputeStatus) badges.push({ key: 'disputeStatus', label: `Dispute: ${filters.disputeStatus}` });
    if (filters.caseStatus) badges.push({ key: 'caseStatus', label: `Case: ${filters.caseStatus}` });
    if (filters.legalStatus) badges.push({ key: 'legalStatus', label: `Legal: ${filters.legalStatus}` });
    if (filters.paymentStatus) badges.push({ key: 'paymentStatus', label: `Payment: ${filters.paymentStatus}` });
    return badges;
  };

  return (
    <div className="space-y-3">
      {/* High-Level View Mode Selector */}
      <div className="flex items-center gap-4 pb-3 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">View by:</span>
        <Select 
          value={filters.viewMode} 
          onValueChange={(value) => updateFilter('viewMode', value as 'customer' | 'agent' | 'cases')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select view mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="cases">Cases</SelectItem>
          </SelectContent>
        </Select>

        {/* Agent Dropdown - Only show when Agent view is selected */}
        {filters.viewMode === 'agent' && (
          <Select 
            value={filters.selectedAgent} 
            onValueChange={(value) => updateFilter('selectedAgent', value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {AGENT_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Cases View Mode Toggle - Only show when Cases view is selected */}
        {filters.viewMode === 'cases' && (
          <div className="flex items-center gap-2">
            <Button
              variant={filters.casesViewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('casesViewMode', 'grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={filters.casesViewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('casesViewMode', 'table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Enterprise Grouping Toggle - Show in Customer and Cases views */}
        {(filters.viewMode === 'customer' || filters.viewMode === 'cases') && (
          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="enterprise-group"
              checked={filters.groupEnterpriseByCompany}
              onCheckedChange={(checked) => updateFilter('groupEnterpriseByCompany', checked)}
            />
            <Label htmlFor="enterprise-group" className="text-sm cursor-pointer">
              {filters.viewMode === 'customer' ? 'Group Enterprise by Company' : 'Group Enterprise Cases'}
            </Label>
          </div>
        )}
      </div>

      {/* Filters available in all views */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, country, or customer ID..."
            className="pl-10"
            value={filters.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
          />
        </div>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {getActiveFilterBadges().length > 0 && (
        <div className="flex flex-wrap gap-2">
          {getActiveFilterBadges().map((badge) => (
            <Badge key={badge.key} variant="secondary" className="gap-1">
              {badge.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter(badge.key, '')}
              />
            </Badge>
          ))}
        </div>
      )}

      <Collapsible open={isOpen}>
        <CollapsibleContent className="bg-card border border-border rounded-lg p-4 space-y-4">
          {/* Date Range Filter */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Date Range</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-2 block">From Date</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-2 block">To Date</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Customer Attributes */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Customer Attributes</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium mb-2 block">Customer Type</label>
                <Select value={filters.customerType} onValueChange={(value) => updateFilter('customerType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Consumer">Consumer</SelectItem>
                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.customerType === 'Enterprise' && (
                <div>
                  <label className="text-xs font-medium mb-2 block">Company</label>
                  <Select value={filters.company} onValueChange={(value) => updateFilter('company', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {COMPANY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium mb-2 block">Country</label>
                <Select value={filters.country} onValueChange={(value) => updateFilter('country', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Aging Bucket</label>
                <Select value={filters.agingBucket} onValueChange={(value) => updateFilter('agingBucket', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Buckets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buckets</SelectItem>
                    <SelectItem value="0-30">0-30 days</SelectItem>
                    <SelectItem value="31-60">31-60 days</SelectItem>
                    <SelectItem value="61-90">61-90 days</SelectItem>
                    <SelectItem value="90+">90+ days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Risk & Scoring */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Risk & Scoring</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium mb-2 block">Risk Level</label>
                <Select value={filters.riskLevel} onValueChange={(value) => updateFilter('riskLevel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Risks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risks</SelectItem>
                    <SelectItem value="Low">Low (0-59)</SelectItem>
                    <SelectItem value="Medium">Medium (60-79)</SelectItem>
                    <SelectItem value="High">High (80+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Credit Score</label>
                <Select value={filters.creditScoreRange} onValueChange={(value) => updateFilter('creditScoreRange', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Scores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scores</SelectItem>
                    <SelectItem value="Excellent">Excellent (750+)</SelectItem>
                    <SelectItem value="Good">Good (650-749)</SelectItem>
                    <SelectItem value="Fair">Fair (550-649)</SelectItem>
                    <SelectItem value="Poor">Poor (&lt;550)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Days Past Due</label>
                <Select value={filters.dpdRange} onValueChange={(value) => updateFilter('dpdRange', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All DPD" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All DPD</SelectItem>
                    <SelectItem value="0-30">0-30 days</SelectItem>
                    <SelectItem value="31-60">31-60 days</SelectItem>
                    <SelectItem value="61-90">61-90 days</SelectItem>
                    <SelectItem value="90+">90+ days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Assigned Agent</label>
                <Select value={filters.assignedAgent} onValueChange={(value) => updateFilter('assignedAgent', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {AGENT_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Collections Workflow */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Collections Workflow</h3>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="text-xs font-medium mb-2 block">PTP Status</label>
                <Select value={filters.ptpStatus} onValueChange={(value) => updateFilter('ptpStatus', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All PTP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All PTP</SelectItem>
                    <SelectItem value="Created">Created</SelectItem>
                    <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                    <SelectItem value="Broken">Broken</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Dispute Status</label>
                <Select value={filters.disputeStatus} onValueChange={(value) => updateFilter('disputeStatus', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Disputes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Disputes</SelectItem>
                    <SelectItem value="Investigating">Investigating</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Case Status</label>
                <Select value={filters.caseStatus} onValueChange={(value) => updateFilter('caseStatus', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Cases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cases</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Legal Status</label>
                <Select value={filters.legalStatus} onValueChange={(value) => updateFilter('legalStatus', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Legal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Legal</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-2 block">Payment Status</label>
                <Select value={filters.paymentStatus} onValueChange={(value) => updateFilter('paymentStatus', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Payments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="Current">Current</SelectItem>
                    <SelectItem value="Late">Late</SelectItem>
                    <SelectItem value="Defaulted">Defaulted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearAllFilters();
                setIsOpen(false);
              }}
            >
              Clear All
            </Button>
            <Button size="sm" onClick={() => setIsOpen(false)}>
              Apply Filters
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
