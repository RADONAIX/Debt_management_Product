import { Play, MessageSquare, Mail, MessageCircle, Phone, Target, FileText, CreditCard, Send, AlertCircle, UserPlus } from "lucide-react";

export interface WorkflowTemplate {
  id: string;
  name: string;
  segment: string;
  aging: string;
  riskLevel: string;
  status: "Active" | "Draft";
  customers: number;
  uplift: string;
  version: string;
  lastModified: string;
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    x: number;
    y: number;
    timing?: string;
    message?: string;
    condition?: string;
  }>;
  connections: Array<{
    from: string;
    to: string;
  }>;
}

// Default workflow used for all strategies (unless they have a saved custom workflow)
// Clean branching layout with two parallel recovery paths
// export const DEFAULT_WORKFLOW = {
//   nodes: [
//     { id: "default-start", type: "start", label: "Start", x: 0, y: 300 },
//     { id: "default-sms", type: "SMS", label: "SMS Reminder", x: 130, y: 305, timing: "Day 60", message: "Payment reminder SMS" },
//     { id: "default-wait1", type: "AI Next Best Action", label: "Wait Timer", x: 280, y: 200, timing: "Day 39", message: "Wait period" },
//     { id: "default-email", type: "Email", label: "Email Reminder", x: 420, y: 205, timing: "Day 42", message: "Email payment reminder" },
//     { id: "default-voicebot-left", type: "AI Dialer", label: "AI Voicebot Attempt", x: 560, y: 200, timing: "Esho Select Police", message: "Voice attempt" },
//     { id: "default-wait2", type: "AI Next Best Action", label: "Wait Timer", x: 280, y: 400, timing: "Day 43", message: "Wait period" },
//     { id: "default-voicebot", type: "VA", label: "AI Voicebot Negotiation", x: 420, y: 405, timing: "Day 42", message: "AI negotiation call" },
//     { id: "default-ptp", type: "Creds PTP", label: "PTP Node", x: 610, y: 400, timing: "Auto to date PTP", message: "Promise to pay" },
//     { id: "default-whatsapp", type: "WhatsApp", label: "WhatsApp Follow-up", x: 740, y: 405, message: "WA follow-up message" },
//     { id: "default-escalation", type: "AI Next Best Action", label: "Escalation Node", x: 845, y: 300, condition: "Escalate if needed" },
//   ],
//   connections: [
//     { from: "default-start", to: "default-sms" },
//     { from: "default-sms", to: "default-wait1" },
//     { from: "default-sms", to: "default-wait2" },
//     { from: "default-wait1", to: "default-email" },
//     { from: "default-email", to: "default-voicebot-left" },
//     { from: "default-wait2", to: "default-voicebot" },
//     { from: "default-voicebot", to: "default-ptp" },
//     { from: "default-ptp", to: "default-whatsapp" },
//     { from: "default-whatsapp", to: "default-escalation" },
//     { from: "default-voicebot-left", to: "default-escalation" },
//   ],
// };


export const DEFAULT_WORKFLOW = {
  nodes: [
    // -------------------------
    // MAIN STRAIGHT VERTICAL FLOW
    // -------------------------
    {
      id: "step-60",
      type: "SMS",
      label: "SMS + WhatsApp (Legal Tone)",
      x: 200,
      y: 50,
      timing: "DPD 60",
      message: "Customer receives strong reminder about overdue balance.",
    },

    {
      id: "step-62",
      type: "AI Dialer",
      label: "AI Voicebot (Hard Script)",
      x: 203,
      y: 140,
      timing: "DPD 62",
      message: "AI Voicebot calls with firm tone, detects intent.",
    },

    {
      id: "step-63",
      type: "Predictive Dialer",
      label: "Agent Call (Hard Bucket)",
      x: 200,
      y: 240,
      timing: "DPD 63",
      message: "Agent negotiates payment/PTP.",
    },

    {
      id: "step-75",
      type: "Escalation",
      label: "Supervisor Escalation Queue",
      x: 103,
      y: 340,
      timing: "DPD 75",
      message: "Supervisor reviews account and plans next action.",
    },

    {
      id: "step-80",
      type: "Supervisor Dialer",
      label: "Supervisor Dialer Call",
      x: 200,
      y: 430,
      timing: "DPD 80",
      message: "Senior agent makes final attempt before legal.",
    },

    {
      id: "step-85",
      type: "SMS",
      label: "Pre-Legal Warning (SMS + Email)",
      x: 203,
      y: 530,
      timing: "DPD 85",
      message: "Final warning before legal handover.",
    },

    {
      id: "step-90",
      type: "Legal Case",
      label: "Pre-Legal Case Creation",
      x: 550,
      y: 460,
      timing: "DPD 90",
      message: "Legal case created and automated dunning stops.",
    },

    // -------------------------
    // PTP BESIDE SUPERVISOR QUEUE (ONLY SIDE NODE)
    // -------------------------
    {
      id: "step-76",
      type: "PTP",
      label: "PTP Created",
      x: 353,        // positioned beside supervisor queue
      y: 340,
      timing: "DPD 76",
      message: "PTP logged from voicebot/agent interaction.",
    },
  ],

  connections: [
    // vertical straight-line
    { from: "step-60", to: "step-62" },
    { from: "step-62", to: "step-63" },
    { from: "step-63", to: "step-75" },
    { from: "step-75", to: "step-80" },
    { from: "step-80", to: "step-85" },
    { from: "step-85", to: "step-90" },

    // single clean branch
    { from: "step-63", to: "step-76" },
    { from: "step-76", to: "step-80" },
  ],
};





export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "soft-reminder",
    name: "Soft Reminder Journey – Early Overdue",
    segment: "Customer",
    aging: "0-30 days",
    riskLevel: "Low",
    status: "Active",
    customers: 8920,
    uplift: "3.2%",
    version: "v1.8",
    lastModified: "08 Nov",
    nodes: [
      { id: "soft-start", type: "start", label: "Start", x: 100, y: 50 },
      { id: "soft-1", type: "SMS", label: "SMS Reminder", x: 100, y: 150, timing: "Day 2", message: "Gentle reminder about your payment" },
      { id: "soft-2", type: "Email", label: "Email Reminder", x: 300, y: 150, timing: "Day 5", message: "Payment reminder with invoice" },
      { id: "soft-3", type: "WhatsApp", label: "WhatsApp Nudge", x: 500, y: 150, timing: "Day 7", message: "Quick payment link via WhatsApp" },
      { id: "soft-4", type: "AI Dialer", label: "Voicebot (gentle tone)", x: 700, y: 150, timing: "Day 10", message: "Gentle voice reminder" },
      { id: "soft-5", type: "AI Next Best Action", label: "Pause Node", x: 900, y: 150, timing: "Day 12", condition: "Stop if contact made" },
    ],
    connections: [
      { from: "soft-start", to: "soft-1" },
      { from: "soft-1", to: "soft-2" },
      { from: "soft-2", to: "soft-3" },
      { from: "soft-3", to: "soft-4" },
      { from: "soft-4", to: "soft-5" },
    ],
  },
  {
    id: "standard-recovery",
    name: "Standard Recovery Journey – Mid Overdue",
    segment: "Customer",
    aging: "31-60 days",
    riskLevel: "Medium",
    status: "Active",
    customers: 4310,
    uplift: "7.8%",
    version: "v2.4",
    lastModified: "07 Nov",
    nodes: [
      { id: "std-start", type: "start", label: "Start", x: 100, y: 50 },
      { id: "std-1", type: "SMS", label: "SMS + Email Combo", x: 100, y: 150, timing: "Day 31", message: "Important: Account overdue notice" },
      { id: "std-2", type: "AI Dialer", label: "AI Dialer Attempt", x: 300, y: 150, timing: "Day 33", message: "Automated call to discuss payment" },
      { id: "std-3", type: "VA", label: "AI Voicebot Negotiation", x: 500, y: 150, timing: "Day 35", message: "Virtual agent negotiation" },
      { id: "std-4", type: "Creds PTP", label: "Create PTP Node", x: 700, y: 150, timing: "Day 36", message: "Promise to pay capture" },
      { id: "std-5", type: "WhatsApp", label: "WhatsApp Reminder for PTP", x: 900, y: 150, timing: "Day 37", message: "PTP reminder via WhatsApp" },
      { id: "std-6", type: "AI Next Best Action", label: "Escalation Node", x: 1100, y: 150, timing: "Day 40", condition: "If PTP broken" },
    ],
    connections: [
      { from: "std-start", to: "std-1" },
      { from: "std-1", to: "std-2" },
      { from: "std-2", to: "std-3" },
      { from: "std-3", to: "std-4" },
      { from: "std-4", to: "std-5" },
      { from: "std-5", to: "std-6" },
    ],
  },
  {
    id: "intensive-collections",
    name: "Intensive Collections Journey – Hard Bucket",
    segment: "Customer",
    aging: "61-90 days",
    riskLevel: "High",
    status: "Active",
    customers: 2780,
    uplift: "16.1%",
    version: "v3.1",
    lastModified: "09 Nov",
    nodes: [
      { id: "int-start", type: "start", label: "Start", x: 100, y: 50 },
      { id: "int-1", type: "AI Dialer", label: "AI Dialer Priority Call", x: 100, y: 150, timing: "Day 61", message: "Priority dialer attempt" },
      { id: "int-2", type: "VA", label: "Voicebot – Strict Tone", x: 300, y: 150, timing: "Day 63", message: "Strict voice message" },
      { id: "int-3", type: "WhatsApp", label: "WhatsApp Legal Warning", x: 500, y: 150, timing: "Day 65", message: "Legal notice via WhatsApp" },
      { id: "int-4", type: "Creds PTP", label: "PTP or Installment Plan", x: 700, y: 150, timing: "Day 67", message: "PTP or installment plan" },
      { id: "int-5", type: "IVR", label: "Agent Callback", x: 900, y: 150, timing: "Day 69", message: "Agent callback required" },
      { id: "int-6", type: "AI Next Best Action", label: "Escalation Node – High Risk", x: 1100, y: 150, timing: "Day 72", condition: "Escalate to legal" },
    ],
    connections: [
      { from: "int-start", to: "int-1" },
      { from: "int-1", to: "int-2" },
      { from: "int-2", to: "int-3" },
      { from: "int-3", to: "int-4" },
      { from: "int-4", to: "int-5" },
      { from: "int-5", to: "int-6" },
    ],
  },
  {
    id: "enterprise-recovery",
    name: "Enterprise Recovery Path – 30/60/90",
    segment: "Enterprise",
    aging: "30-90 days",
    riskLevel: "Medium",
    status: "Active",
    customers: 1250,
    uplift: "12.4%",
    version: "v3.0",
    lastModified: "08 Nov",
    nodes: [
      { id: "ent-start", type: "start", label: "Start", x: 100, y: 50 },
      { id: "ent-1", type: "SMS", label: "Dedicated Enterprise SMS", x: 100, y: 150, timing: "Day 30", message: "Professional payment reminder" },
      { id: "ent-2", type: "Email", label: "Email with Invoice Pack", x: 300, y: 150, timing: "Day 32", message: "Invoice pack email" },
      { id: "ent-3", type: "RPA Bot", label: "RPA: Invoice Verification Pre-Check", x: 500, y: 150, timing: "Day 33", message: "Automated invoice verification" },
      { id: "ent-4", type: "Notify Agent", label: "Relationship Manager Alert", x: 700, y: 150, timing: "Day 35", message: "Alert relationship manager" },
      { id: "ent-5", type: "Send Payment", label: "Payment Plan Generator", x: 900, y: 150, timing: "Day 37", message: "Generate payment plan options" },
      { id: "ent-6", type: "AI Next Best Action", label: "Supervisor Escalation", x: 1100, y: 150, timing: "Day 40", condition: "Route to supervisor" },
    ],
    connections: [
      { from: "ent-start", to: "ent-1" },
      { from: "ent-1", to: "ent-2" },
      { from: "ent-2", to: "ent-3" },
      { from: "ent-3", to: "ent-4" },
      { from: "ent-4", to: "ent-5" },
      { from: "ent-5", to: "ent-6" },
    ],
  },
  {
    id: "ptp-commitment",
    name: "PTP Commitment Follow-Up Journey",
    segment: "Cross-Segment",
    aging: "Conditional",
    riskLevel: "Medium",
    status: "Active",
    customers: 2120,
    uplift: "9.7%",
    version: "v1.5",
    lastModified: "10 Nov",
    nodes: [
      { id: "ptp-start", type: "start", label: "Start", x: 100, y: 50 },
      { id: "ptp-1", type: "SMS", label: "Reminder 24 Hours Before PTP", x: 100, y: 150, timing: "24h before", message: "PTP reminder 24 hours before" },
      { id: "ptp-2", type: "Send Payment", label: "Send Payment Link", x: 300, y: 150, timing: "PTP day", message: "Send payment link" },
      { id: "ptp-3", type: "VA", label: "Voicebot Reminder Call", x: 500, y: 150, timing: "2h before", message: "Voice reminder 2 hours before" },
      { id: "ptp-4", type: "AI Next Best Action", label: "Escalate if Overdue", x: 700, y: 150, timing: "If overdue", condition: "If PTP not honored" },
      { id: "ptp-5", type: "Close Case", label: "Auto-Close Case If PTP Honored", x: 700, y: 280, timing: "If paid", condition: "If PTP honored" },
    ],
    connections: [
      { from: "ptp-start", to: "ptp-1" },
      { from: "ptp-1", to: "ptp-2" },
      { from: "ptp-2", to: "ptp-3" },
      { from: "ptp-3", to: "ptp-4" },
      { from: "ptp-3", to: "ptp-5" },
    ],
  },
  {
    id: "government-secure",
    name: "Government Secure Reminder Flow",
    segment: "Government",
    aging: "11-30 days",
    riskLevel: "Low",
    status: "Active",
    customers: 120,
    uplift: "1.9%",
    version: "v1.3",
    lastModified: "03 Jan",
    nodes: [
      { id: "gov-start", type: "start", label: "Start", x: 100, y: 50 },
      { id: "gov-1", type: "SMS", label: "Secure SMS Reminder", x: 100, y: 150, timing: "Day 11", message: "Official government payment reminder" },
      { id: "gov-2", type: "Email", label: "Email with Case File Summary", x: 300, y: 150, timing: "Day 15", message: "Case file summary email" },
      { id: "gov-3", type: "RPA Bot", label: "Automated Letter Dispatch (RPA)", x: 500, y: 150, timing: "Day 18", message: "Automated letter dispatch" },
      { id: "gov-4", type: "IVR", label: "Government Hotline IVR Call", x: 700, y: 150, timing: "Day 22", message: "IVR call to government hotline" },
      { id: "gov-5", type: "AI Next Best Action", label: "Escalation to Government Officer", x: 900, y: 150, timing: "Day 25", condition: "Escalate to liaison" },
    ],
    connections: [
      { from: "gov-start", to: "gov-1" },
      { from: "gov-1", to: "gov-2" },
      { from: "gov-2", to: "gov-3" },
      { from: "gov-3", to: "gov-4" },
      { from: "gov-4", to: "gov-5" },
    ],
  },
];
