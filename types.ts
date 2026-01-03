
export interface Task {
  id: string;
  title: string;
  assignee: string; // Employee ID or Name
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  due: string;
  flockId?: string;
  department?: Department;
}

export interface FarmEvent {
  id: string;
  title: string;
  date: string;
  type: 'GENERAL' | 'MEETING' | 'MAINTENANCE';
  location?: string;
  description?: string;
  recurrence: 'NONE' | 'WEEKLY' | 'MONTHLY';
  attachments?: string[]; // Simulated file names
  time?: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  VETERINARIAN = 'VETERINARIAN',
  FARM_WORKER = 'FARM_WORKER',
  PENDING = 'PENDING'
}

export type FlockStatus = 'ACTIVE' | 'DEPLETED' | 'QUARANTINE';
export type FlockType = 'BROILER' | 'LAYER';

export interface Flock {
  id: string;
  name: string;
  breed: string;
  house: string;
  initialCount: number;
  currentCount: number;
  startDate: string;
  initialAge: number;
  ageInDays: number;
  status: FlockStatus;
  type: FlockType;
  sickCount?: number;
  costPerBird?: number;
  totalAcquisitionCost?: number;
  acquisitionVatRate?: number;
}

export type InventoryCategory = 'FEED' | 'MEDICINE' | 'EQUIPMENT' | 'BIRDS' | 'PRODUCE' | 'MEAT' | 'BYPRODUCT';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  minThreshold: number;
  pricePerUnit?: number;
  lastRestocked: string;
}

export interface FeedConsumption {
  id: string;
  flockId: string;
  feedItemId: string;
  quantity: number;
  date: string;
  cost: number;
}

export interface DailyLog {
  id: string;
  flockId: string;
  date: string;
  mortality: number;
  feedConsumed: number;
  waterConsumed: number;
  averageWeight?: number;
  notes?: string;
}

export interface EggCollectionItem {
  inventoryItemId: string;
  quantity: number;
}

export interface EggCollectionLog {
  id: string;
  date: string;
  flockId: string;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING';
  collectedItems: EggCollectionItem[];
  damagedCount: number;
  totalGoodEggs: number;
  recordedBy: string;
}

export type HealthRecordType = 'CHECKUP' | 'VACCINATION' | 'MEDICATION' | 'TREATMENT' | 'OUTBREAK' | 'MORTALITY' | 'RECOVERY' | 'ISOLATION' | 'DIAGNOSIS';

export interface HealthRecord {
  id: string;
  flockId: string;
  type: HealthRecordType;
  date: string;
  diagnosis: string;
  details?: string;
  medication?: string;
  mortality: number;
  status: 'COMPLETED' | 'PENDING' | 'SCHEDULED' | 'RESOLVED' | 'TREATED';
  veterinarian?: string;
  cost?: number;
  batchNumber?: string;
  nextScheduledDate?: string;
  symptoms?: string[];
}

export type CustomerType = 'INDIVIDUAL' | 'RETAILER' | 'WHOLESALER' | 'HOTEL';

export interface Customer {
  id: string;
  joinedDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'HOLD' | 'BLACKLISTED';
  name: string;
  type: CustomerType;
  contactPerson: string;
  phone: string;
  email?: string;
  taxId?: string;
  address?: string;
  creditLimit?: number;
}

export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'INVOICED' | 'PAID' | 'CANCELLED' | 'PENDING';

export interface SaleRecord {
  id: string;
  date: string;
  customerId?: string;
  customer: string;
  item: string;
  itemId?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  vatRate?: number;
  vatAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  totalAmount: number;
  status: SaleStatus;
  flockId?: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface FinancialTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  vatAmount?: number;
  withholdingAmount?: number;
  type: TransactionType;
  category: string;
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
  referenceId?: string;
}

export type NotificationType = 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
}

// --- HR & Payroll Extensions ---

export type Department = 'FARM_OPS' | 'HATCHERY' | 'FEED_MILL' | 'PROCESSING' | 'ADMIN' | 'VETERINARY';
export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'DAILY_LABOR';
export type EmployeeStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
export type SalaryStructure = 'MONTHLY' | 'DAILY' | 'TASK_BASED';

export interface Employee {
  id: string; // Auto-generated ID
  // Personal Info
  fullName: string;
  nationalId: string;
  phone: string;
  address: string;
  emergencyContact: string;
  gender?: 'MALE' | 'FEMALE';
  dob?: string;
  photoUrl?: string;
  // Employment Details
  jobTitle: string;
  department: Department;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  hireDate: string;
  contractEnd?: string;
  probationEnd?: string;
  // Compensation
  salaryStructure: SalaryStructure;
  baseSalary: number; // Monthly or Daily Rate
  allowances: {
    housing: number;
    transport: number;
    risk: number;
    other: number;
  };
  deductions: {
    pension: number;
    tax: number;
    healthInsurance: number;
  };
}

export interface PayrollRun {
  id: string;
  period: string; // YYYY-MM
  dateProcessed: string;
  employeeId: string;
  employeeName: string;
  basePay: number;
  totalAllowances: number;
  totalDeductions: number;
  overtimeHours: number;
  overtimePay: number;
  netPay: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
}
