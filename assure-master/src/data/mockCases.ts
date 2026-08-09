/**
 * Canonical import path for case data.
 *
 * Five files under components/CaseManagement/case-management/tabs/ import from
 * "@/data/mockCases", which did not exist — those imports were silently broken.
 * The definitions live with the feature; this re-export makes the canonical
 * path resolve.
 */
export * from "@/components/CaseManagement/data/mockCases";
