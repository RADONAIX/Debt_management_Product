import React from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCaseManagement } from "../CaseManagementContext";

export const FilterBar = () => {
  const { filters, setFilters } = useCaseManagement();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const updateFilter = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    setFilters({
      search: '',
      segment: 'all',
      dpd: 'all',
      status: 'all',
      priority: 'all',
      assignedTo: 'all',
      strategy: 'all',
    });
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== 'all' && v !== '').length;

  return (
    <div className="border-b border-border bg-card p-4 space-y-3">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Awaiting Response">Awaiting Response</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Escalated">Escalated</SelectItem>
            <SelectItem value="Legal">Legal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.priority} onValueChange={(v) => updateFilter('priority', v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-2"
        >
          More Filters
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1">
            <X className="h-3 w-3" />
            Clear ({activeFiltersCount})
          </Button>
        )}
      </div>

      {showAdvanced && (
        <div className="flex gap-3 flex-wrap pt-2 border-t">
          <Select value={filters.segment} onValueChange={(v) => updateFilter('segment', v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="Enterprise">Enterprise</SelectItem>
              <SelectItem value="SMB">SMB</SelectItem>
              <SelectItem value="Consumer">Consumer</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.dpd} onValueChange={(v) => updateFilter('dpd', v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="DPD" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All DPD</SelectItem>
              <SelectItem value="0-30">0-30 days</SelectItem>
              <SelectItem value="31-60">31-60 days</SelectItem>
              <SelectItem value="61-90">61-90 days</SelectItem>
              <SelectItem value="91-999">90+ days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.strategy} onValueChange={(v) => updateFilter('strategy', v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strategies</SelectItem>
              <SelectItem value="Aggressive Recovery">Aggressive Recovery</SelectItem>
              <SelectItem value="Negotiation">Negotiation</SelectItem>
              <SelectItem value="Legal Action">Legal Action</SelectItem>
              <SelectItem value="Standard Reminder">Standard Reminder</SelectItem>
              <SelectItem value="Installment Plan">Installment Plan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
