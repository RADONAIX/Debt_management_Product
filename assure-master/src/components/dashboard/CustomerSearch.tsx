import { useState } from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { portfolioCustomersData } from "@/data/customerData";
import { useNavigate } from "react-router-dom";

interface CustomerSearchProps {
  onSelectCustomer: (customerId: string | null) => void;
  selectedCustomerId: string | null;
}

// const portfolioCustomersData = [
//   { id: "CUST-CON-003", name: "Sarah Mitchell", riskScore: 85 },
//   { id: "CUST-CON-002", name: "David Brown", riskScore: 62 },
//   { id: "CUST-CON-004", name: "Fatima Al Zahra", riskScore: 28 },
// ];

export const CustomerSearch = ({ onSelectCustomer, selectedCustomerId , setActiveModule , setSelectedCustomer}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  const selectedCustomer = portfolioCustomersData.find(c => c.customerId === selectedCustomerId);
  // const selectedCustomer = portfolioCustomersData.find(c => c.id === selectedCustomerId);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[300px] justify-between bg-dashboard-card border-dashboard-border text-foreground hover:bg-dashboard-card/80"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedCustomer ? (
                <span>{selectedCustomer.name}</span>
              ) : (
                <span className="text-muted-foreground">Search customer...</span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-dashboard-card border-dashboard-border">
          <Command className="bg-dashboard-card">
            <CommandInput placeholder="Search customer..." className="text-foreground" />
            <CommandList>
              <CommandEmpty>No customer found.</CommandEmpty>
              <CommandGroup>
                {portfolioCustomersData.map((customer) => (
                  <CommandItem
                    key={customer.customerId}
                    value={customer.name}
                    onSelect={() => {
                      onSelectCustomer(customer.customerId);
                      setOpen(false);
                    }}
                    className="cursor-pointer hover:bg-dashboard-border/20"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{customer.name}</span>
                      <span className="text-xs text-muted-foreground">{customer.customerId}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedCustomerId && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // navigate(`/customer/${selectedCustomerId}`)
              setSelectedCustomer(selectedCustomerId);
              setActiveModule("customer_360");
            }}
            className="h-10 px-3"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectCustomer(null)}
            className="h-10 px-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
};
