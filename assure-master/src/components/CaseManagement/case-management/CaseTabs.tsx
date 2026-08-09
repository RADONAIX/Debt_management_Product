import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTimeline } from "./tabs/ActivityTimeline";
import { InteractionsNotes } from "./tabs/InteractionsNotes";
import { PromiseToPayPanel } from "./tabs/PromiseToPayPanel";
import { DisputeManagement } from "./tabs/DisputeManagement";
import { PaymentsSettlement } from "./tabs/PaymentsSettlement";
import { useCaseManagement } from "../CaseManagementContext";

export const CaseTabs = () => {
  const { selectedCase } = useCaseManagement();

  if (!selectedCase) return null;

  return (
    <Tabs defaultValue="activity" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-4">
        <TabsTrigger value="activity" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-2">
          Activity
        </TabsTrigger>
        <TabsTrigger value="notes" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-2">
          Notes
        </TabsTrigger>
        <TabsTrigger value="ptp" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-2">
          PTP
        </TabsTrigger>
        <TabsTrigger value="disputes" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-2">
          Disputes
        </TabsTrigger>
        <TabsTrigger value="payments" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-2">
          Payments
        </TabsTrigger>
      </TabsList>

      <TabsContent value="activity" className="mt-0">
        <ActivityTimeline activities={selectedCase.activities} />
      </TabsContent>

      <TabsContent value="notes" className="mt-0">
        <InteractionsNotes notes={selectedCase.notes} />
      </TabsContent>

      <TabsContent value="ptp" className="mt-0">
        <PromiseToPayPanel ptps={selectedCase.ptps} />
      </TabsContent>

      <TabsContent value="disputes" className="mt-0">
        <DisputeManagement disputes={selectedCase.disputes} />
      </TabsContent>

      <TabsContent value="payments" className="mt-0">
        <PaymentsSettlement payments={selectedCase.payments} totalAmount={selectedCase.amount} />
      </TabsContent>
    </Tabs>
  );
};
