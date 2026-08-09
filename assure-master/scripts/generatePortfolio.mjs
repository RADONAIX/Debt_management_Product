/**
 * Generates src/data/portfolio.json — the canonical account-level dataset the
 * whole app derives from.
 *
 * Deterministic: a seeded PRNG, no Math.random, so regenerating produces a
 * byte-identical file. Re-run with:  node scripts/generatePortfolio.mjs
 *
 * The generator targets a specific narrative (see docs in portfolioMetrics):
 * a shrinking book running ahead of collection pace, with risk concentrating
 * into 90+ DPD — roughly 19% of value held by roughly 7% of accounts.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// mulberry32 — small, fast, deterministic.
function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260720);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);
const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));

/* ── Dimension vocabularies — the single source of truth ───────────────── */

export const SEGMENTS = ["Consumer", "SMB", "Enterprise", "Government"];
export const REGIONS = ["North", "South", "East", "West"];
// Telecom products. This app bills postpaid mobile, fibre, MPLS, IoT — not loans.
export const PRODUCTS = [
  "Mobile Postpaid",
  "Device Financing",
  "Business Fibre",
  "Enterprise Suite",
  "MPLS",
  "IoT Connectivity",
  "Government Connectivity",
];
export const BUCKETS = ["Current", "1-30", "31-60", "61-90", "90+"];
export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

// Which products a segment can actually hold.
const SEGMENT_PRODUCTS = {
  Consumer: ["Mobile Postpaid", "Device Financing"],
  SMB: ["Mobile Postpaid", "Business Fibre", "Device Financing"],
  Enterprise: ["Enterprise Suite", "MPLS", "IoT Connectivity", "Business Fibre"],
  Government: ["Government Connectivity", "MPLS", "IoT Connectivity"],
};

// Balance ranges per segment (AED-scale figures).
const SEGMENT_BALANCE = {
  Consumer: [180, 4_200],
  SMB: [2_400, 28_000],
  Enterprise: [18_000, 210_000],
  Government: [40_000, 320_000],
};

// Target mix: how many accounts per segment.
const SEGMENT_MIX = { Consumer: 300, SMB: 96, Enterprise: 60, Government: 24 };

// Target share of ACCOUNTS per bucket. 90+ is deliberately a small account
// share holding a large value share — that concentration is the story.
const BUCKET_ACCOUNT_MIX = {
  Current: 0.62,
  "1-30": 0.16,
  "31-60": 0.083,
  "61-90": 0.063,
  "90+": 0.074,
};

const DPD_RANGE = {
  Current: [0, 0],
  "1-30": [1, 30],
  "31-60": [31, 60],
  "61-90": [61, 90],
  "90+": [91, 210],
};

const AGENTS = ["AGENT-001", "AGENT-002", "AGENT-003", "AGENT-004", "AGENT-005", "AGENT-006"];

/* Collection channels and dunning strategies. Both escalate with the bucket —
   a current account gets an SMS nudge, a 90+ account gets a pre-legal call. */
export const CHANNELS = ["SMS", "Email", "WhatsApp", "Voicebot", "Dialer"];
export const STRATEGIES = [
  "Soft Reminder",
  "Standard Dunning",
  "AI Adaptive",
  "Intensive Recovery",
  "Pre-Legal",
];

// Channel mix per bucket — cheap digital first, human contact as it ages.
const BUCKET_CHANNELS = {
  Current: ["SMS", "Email", "SMS", "WhatsApp"],
  "1-30": ["SMS", "Email", "WhatsApp", "Voicebot"],
  "31-60": ["WhatsApp", "Voicebot", "Dialer", "Email"],
  "61-90": ["Voicebot", "Dialer", "Dialer", "WhatsApp"],
  "90+": ["Dialer", "Dialer", "Voicebot"],
};

const BUCKET_STRATEGY = {
  Current: "Soft Reminder",
  "1-30": "Standard Dunning",
  "31-60": "AI Adaptive",
  "61-90": "Intensive Recovery",
  "90+": "Pre-Legal",
};

const BUCKET_STAGE = { Current: 1, "1-30": 2, "31-60": 3, "61-90": 4, "90+": 5 };

// Per-channel contact success. Dialer converts best but costs most.
const CHANNEL_SUCCESS = { SMS: 0.18, Email: 0.12, WhatsApp: 0.34, Voicebot: 0.41, Dialer: 0.58 };
// Cost per attempt, in currency units — drives cost-per-contact in the report.
const CHANNEL_COST = { SMS: 0.05, Email: 0.02, WhatsApp: 0.08, Voicebot: 0.35, Dialer: 1.9 };

const CASE_STATUSES = ["Open", "In Progress", "Awaiting Response", "Resolved", "Escalated"];

const FIRST = ["David","Sarah","John","Michael","Emily","Omar","Aisha","Rashid","Fatima","Ahmed","Layla","Yusuf","Noor","Karim","Hana","Tariq","Mariam","Sami","Zara","Bilal"];
const LAST = ["Brown","Mitchell","Anderson","Rodriguez","Chen","Al Mansouri","Haddad","Khan","Al Farsi","Nasser","Siddiqui","Rahman","Aziz","Darwish","Kaur"];
const ORG_A = ["Alpha","Falcon","SkyNet","Gulf","Delta","Orion","Zenith","Vertex","Nova","Pinnacle","Cedar","Sirius"];
const ORG_B = ["Logistics","Manufacturing","PetroTech","Trading","Systems","Holdings","Industries","Networks","Ventures","Group"];
const ORG_C = ["LLC", "FZE", "Co.", "Group", "LLC"];
const GOV = ["Transport Regulation Dept","Municipal Services Authority","Health Authority","Education Council","Civil Defence Dept","Ports Authority"];

function nameFor(segment, i) {
  if (segment === "Consumer") return `${pick(FIRST)} ${pick(LAST)}`;
  if (segment === "Government") return GOV[i % GOV.length];
  return `${pick(ORG_A)} ${pick(ORG_B)} ${pick(ORG_C)}`;
}

const SEG_CODE = { Consumer: "CON", SMB: "SMB", Enterprise: "ENT", Government: "GOV" };

/* ── Build the buckets as an explicit account list ─────────────────────── */

const totalAccounts = Object.values(SEGMENT_MIX).reduce((a, b) => a + b, 0);

// Assign each segment's accounts across buckets following BUCKET_ACCOUNT_MIX.
const plan = [];
for (const [segment, count] of Object.entries(SEGMENT_MIX)) {
  let assigned = 0;
  BUCKETS.forEach((bucket, idx) => {
    const n =
      idx === BUCKETS.length - 1
        ? count - assigned
        : Math.round(count * BUCKET_ACCOUNT_MIX[bucket]);
    assigned += n;
    for (let i = 0; i < n; i++) plan.push({ segment, bucket });
  });
}

const seq = { CON: 0, SMB: 0, ENT: 0, GOV: 0 };

const accounts = plan.map((p, i) => {
  const { segment, bucket } = p;
  const code = SEG_CODE[segment];
  seq[code] += 1;

  const [lo, hi] = SEGMENT_BALANCE[segment];
  // Delinquent accounts skew to larger balances — that is what creates the
  // value concentration in 90+ without inflating the account count. Tuned so
  // 90+ lands near 19% of value on ~7% of accounts.
  const severityLift = { Current: 0.62, "1-30": 0.9, "31-60": 1.2, "61-90": 1.6, "90+": 3.0 }[bucket];
  // Scales the whole book to a believable ~AED 4.3M without changing any ratio.
  const SCALE = 0.32;
  const outstanding = Math.round(between(lo, hi) * severityLift * SCALE);

  const [dLo, dHi] = DPD_RANGE[bucket];
  const dpd = intBetween(dLo, dHi);

  const riskScore =
    bucket === "Current" ? intBetween(8, 42)
    : bucket === "1-30" ? intBetween(30, 58)
    : bucket === "31-60" ? intBetween(48, 72)
    : bucket === "61-90" ? intBetween(62, 84)
    : intBetween(74, 98);

  const riskLevel =
    riskScore >= 85 ? "Critical" : riskScore >= 70 ? "High" : riskScore >= 45 ? "Medium" : "Low";

  const status =
    bucket === "Current" ? "Current"
    : bucket === "90+" ? (rand() < 0.18 ? "Legal" : "Delinquent")
    : "Past Due";

  // Contactability falls as accounts age — the operational reason 90+ is sticky.
  const contactability = Math.round(
    { Current: between(78, 96), "1-30": between(66, 88), "31-60": between(52, 76), "61-90": between(38, 64), "90+": between(22, 52) }[bucket],
  );

  // Recovery this cycle. Current accounts mostly pay; 90+ mostly does not.
  const recoveryPropensity = { Current: 0.34, "1-30": 0.22, "31-60": 0.14, "61-90": 0.09, "90+": 0.05 }[bucket];
  const collectedMTD = Math.round(outstanding * recoveryPropensity * between(0.6, 1.4));
  const targetMTD = Math.round(outstanding * recoveryPropensity * 1.18);

  const ptpCreated = bucket === "Current" ? 0 : rand() < 0.42 ? intBetween(1, 3) : 0;
  const ptpKept = ptpCreated ? Math.round(ptpCreated * (contactability / 100) * between(0.7, 1)) : 0;
  const ptpBroken = ptpCreated - ptpKept;
  const ptpValueAtRisk = ptpBroken ? Math.round(outstanding * between(0.18, 0.42)) : 0;

  const disputesOpen = rand() < 0.06 ? intBetween(1, 2) : 0;
  const disputesPastSla = disputesOpen && rand() < 0.4 ? 1 : 0;
  const disputeValue = disputesOpen ? Math.round(outstanding * between(0.1, 0.35)) : 0;

  const lastContactDays =
    bucket === "Current" ? intBetween(0, 9) : intBetween(0, 34);

  // Prior-cycle balance drives the MoM delta. The book is shrinking overall.
  const priorOutstanding = Math.round(outstanding * between(1.0, 1.12));

  // Engagement: channel escalates with the bucket, success follows the channel.
  const channel = pick(BUCKET_CHANNELS[bucket]);
  const contactAttempts = bucket === "Current" ? intBetween(1, 3) : intBetween(2, 11);
  const contactSuccesses = Math.round(
    contactAttempts * CHANNEL_SUCCESS[channel] * (contactability / 100) * between(0.8, 1.25),
  );
  const channelCost = Number((contactAttempts * CHANNEL_COST[channel]).toFixed(2));

  // Case handling. Only delinquent accounts carry a case.
  const hasCase = bucket !== "Current";
  const caseStatus = hasCase
    ? bucket === "90+"
      ? pick(["Escalated", "In Progress", "Awaiting Response"])
      : pick(CASE_STATUSES)
    : null;
  const resolutionHours = hasCase ? Math.round(between(4, 96)) : null;
  // SLA is 48h; breaches cluster in the aged buckets where contact is hardest.
  const slaBreached = hasCase ? (resolutionHours > 48 ? 1 : 0) : 0;

  return {
    accountId: `ACC-${String(i + 1).padStart(5, "0")}`,
    customerId: `CUST-${code}-${String(seq[code]).padStart(3, "0")}`,
    name: nameFor(segment, seq[code]),
    segment,
    region: pick(REGIONS),
    product: pick(SEGMENT_PRODUCTS[segment]),
    outstanding,
    priorOutstanding,
    dpd,
    agingBucket: bucket,
    riskScore,
    riskLevel,
    status,
    contactability,
    collectedMTD,
    targetMTD,
    ptpCreated,
    ptpKept,
    ptpBroken,
    ptpValueAtRisk,
    disputesOpen,
    disputesPastSla,
    disputeValue,
    lastContactDays,
    assignedAgentId: pick(AGENTS),
    channel,
    contactAttempts,
    contactSuccesses,
    channelCost,
    strategy: BUCKET_STRATEGY[bucket],
    dunningStage: BUCKET_STAGE[bucket],
    caseId: hasCase ? `C-${String(12_000 + i).padStart(5, "0")}` : null,
    caseStatus,
    resolutionHours,
    slaBreached,
  };
});

/* ── Explicit overrides ───────────────────────────────────────────────────
   Hand-set values for specific accounts, applied after generation so they
   survive a regenerate. Keyed by customerId.                                */
const OVERRIDES = {
  // Aged consumer dispute holding collection activity, breaching the 48h SLA.
  "CUST-CON-298": { disputesOpen: 1, disputesPastSla: 1, disputeValueRatio: 0.25 },
};

for (const account of accounts) {
  const o = OVERRIDES[account.customerId];
  if (!o) continue;
  if (o.disputesOpen !== undefined) account.disputesOpen = o.disputesOpen;
  if (o.disputesPastSla !== undefined) account.disputesPastSla = o.disputesPastSla;
  if (o.disputeValueRatio !== undefined) {
    account.disputeValue = Math.round(account.outstanding * o.disputeValueRatio);
  }
}

const sum = (f) => accounts.reduce((s, a) => s + f(a), 0);
const meta = {
  generatedBy: "scripts/generatePortfolio.mjs",
  seed: 20260720,
  currency: "$",
  cycle: { daysElapsed: 22, daysInCycle: 30, label: "MTD · day 22 of 30" },
  dimensions: { segments: SEGMENTS, regions: REGIONS, products: PRODUCTS, buckets: BUCKETS, riskLevels: RISK_LEVELS, channels: CHANNELS, strategies: STRATEGIES },
  slaHours: 48,
  totals: {
    accounts: accounts.length,
    outstanding: sum((a) => a.outstanding),
    collectedMTD: sum((a) => a.collectedMTD),
    targetMTD: sum((a) => a.targetMTD),
  },
};

const out = resolve(__dirname, "../src/data/portfolio.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ meta, accounts }, null, 2) + "\n");

// Report so the generator's narrative can be checked at a glance.
const severe = accounts.filter((a) => a.agingBucket === "90+");
const pct = (n, d) => ((n / d) * 100).toFixed(1);
console.log(`accounts        ${accounts.length}`);
console.log(`outstanding     ${meta.totals.outstanding.toLocaleString()}`);
console.log(`collected MTD   ${meta.totals.collectedMTD.toLocaleString()}`);
console.log(`target MTD      ${meta.totals.targetMTD.toLocaleString()}`);
console.log(`attainment      ${pct(meta.totals.collectedMTD, meta.totals.targetMTD)}%`);
console.log(`90+ value       ${pct(severe.reduce((s, a) => s + a.outstanding, 0), meta.totals.outstanding)}% of book`);
console.log(`90+ accounts    ${pct(severe.length, accounts.length)}% of accounts`);
BUCKETS.forEach((b) => {
  const g = accounts.filter((a) => a.agingBucket === b);
  console.log(`  ${b.padEnd(8)} ${String(g.length).padStart(4)} acct  ${pct(g.reduce((s, a) => s + a.outstanding, 0), meta.totals.outstanding).padStart(5)}% value`);
});
