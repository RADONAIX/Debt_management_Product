import CaseDashboard from "./debtops/CaseDashboard";

/**
 * Case Management.
 *
 * The full operations dashboard — Customer / Agent / Cases views with their
 * filters, drawers and modals — ported natively from the debtops dashboard,
 * replacing the previous iframe.
 */
export default function CaseManagement() {
  return <CaseDashboard />;
}
