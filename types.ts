
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VETERINARIAN = 'VETERINARIAN',
  ACCOUNTANT = 'ACCOUNTANT',
  FARM_WORKER = 'FARM_WORKER',
  PENDING = 'PENDING'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export type NotificationType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
}

export interface Flock {
  id: string;
  name: string;
  breed: string;
  house: string;
  initialCount: number;
  currentCount: number;
  sickCount?: number; // Birds isolated/quarantined from main flock
  startDate: string;
  initialAge: number;
  ageInDays: number;
  status: 'ACTIVE' | 'DEPLETED' | 'QUARANTINE';
  type: 'BROILER' | 'LAYER';
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

export interface FeedConsumption {
  id: string;
  flockId: string;
  feedItemId: string;
  quantity: number;
  date: string;
  cost: number;
}

export interface FeedRation {
  id: string;
  name: string;
  targetAgeRange: [number, number];
  proteinPercentage: number;
  metabolizableEnergy: number; // kcal/kg
}

export type HealthRecordType = 
  | 'VACCINATION' 
  | 'MEDICATION' 
  | 'TREATMENT' 
  | 'CHECKUP' 
  | 'OUTBREAK' 
  | 'RECOVERY' 
  | 'MORTALITY'
  | 'DIAGNOSIS'
  | 'ISOLATION';

export interface HealthRecord {
  id: string;
  flockId: string;
  date: string;
  type: HealthRecordType;
  
  // Core Info
  diagnosis: string; // Used as Title/Name for non-diagnosis types too
  details?: string;
  
  // Specifics
  symptoms?: string[];
  mortality: number;
  medication?: string;
  batchNumber?: string; // For vaccines/meds
  cost?: number;
  
  // Status & People
  status: 'PENDING' | 'TREATED' | 'RESOLVED' | 'COMPLETED' | 'SCHEDULED';
  veterinarian: string;
  nextScheduledDate?: string; // For boosters or follow-up
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'FEED' | 'MEDICINE' | 'EQUIPMENT' | 'BIRDS' | 'PRODUCE';
  quantity: number;
  unit: string;
  minThreshold: number;
  lastRestocked: string;
  pricePerUnit?: number;
}

export interface SaleRecord {
  id: string;
  customer: string;
  item: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  withholdingRate: number;
  withholdingAmount: number;
  totalAmount: number; // Invoice Total (Subtotal + VAT)
  date: string;
  status: 'PAID' | 'PENDING' | 'CANCELLED';
  flockId?: string; // Optional link to source flock
}

export interface PerformanceMetric {
  date: string;
  mortalityRate: number;
  fcr: number;
  eggProduction?: number;
  weightGain?: number;
}

export interface EggCollectionLog {
  id: string;
  date: string;
  flockId: string;
  timeOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING';
  collectedItems: {
    inventoryItemId: string; // e.g. "Table Eggs Large" ID
    quantity: number;
    trays?: number; // Helper for UI
  }[];
  damagedCount: number;
  totalGoodEggs: number;
  recordedBy: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface FinancialTransaction {
  id: string;
  date: string;
  description: string;
  amount: number; // Net Cash Flow amount
  vatAmount?: number;
  withholdingAmount?: number;
  type: TransactionType;
  category: 'SALES' | 'FEED' | 'MEDICINE' | 'LABOR' | 'MAINTENANCE' | 'UTILITIES' | 'LIVESTOCK' | 'OTHER';
  referenceId?: string; // Link to SaleID or InventoryID
  status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  due: string;
  flockId?: string;
}
