// Employee data for enterprise customers with subsidiaries

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  department: string;
  position: string;
  subsidiary: string;
  parentCompany: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'on-leave';
  serviceUsage?: {
    dataUsed: string;
    callMinutes: number;
    smsCount: number;
  };
  lastLogin?: string;
  accountValue?: number;
  manager?: string;
  location: string;
}

export const ENTERPRISE_EMPLOYEES: Employee[] = [
  // TechCorp International employees
  {
    id: "EMP001",
    name: "Alice Johnson",
    email: "alice.johnson@techcorp-intl.com",
    phone: "+1-555-1001",
    employeeId: "TC001",
    department: "Engineering",
    position: "Senior Software Engineer",
    subsidiary: "TechCorp Development",
    parentCompany: "TechCorp International",
    hireDate: "2021-03-15",
    status: "active",
    serviceUsage: {
      dataUsed: "45GB",
      callMinutes: 890,
      smsCount: 245
    },
    lastLogin: "2024-01-30",
    accountValue: 125,
    manager: "Robert Singh",
    location: "San Francisco, CA"
  },
  {
    id: "EMP002",
    name: "Robert Singh",
    email: "robert.singh@techcorp-intl.com",
    phone: "+1-555-1002",
    employeeId: "TC002",
    department: "Engineering",
    position: "Engineering Manager",
    subsidiary: "TechCorp Development",
    parentCompany: "TechCorp International",
    hireDate: "2019-06-10",
    status: "active",
    serviceUsage: {
      dataUsed: "68GB",
      callMinutes: 1250,
      smsCount: 180
    },
    lastLogin: "2024-01-30",
    accountValue: 185,
    manager: "Sarah Chen",
    location: "San Francisco, CA"
  },
  {
    id: "EMP003",
    name: "Sarah Chen",
    email: "sarah.chen@techcorp-intl.com",
    phone: "+1-555-1003",
    employeeId: "TC003",
    department: "Operations",
    position: "VP of Operations",
    subsidiary: "TechCorp Solutions",
    parentCompany: "TechCorp International",
    hireDate: "2018-01-20",
    status: "active",
    serviceUsage: {
      dataUsed: "52GB",
      callMinutes: 1580,
      smsCount: 95
    },
    lastLogin: "2024-01-29",
    accountValue: 220,
    manager: "Executive Team",
    location: "Austin, TX"
  },
  {
    id: "EMP004",
    name: "Michael Torres",
    email: "michael.torres@techcorp-intl.com",
    phone: "+1-555-1004",
    employeeId: "TC004",
    department: "Sales",
    position: "Account Executive",
    subsidiary: "TechCorp Solutions",
    parentCompany: "TechCorp International",
    hireDate: "2022-09-05",
    status: "active",
    serviceUsage: {
      dataUsed: "38GB",
      callMinutes: 2100,
      smsCount: 320
    },
    lastLogin: "2024-01-30",
    accountValue: 145,
    manager: "Jennifer Lee",
    location: "Austin, TX"
  },
  
  // GlobalTech Holdings employees
  {
    id: "EMP005",
    name: "Jennifer Lee",
    email: "jennifer.lee@globaltech.com",
    phone: "+1-555-2001",
    employeeId: "GT001",
    department: "Finance",
    position: "CFO",
    subsidiary: "GlobalTech Finance",
    parentCompany: "GlobalTech Holdings",
    hireDate: "2017-11-12",
    status: "active",
    serviceUsage: {
      dataUsed: "42GB",
      callMinutes: 1450,
      smsCount: 125
    },
    lastLogin: "2024-01-30",
    accountValue: 195,
    manager: "Executive Team",
    location: "New York, NY"
  },
  {
    id: "EMP006",
    name: "David Park",
    email: "david.park@globaltech.com",
    phone: "+1-555-2002",
    employeeId: "GT002",
    department: "IT",
    position: "IT Director",
    subsidiary: "GlobalTech Operations",
    parentCompany: "GlobalTech Holdings",
    hireDate: "2020-04-18",
    status: "active",
    serviceUsage: {
      dataUsed: "75GB",
      callMinutes: 950,
      smsCount: 85
    },
    lastLogin: "2024-01-30",
    accountValue: 165,
    manager: "Jennifer Lee",
    location: "New York, NY"
  },
  {
    id: "EMP007",
    name: "Lisa Wang",
    email: "lisa.wang@globaltech.com",
    phone: "+1-555-2003",
    employeeId: "GT003",
    department: "Marketing",
    position: "Marketing Specialist",
    subsidiary: "GlobalTech Marketing",
    parentCompany: "GlobalTech Holdings",
    hireDate: "2023-02-28",
    status: "active",
    serviceUsage: {
      dataUsed: "35GB",
      callMinutes: 680,
      smsCount: 290
    },
    lastLogin: "2024-01-29",
    accountValue: 115,
    manager: "David Park",
    location: "Los Angeles, CA"
  },
  {
    id: "EMP008",
    name: "Carlos Martinez",
    email: "carlos.martinez@globaltech.com",
    phone: "+1-555-2004",
    employeeId: "GT004",
    department: "Operations",
    position: "Operations Analyst",
    subsidiary: "GlobalTech Operations",
    parentCompany: "GlobalTech Holdings",
    hireDate: "2022-07-14",
    status: "on-leave",
    serviceUsage: {
      dataUsed: "28GB",
      callMinutes: 420,
      smsCount: 150
    },
    lastLogin: "2024-01-15",
    accountValue: 95,
    manager: "Lisa Wang",
    location: "Los Angeles, CA"
  },

  // MegaCorp Enterprises employees
  {
    id: "EMP009",
    name: "Amanda Foster",
    email: "amanda.foster@megacorp.com",
    phone: "+1-555-3001",
    employeeId: "MC001",
    department: "HR",
    position: "HR Director",
    subsidiary: "MegaCorp Services",
    parentCompany: "MegaCorp Enterprises",
    hireDate: "2019-08-22",
    status: "active",
    serviceUsage: {
      dataUsed: "41GB",
      callMinutes: 1120,
      smsCount: 205
    },
    lastLogin: "2024-01-30",
    accountValue: 155,
    manager: "Executive Team",
    location: "Chicago, IL"
  },
  {
    id: "EMP010",
    name: "James Wilson",
    email: "james.wilson@megacorp.com",
    phone: "+1-555-3002",
    employeeId: "MC002",
    department: "Engineering",
    position: "Principal Engineer",
    subsidiary: "MegaCorp Technology",
    parentCompany: "MegaCorp Enterprises",
    hireDate: "2020-01-10",
    status: "active",
    serviceUsage: {
      dataUsed: "82GB",
      callMinutes: 750,
      smsCount: 110
    },
    lastLogin: "2024-01-30",
    accountValue: 175,
    manager: "Amanda Foster",
    location: "Seattle, WA"
  },
  {
    id: "EMP011",
    name: "Emma Thompson",
    email: "emma.thompson@megacorp.com",
    phone: "+1-555-3003",
    employeeId: "MC003",
    department: "Finance",
    position: "Financial Analyst",
    subsidiary: "MegaCorp Finance",
    parentCompany: "MegaCorp Enterprises",
    hireDate: "2021-12-05",
    status: "active",
    serviceUsage: {
      dataUsed: "29GB",
      callMinutes: 650,
      smsCount: 175
    },
    lastLogin: "2024-01-29",
    accountValue: 125,
    manager: "James Wilson",
    location: "Chicago, IL"
  },
  {
    id: "EMP012",
    name: "Ryan Davis",
    email: "ryan.davis@megacorp.com",
    phone: "+1-555-3004",
    employeeId: "MC004",
    department: "Sales",
    position: "Sales Representative",
    subsidiary: "MegaCorp Services",
    parentCompany: "MegaCorp Enterprises",
    hireDate: "2023-05-18",
    status: "active",
    serviceUsage: {
      dataUsed: "44GB",
      callMinutes: 1890,
      smsCount: 380
    },
    lastLogin: "2024-01-30",
    accountValue: 135,
    manager: "Emma Thompson",
    location: "Denver, CO"
  },

  // InnovateX Corp employees
  {
    id: "EMP013",
    name: "Kevin Zhang",
    email: "kevin.zhang@innovatex.com",
    phone: "+1-555-4001",
    employeeId: "IX001",
    department: "Research",
    position: "Research Director",
    subsidiary: "InnovateX Labs",
    parentCompany: "InnovateX Corp",
    hireDate: "2018-09-30",
    status: "active",
    serviceUsage: {
      dataUsed: "65GB",
      callMinutes: 1320,
      smsCount: 95
    },
    lastLogin: "2024-01-30",
    accountValue: 190,
    manager: "Executive Team",
    location: "Boston, MA"
  },
  {
    id: "EMP014",
    name: "Sophie Miller",
    email: "sophie.miller@innovatex.com",
    phone: "+1-555-4002",
    employeeId: "IX002",
    department: "Product",
    position: "Product Manager",
    subsidiary: "InnovateX Products",
    parentCompany: "InnovateX Corp",
    hireDate: "2021-06-07",
    status: "active",
    serviceUsage: {
      dataUsed: "48GB",
      callMinutes: 920,
      smsCount: 210
    },
    lastLogin: "2024-01-29",
    accountValue: 145,
    manager: "Kevin Zhang",
    location: "Boston, MA"
  },
  {
    id: "EMP015",
    name: "Alex Rodriguez",
    email: "alex.rodriguez@innovatex.com",
    phone: "+1-555-4003",
    employeeId: "IX003",
    department: "Engineering",
    position: "DevOps Engineer",
    subsidiary: "InnovateX Labs",
    parentCompany: "InnovateX Corp",
    hireDate: "2022-11-20",
    status: "inactive",
    serviceUsage: {
      dataUsed: "22GB",
      callMinutes: 450,
      smsCount: 80
    },
    lastLogin: "2024-01-10",
    accountValue: 85,
    manager: "Sophie Miller",
    location: "Miami, FL"
  }
];