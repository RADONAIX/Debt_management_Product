import { CaseWorkspaceLayout } from "./case-management/CaseWorkspaceLayout";
import { CaseManagementProvider } from "./CaseManagementContext";
import { Toaster } from "@/components/ui/sonner";

const CollectionCase = () => {
  return (
    <CaseManagementProvider>
      <CaseWorkspaceLayout />
      <Toaster />
    </CaseManagementProvider>
  );
};

export default CollectionCase;
