import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portfolioCustomersData } from "./data/customerData";

const CustomerDetails = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  
  const customer = portfolioCustomersData.find(c => c.customerId === customerId);

  if (!customer) {
    return (
      <div className="min-h-screen bg-dashboard-bg p-8">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground">Customer not found</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard-bg p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.customerId} • {customer.segment}</p>
        </div>
        
        {/* Customer details content will go here */}
      </div>
    </div>
  );
};

export default CustomerDetails;
