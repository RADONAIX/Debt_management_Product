export interface Activity {
  id: string;
  type: 'sms' | 'call' | 'whatsapp' | 'email' | 'note' | 'ptp' | 'payment' | 'system';
  title: string;
  description?: string;
  timestamp: string;
  agent?: string;
}

export interface Note {
  id: string;
  content: string;
  type: 'internal' | 'customer-facing';
  timestamp: string;
  agent: string;
  attachments?: string[];
}

export interface PTP {
  id: string;
  amount: number;
  date: string;
  status: 'Honored' | 'Missed' | 'Pending';
  createdAt: string;
}

export interface Dispute {
  id: string;
  reason: string;
  status: 'Submitted' | 'Under Review' | 'Resolved' | 'Rejected';
  evidence: string[];
  createdAt: string;
  slaDeadline: string;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string;
  status: string;
  linkSent?: boolean;
}

export interface Case {
  id: string;
  customerId: string;
  customerName: string;
  customerType: 'Enterprise' | 'SMB' | 'Consumer';
  aging: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  amount: number;
  currency: string;
  status: 'Open' | 'In Progress' | 'Awaiting Response' | 'Resolved' | 'Escalated' | 'Legal';
  priority: 'High' | 'Medium' | 'Low';
  assignedTo: string;
  lastActivity: string;
  segment: string;
  dpd: number;
  strategy: string;
  dunningStage: string;
  contactability: number;
  lastPaymentDate: string;
  predictedPayment: number;
  activities: Activity[];
  notes: Note[];
  ptps: PTP[];
  disputes: Dispute[];
  payments: Payment[];
  slaDeadline: string;
}

export const mockCases: Case[] = [
  {
    id: 'C-12451',
    customerId: 'CUST-ENT-001',
    customerName: 'Alpha Logistics LLC',
    customerType: 'Enterprise',
    aging: 68,
    riskLevel: 'Critical',
    amount: 243300,
    currency: '$',
    status: 'In Progress',
    priority: 'High',
    assignedTo: 'John Smith',
    lastActivity: '2 hrs ago',
    segment: 'Enterprise',
    dpd: 68,
    strategy: 'Aggressive Recovery',
    dunningStage: 'Stage 3',
    contactability: 75,
    lastPaymentDate: '2024-11-10',
    predictedPayment: 12000,
    slaDeadline: '2025-11-15T18:00:00',
    activities: [
      { id: 'a1', type: 'call', title: 'Outbound Call', description: 'Discussed payment plan', timestamp: '2 hrs ago', agent: 'Ahmed S' },
      { id: 'a2', type: 'sms', title: 'SMS Reminder', description: 'Payment due reminder sent', timestamp: '1 day ago' },
      { id: 'a3', type: 'email', title: 'Email Sent', description: 'Invoice reminder', timestamp: '3 days ago' },
    ],
    notes: [
      { id: 'n1', content: 'Customer requested payment extension', type: 'internal', timestamp: '2 hrs ago', agent: 'Ahmed S' }
    ],
    ptps: [
      { id: 'p1', amount: 10000, date: '2025-11-20', status: 'Pending', createdAt: '2025-11-14' }
    ],
    disputes: [],
    payments: [
      { id: 'pay1', amount: 5000, date: '2024-11-10', method: 'Bank Transfer', status: 'Completed' }
    ]
  },
  {
    id: 'C-12452',
    customerId: 'CUST-ENT-002',
    customerName: 'Gulf PetroTech',
    customerType: 'Enterprise',
    aging: 45,
    riskLevel: 'High',
    amount: 167900,
    currency: '$',
    status: 'Escalated',
    priority: 'High',
    assignedTo: 'Mike Johnson',
    lastActivity: '1 day ago',
    segment: 'Enterprise',
    dpd: 45,
    strategy: 'Legal Action',
    dunningStage: 'Stage 5',
    contactability: 35,
    lastPaymentDate: '2024-07-15',
    predictedPayment: 3000,
    slaDeadline: '2025-11-16T12:00:00',
    activities: [
      { id: 'a4', type: 'system', title: 'Case Escalated', description: 'Escalated to recovery agency', timestamp: '1 day ago' },
      { id: 'a5', type: 'call', title: 'Dialer Attempt', description: 'No answer', timestamp: '3 days ago' },
    ],
    notes: [],
    ptps: [],
    disputes: [
      { id: 'd1', reason: 'Service not delivered', status: 'Under Review', evidence: ['invoice.pdf'], createdAt: '2025-11-10', slaDeadline: '2025-11-17' }
    ],
    payments: []
  },
  {
    id: 'C-12453',
    customerId: 'CUST-CON-001',
    customerName: 'David Brown',
    customerType: 'Consumer',
    aging: 20,
    riskLevel: 'Low',
    amount: 280,
    currency: '$',
    status: 'Open',
    priority: 'Low',
    assignedTo: 'Unassigned',
    lastActivity: '3 hrs ago',
    segment: 'Consumer',
    dpd: 20,
    strategy: 'Standard Reminder',
    dunningStage: 'Stage 1',
    contactability: 85,
    lastPaymentDate: '2024-10-12',
    predictedPayment: 520,
    slaDeadline: '2025-11-15T23:59:00',
    activities: [
      { id: 'a6', type: 'whatsapp', title: 'WhatsApp Message', description: 'Payment reminder sent', timestamp: '3 hrs ago' },
    ],
    notes: [],
    ptps: [],
    disputes: [],
    payments: []
  },
  {
    id: 'C-12454',
    customerId: 'CUST-CON-002',
    customerName: 'Sarah Mitchell',
    customerType: 'Consumer',
    aging: 45,
    riskLevel: 'Medium',
    amount: 650,
    currency: '$',
    status: 'Awaiting Response',
    priority: 'Medium',
    assignedTo: 'Jennifer Lee',
    lastActivity: '5 hrs ago',
    segment: 'Enterprise',
    dpd: 45,
    strategy: 'Negotiation',
    dunningStage: 'Stage 2',
    contactability: 92,
    lastPaymentDate: '2024-09-30',
    predictedPayment: 15000,
    slaDeadline: '2025-11-16T09:00:00',
    activities: [
      { id: 'a7', type: 'email', title: 'Payment Link Sent', timestamp: '5 hrs ago' },
      { id: 'a8', type: 'note', title: 'Agent Note', description: 'Client reviewing payment options', timestamp: '6 hrs ago', agent: 'Sarah M' },
    ],
    notes: [
      { id: 'n2', content: 'Client reviewing payment options with finance team', type: 'internal', timestamp: '6 hrs ago', agent: 'Sarah M' }
    ],
    ptps: [],
    disputes: [],
    payments: []
  },
  {
    id: 'C-12455',
    customerId: 'CUST-SMB-002',
    customerName: 'Start Foods LLC',
    customerType: 'SMB',
    aging: 15,
    riskLevel: 'Low',
    amount: 4200,
    currency: '$',
    status: 'Open',
    priority: 'Low',
    assignedTo: 'Unassigned',
    lastActivity: '4 hrs ago',
    segment: 'SMB',
    dpd: 15,
    strategy: 'Installment Plan',
    dunningStage: 'Stage 3',
    contactability: 68,
    lastPaymentDate: '2024-08-15',
    predictedPayment: 4000,
    slaDeadline: '2025-11-14T20:00:00',
    activities: [
      { id: 'a9', type: 'call', title: 'Outbound Call', description: 'Discussed 3-month installment plan', timestamp: '4 hrs ago', agent: 'Ahmed S' },
      { id: 'a10', type: 'ptp', title: 'PTP Created', description: 'First installment $ 2,600', timestamp: '4 hrs ago' },
    ],
    notes: [],
    ptps: [
      { id: 'p2', amount: 2600, date: '2025-11-25', status: 'Pending', createdAt: '2025-11-14' }
    ],
    disputes: [],
    payments: []
  },
];
