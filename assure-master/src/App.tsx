import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CustomerTypeProvider } from "@/contexts/CustomerTypeContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CustomerDetail from "./components/360Overview/CustomerDetail";
import CustomerProfile from "./components/360Overview/CustomerProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CustomerTypeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
             <Route path="/customer/:customerId" element={<CustomerDetail />} />
            <Route path="/customer-profile/:customerId" element={<CustomerProfile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </CustomerTypeProvider>
  </QueryClientProvider>
);

export default App;
