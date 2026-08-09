/**
 * Transaction descriptors: build a reviewable, auditable action from domain data.
 * Cards create descriptors; the transaction state layer runs the confirm → OTP →
 * execute → receipt flow. No business logic lives in the card components.
 */
import { formatInr } from "@/lib/format";
import { telecomService } from "@/services/telecom-service";
import type { AddOn, BillSummary, PlanOption, RechargePack, RoamingPack, TransactionResult } from "@/lib/telecom-types";

export interface TransactionDescriptor {
  id: string;
  title: string;
  summary: string;
  lines: { label: string; value: string }[];
  amount?: number | undefined;
  requiresOtp: boolean;
  danger?: boolean | undefined;
  successTitle: string;
  execute: () => Promise<TransactionResult>;
}

export function rechargeTransaction(pack: RechargePack): TransactionDescriptor {
  return {
    id: pack.id,
    title: "Confirm recharge",
    summary: `Recharge of ${formatInr(pack.amount)} on your number.`,
    lines: [
      { label: "Pack", value: `${pack.id} • ${pack.data}` },
      { label: "Validity", value: `${pack.validityDays} days` },
      { label: "Benefits", value: pack.talktime },
      { label: "Payable now", value: formatInr(pack.amount) },
    ],
    amount: pack.amount,
    requiresOtp: true,
    successTitle: "Recharge successful",
    execute: () => telecomService.recharge(pack.amount, pack.id),
  };
}

export function payBillTransaction(bill: BillSummary): TransactionDescriptor {
  return {
    id: bill.id,
    title: "Confirm bill payment",
    summary: `Pay your ${bill.cycle} statement.`,
    lines: [
      { label: "Invoice", value: bill.id },
      { label: "Billing cycle", value: bill.cycle },
      { label: "Due date", value: bill.dueDate },
      { label: "Payable now", value: formatInr(bill.amount) },
      { label: "Method", value: "UPI • novatel@upi" },
    ],
    amount: bill.amount,
    requiresOtp: true,
    successTitle: "Payment successful",
    execute: () => telecomService.makePayment(bill.amount),
  };
}

export function changePlanTransaction(plan: PlanOption): TransactionDescriptor {
  return {
    id: plan.id,
    title: "Confirm plan change",
    summary: `Move to ${plan.name} from your next bill cycle.`,
    lines: [
      { label: "New plan", value: plan.name },
      { label: "Monthly rental", value: formatInr(plan.price) },
      { label: "Data", value: plan.data },
      { label: "Effective from", value: "01 September 2026" },
    ],
    amount: plan.price,
    requiresOtp: true,
    successTitle: "Plan change scheduled",
    execute: () => telecomService.changePlan(plan.name),
  };
}

export function addonTransaction(addon: AddOn): TransactionDescriptor {
  return {
    id: addon.id,
    title: "Activate add-on",
    summary: `${addon.name} will be added to your account.`,
    lines: [
      { label: "Add-on", value: addon.name },
      { label: "Benefit", value: addon.detail },
      { label: "Validity", value: addon.validity },
      { label: "Charge", value: formatInr(addon.price) },
    ],
    amount: addon.price,
    requiresOtp: true,
    successTitle: "Add-on activated",
    execute: () => telecomService.activateAddon(addon.name, addon.price),
  };
}

export function roamingTransaction(pack: RoamingPack): TransactionDescriptor {
  return {
    id: pack.id,
    title: "Activate international roaming",
    summary: `${pack.name} roaming pack for ${pack.countries}.`,
    lines: [
      { label: "Pack", value: pack.name },
      { label: "Data", value: pack.data },
      { label: "Calls", value: pack.calls },
      { label: "Validity", value: pack.validity },
      { label: "Charge", value: formatInr(pack.price) },
    ],
    amount: pack.price,
    requiresOtp: true,
    successTitle: "Roaming activated",
    execute: () => telecomService.activateRoaming(pack.name, pack.price),
  };
}

export function blockSimTransaction(msisdn: string): TransactionDescriptor {
  return {
    id: "BLOCK-SIM",
    title: "Block SIM immediately",
    summary: "All voice, SMS and data services on this number will stop at once.",
    lines: [
      { label: "Number", value: msisdn },
      { label: "Action", value: "Permanent SIM block" },
      { label: "Restore", value: "Only via replacement SIM at a NovaTel store" },
    ],
    requiresOtp: true,
    danger: true,
    successTitle: "SIM blocked",
    execute: () => telecomService.blockSim(),
  };
}

export function simReplacementTransaction(): TransactionDescriptor {
  return {
    id: "SIM-REPLACE",
    title: "Request replacement SIM",
    summary: "A new 5G SIM will be couriered to your registered address.",
    lines: [
      { label: "Delivery", value: "2 working days" },
      { label: "KYC", value: "Verified – no re-verification needed" },
      { label: "Charge", value: formatInr(50) },
    ],
    amount: 50,
    requiresOtp: true,
    successTitle: "Replacement SIM requested",
    execute: () => telecomService.requestSimReplacement(),
  };
}

export function portabilityTransaction(): TransactionDescriptor {
  return {
    id: "MNP",
    title: "Generate porting code (UPC)",
    summary: "This starts the mobile number portability process for your number.",
    lines: [
      { label: "Validity of UPC", value: "4 days" },
      { label: "Outstanding dues", value: `${formatInr(1126)} must be cleared` },
      { label: "Note", value: "Retention offers may be withdrawn after porting out" },
    ],
    requiresOtp: true,
    danger: true,
    successTitle: "Porting code generated",
    execute: () => telecomService.requestPortability(),
  };
}
