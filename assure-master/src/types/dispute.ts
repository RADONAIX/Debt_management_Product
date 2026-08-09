/**
 * Canonical import path for dispute types.
 *
 * "@/types/dispute" was imported by dispute components but never existed.
 * The definitions live with the AIDispute feature; this re-export makes the
 * canonical path resolve.
 */
export * from "@/components/CaseManagement/AIDispute/types/dispute";
