// Agent data structure for customer assignments
export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  specialization: string[];
  expertise: string;
  status: "available" | "busy" | "offline";
  currentCaseload: number;
  maxCaseload: number;
  performanceRating: number;
  yearsExperience: number;
  languages: string[];
}

export const AGENTS: Agent[] = [
  {
    id: "AGENT-001",
    name: "John Smith",
    email: "john.smith@collections.com",
    phone: "+1-555-2001",
    department: "Premium Collections",
    specialization: ["Premium Customers", "Payment Plans", "Medical Hardships"],
    expertise: "Senior Collections Specialist",
    status: "available",
    currentCaseload: 4,
    maxCaseload: 15,
    performanceRating: 4.8,
    yearsExperience: 8,
    languages: ["English", "Spanish"]
  },
  {
    id: "AGENT-002",
    name: "Mike Johnson",
    email: "mike.johnson@company.com",
    phone: "+1-555-2002",
    department: "Business Collections",
    specialization: ["Business Accounts", "Dispute Resolution", "Legal Issues"],
    expertise: "Business Collections Manager",
    status: "busy",
    currentCaseload: 10,
    maxCaseload: 15,
    performanceRating: 4.6,
    yearsExperience: 12,
    languages: ["English"]
  },
  {
    id: "AGENT-003",
    name: "Jennifer Lee",
    email: "jennifer.lee@company.com",
    phone: "+1-555-2003",
    department: "Enterprise Relations",
    specialization: ["Enterprise Accounts", "Account Reviews", "Contract Management"],
    expertise: "Enterprise Account Manager",
    status: "available",
    currentCaseload: 7,
    maxCaseload: 20,
    performanceRating: 4.9,
    yearsExperience: 10,
    languages: ["English", "Korean", "Mandarin"]
  },
  {
    id: "AGT004",
    name: "Robert Kim",
    email: "robert.kim@company.com",
    phone: "+1-555-2004",
    department: "Customer Service",
    specialization: ["Service Upgrades", "Technical Support", "Account Modifications"],
    expertise: "Senior Customer Service Rep",
    status: "available",
    currentCaseload: 55,
    maxCaseload: 70,
    performanceRating: 4.4,
    yearsExperience: 6,
    languages: ["English", "Korean"]
  },
  {
    id: "AGT005",
    name: "Lisa Davis",
    email: "lisa.davis@company.com",
    phone: "+1-555-2005",
    department: "Standard Collections",
    specialization: ["Standard Accounts", "Payment Reminders", "Early Intervention"],
    expertise: "Collections Specialist",
    status: "offline",
    currentCaseload: 65,
    maxCaseload: 80,
    performanceRating: 4.3,
    yearsExperience: 4,
    languages: ["English"]
  },
  {
    id: "AGT006",
    name: "Carlos Rodriguez",
    email: "carlos.rodriguez@company.com",
    phone: "+1-555-2006",
    department: "Recovery",
    specialization: ["High-Risk Accounts", "Legal Recovery", "Debt Settlement"],
    expertise: "Recovery Specialist",
    status: "busy",
    currentCaseload: 40,
    maxCaseload: 50,
    performanceRating: 4.7,
    yearsExperience: 9,
    languages: ["English", "Spanish", "Portuguese"]
  }
];

// Helper function to get agent by ID
export const getAgentById = (agentId: string): Agent | undefined => {
  return AGENTS.find(agent => agent.id === agentId);
};

// Helper function to assign agent based on customer segment
export const getAgentBySegment = (segment: string, riskBand: string): string => {
  if (segment === "Enterprise") return "AGT003"; // Jennifer Lee
  if (segment === "Premium") return "AGT001"; // Sarah Wilson
  if (segment === "Business") return "AGT002"; // Mike Johnson
  if (riskBand === "high") return "AGT006"; // Carlos Rodriguez
  return "AGT005"; // Lisa Davis for Standard customers
};