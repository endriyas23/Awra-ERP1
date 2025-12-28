
import React from 'react';
import { Flock, InventoryItem, UserRole, SaleRecord, HealthRecord, EggCollectionLog, FinancialTransaction, Task } from './types';

export const COLORS = {
  primary: '#0f766e',
  secondary: '#0d9488',
  danger: '#e11d48',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#10b981'
};

export const FEED_SCHEDULE_DATA = {
  LAYER: [
    { 
      phase: 'Starter Phase', 
      feedSearchTerm: 'Chick Starter', // Matches "Chick Starter Feed"
      rangeLabel: '1–28 Days',
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      subStages: [
        { min: 0, max: 7, rate: '10–12 g', label: '0–7 days' },
        { min: 8, max: 14, rate: '16–18 g', label: '8–14 days' },
        { min: 15, max: 21, rate: '24–26 g', label: '15–21 days' },
        { min: 22, max: 28, rate: '31–33 g', label: '22–28 days' }
      ]
    },
    { 
      phase: 'Rearing Phase', 
      feedSearchTerm: 'Rearing', // Matches "Rearing Feed"
      rangeLabel: '29–56 Days',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      subStages: [
        { min: 29, max: 35, rate: '36–38 g', label: '29–35 days' },
        { min: 36, max: 42, rate: '41–43 g', label: '36–42 days' },
        { min: 43, max: 49, rate: '45–47 g', label: '43–49 days' },
        { min: 50, max: 56, rate: '48–50 g', label: '50–56 days' }
      ]
    },
    { 
      phase: 'Pullet Phase', 
      feedSearchTerm: 'Pullet', // Matches "Pullet Grower Feed"
      rangeLabel: '9 Weeks – 5% Prod',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      subStages: [
        { min: 57, max: 70, rate: '52–55 g', label: '9–10 weeks' },
        { min: 71, max: 84, rate: '58–60 g', label: '11–12 weeks' },
        { min: 85, max: 98, rate: '62–65 g', label: '13–14 weeks' },
        { min: 99, max: 112, rate: '68–70 g', label: '15–16 weeks' },
        { min: 113, max: 126, rate: '72–75 g', label: '17–18 weeks' },
        { min: 127, max: 140, rate: '80–85 g', label: '19–20 weeks' }
      ]
    },
    { 
      phase: 'Layer Phase', 
      feedSearchTerm: 'Layer Phase 1', // Matches "Layer Phase 1 Feed"
      rangeLabel: 'Production (5%+)',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      subStages: [
        { min: 141, max: 210, rate: '105–115 g', label: '21–30 weeks (Peak)' },
        { min: 211, max: 350, rate: '115–120 g', label: '31–50 weeks' },
        { min: 351, max: 455, rate: '120–125 g', label: '51–65 weeks' },
        { min: 456, max: 9999, rate: '125–130 g', label: '66+ weeks' }
      ]
    }
  ],
  BROILER: [
    { 
      phase: 'Starter Phase', 
      feedSearchTerm: 'Starter Feed', // Matches "Starter Feed"
      rangeLabel: '1–10 Days', 
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      subStages: [
        { min: 0, max: 10, rate: '15–25 g', label: '1–10 days' }
      ]
    },
    { 
      phase: 'Grower Phase', 
      feedSearchTerm: 'Grower Feed', // Matches "Grower Feed"
      rangeLabel: '11–30 Days', 
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      subStages: [
        { min: 11, max: 30, rate: '60–90 g', label: '11–30 days' }
      ]
    },
    { 
      phase: 'Finisher Phase', 
      feedSearchTerm: 'Finisher Feed', // Matches "Finisher Feed"
      rangeLabel: '31–45 Days', 
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      subStages: [
        { min: 31, max: 100, rate: '110–150 g', label: '31–45 days' }
      ]
    }
  ]
};

export const MOCK_FLOCKS: Flock[] = [
  { id: 'F001', name: 'Batch-24A', breed: 'Cobb 500', house: 'House 01', initialCount: 5000, currentCount: 4850, sickCount: 0, startDate: '2024-04-10', initialAge: 0, ageInDays: 35, status: 'ACTIVE', type: 'BROILER' },
  { id: 'F002', name: 'Layer-G1', breed: 'Hy-Line Brown', house: 'House 04', initialCount: 2000, currentCount: 1980, sickCount: 2, startDate: '2023-11-15', initialAge: 120, ageInDays: 160, status: 'ACTIVE', type: 'LAYER' },
  { id: 'F003', name: 'Batch-24B', breed: 'Ross 308', house: 'House 02', initialCount: 3000, currentCount: 2990, sickCount: 0, startDate: '2024-05-01', initialAge: 0, ageInDays: 14, status: 'ACTIVE', type: 'BROILER' },
];

export const MOCK_HEALTH_RECORDS: HealthRecord[] = [
  { 
    id: 'H001', 
    flockId: 'F001', 
    type: 'DIAGNOSIS',
    date: '2024-05-10', 
    symptoms: ['Lethargy', 'Reduced feed intake'], 
    diagnosis: 'Heat Stress', 
    mortality: 2, 
    medication: 'Electrolytes', 
    status: 'RESOLVED', 
    veterinarian: 'Dr. Ama',
    cost: 50
  },
  { 
    id: 'H002', 
    flockId: 'F001', 
    type: 'CHECKUP',
    date: '2024-05-08', 
    diagnosis: 'Routine Weekly Inspection', 
    details: 'Ventilation checked. Litter condition dry. Birds active.',
    mortality: 0, 
    status: 'COMPLETED', 
    veterinarian: 'Dr. Ama',
    cost: 20
  },
  { 
    id: 'H003', 
    flockId: 'F002', 
    type: 'TREATMENT',
    date: '2024-05-12', 
    diagnosis: 'Calcium Deficiency Treatment', 
    details: 'Administered via water lines for 3 days.',
    symptoms: ['Soft shells'], 
    mortality: 1, 
    medication: 'Cal-Boost supplement', 
    status: 'TREATED', 
    veterinarian: 'Dr. Ama',
    cost: 80
  },
  { 
    id: 'H004', 
    flockId: 'F003', 
    type: 'VACCINATION',
    date: '2024-05-05', 
    diagnosis: 'Newcastle Disease + IB', 
    details: 'Spray vaccination method.',
    batchNumber: 'VAC-2024-X99',
    mortality: 0, 
    status: 'COMPLETED', 
    veterinarian: 'Dr. Ama',
    nextScheduledDate: '2024-05-25',
    cost: 120
  },
  { 
    id: 'H005', 
    flockId: 'F001', 
    type: 'MORTALITY',
    date: '2024-05-14', 
    diagnosis: 'Sudden Death Syndrome', 
    mortality: 5, 
    status: 'COMPLETED', 
    veterinarian: 'N/A' 
  },
  { 
    id: 'H006', 
    flockId: 'F002', 
    type: 'MEDICATION',
    date: '2024-05-01', 
    diagnosis: 'Deworming', 
    medication: 'Piperazine',
    cost: 150,
    mortality: 0, 
    status: 'COMPLETED', 
    veterinarian: 'Dr. Ama' 
  },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'I001', name: 'Starter Feed', category: 'FEED', quantity: 450, unit: 'bags', minThreshold: 100, lastRestocked: '2024-05-10', pricePerUnit: 32.50 },
  { id: 'I002', name: 'Grower Feed', category: 'FEED', quantity: 120, unit: 'bags', minThreshold: 150, lastRestocked: '2024-05-05', pricePerUnit: 30.00 },
  { id: 'I003', name: 'Finisher Feed', category: 'FEED', quantity: 80, unit: 'bags', minThreshold: 150, lastRestocked: '2024-05-05', pricePerUnit: 29.50 },
  { id: 'I009', name: 'Chick Starter Feed', category: 'FEED', quantity: 200, unit: 'bags', minThreshold: 50, lastRestocked: '2024-05-15', pricePerUnit: 34.00 },
  { id: 'I014', name: 'Rearing Feed', category: 'FEED', quantity: 150, unit: 'bags', minThreshold: 40, lastRestocked: '2024-05-18', pricePerUnit: 30.50 },
  { id: 'I010', name: 'Pullet Grower Feed', category: 'FEED', quantity: 180, unit: 'bags', minThreshold: 50, lastRestocked: '2024-05-14', pricePerUnit: 31.00 },
  { id: 'I004', name: 'Pre-Layer Feed', category: 'FEED', quantity: 200, unit: 'bags', minThreshold: 50, lastRestocked: '2024-05-01', pricePerUnit: 28.00 },
  { id: 'I005', name: 'Layer Phase 1 Feed', category: 'FEED', quantity: 350, unit: 'bags', minThreshold: 100, lastRestocked: '2024-05-12', pricePerUnit: 29.00 },
  { id: 'I006', name: 'Layer Phase 2 Feed', category: 'FEED', quantity: 50, unit: 'bags', minThreshold: 100, lastRestocked: '2024-04-25', pricePerUnit: 28.50 },
  { id: 'I007', name: 'Gumboro Vaccine', category: 'MEDICINE', quantity: 25, unit: 'vials', minThreshold: 10, lastRestocked: '2024-04-20', pricePerUnit: 15.00 },
  { id: 'I008', name: 'Nipple Drinkers', category: 'EQUIPMENT', quantity: 500, unit: 'units', minThreshold: 50, lastRestocked: '2024-01-15', pricePerUnit: 4.50 },
  // Produce (Eggs)
  { id: 'I011', name: 'Table Eggs (Large)', category: 'PRODUCE', quantity: 1200, unit: 'eggs', minThreshold: 500, lastRestocked: '2024-05-16', pricePerUnit: 0.25 },
  { id: 'I012', name: 'Table Eggs (Medium)', category: 'PRODUCE', quantity: 850, unit: 'eggs', minThreshold: 500, lastRestocked: '2024-05-16', pricePerUnit: 0.22 },
  { id: 'I013', name: 'Table Eggs (Small)', category: 'PRODUCE', quantity: 300, unit: 'eggs', minThreshold: 200, lastRestocked: '2024-05-16', pricePerUnit: 0.18 },
];

export const MOCK_SALES: SaleRecord[] = [
  { 
    id: 'S001', 
    customer: 'FreshMart Organics', 
    item: 'Table Eggs (Large)', 
    quantity: 200,
    unitPrice: 22.50, // per unit logic varies, simpler here
    subtotal: 4500,
    vatRate: 0,
    vatAmount: 0,
    withholdingRate: 0,
    withholdingAmount: 0,
    totalAmount: 4500, 
    date: '2024-05-14', 
    status: 'PAID',
    flockId: 'F002' // Linked to Layer-G1
  },
  { 
    id: 'S002', 
    customer: 'Hotel Regency', 
    item: 'Broiler (Live Weight)', 
    quantity: 1500, 
    unitPrice: 12.00,
    subtotal: 18000,
    vatRate: 0,
    vatAmount: 0,
    withholdingRate: 0,
    withholdingAmount: 0,
    totalAmount: 18000, 
    date: '2024-05-13', 
    status: 'PENDING',
    flockId: 'F001' // Linked to Batch-24A (Hypothetically partial sale)
  },
];

export const MOCK_EGG_LOGS: EggCollectionLog[] = [
  {
    id: 'EL001',
    date: '2024-05-16',
    flockId: 'F002',
    timeOfDay: 'MORNING',
    collectedItems: [
        { inventoryItemId: 'I011', quantity: 950 }, // Large
        { inventoryItemId: 'I012', quantity: 500 }  // Medium
    ],
    damagedCount: 15,
    totalGoodEggs: 1450,
    recordedBy: 'John Doe'
  },
  {
    id: 'EL002',
    date: '2024-05-16',
    flockId: 'F002',
    timeOfDay: 'AFTERNOON',
    collectedItems: [
        { inventoryItemId: 'I011', quantity: 300 },
        { inventoryItemId: 'I012', quantity: 150 }
    ],
    damagedCount: 5,
    totalGoodEggs: 450,
    recordedBy: 'John Doe'
  },
  {
    id: 'EL003',
    date: '2024-05-15',
    flockId: 'F002',
    timeOfDay: 'MORNING',
    collectedItems: [
        { inventoryItemId: 'I011', quantity: 920 },
        { inventoryItemId: 'I012', quantity: 510 }
    ],
    damagedCount: 20,
    totalGoodEggs: 1430,
    recordedBy: 'John Doe'
  },
];

export const MOCK_TRANSACTIONS: FinancialTransaction[] = [
  { id: 'T001', date: '2024-05-01', description: 'Monthly Electricity Bill', amount: 450.00, type: 'EXPENSE', category: 'UTILITIES', status: 'COMPLETED' },
  { id: 'T002', date: '2024-05-02', description: 'Veterinary Consultation - Dr. Ama', amount: 200.00, type: 'EXPENSE', category: 'LABOR', status: 'COMPLETED' },
  { id: 'T003', date: '2024-05-05', description: 'Bulk Feed Purchase (Starter)', amount: 12000.00, type: 'EXPENSE', category: 'FEED', status: 'COMPLETED' },
  { id: 'T004', date: '2024-05-13', description: 'Sale - Hotel Regency', amount: 18000.00, type: 'INCOME', category: 'SALES', referenceId: 'S002', status: 'PENDING' },
  { id: 'T005', date: '2024-05-14', description: 'Sale - FreshMart Organics', amount: 4500.00, type: 'INCOME', category: 'SALES', referenceId: 'S001', status: 'COMPLETED' },
  { id: 'T006', date: '2024-05-15', description: 'Farm Hand Wages (Weekly)', amount: 800.00, type: 'EXPENSE', category: 'LABOR', status: 'COMPLETED' },
  { id: 'T007', date: '2024-05-10', description: 'Water Pump Repair', amount: 150.00, type: 'EXPENSE', category: 'MAINTENANCE', status: 'COMPLETED' },
];

export const MOCK_TASKS: Task[] = [
  { id: 'T001', title: 'Repair Fence in Sector 4', assignee: 'Kwame Osei', priority: 'HIGH', status: 'PENDING', due: '2024-06-20' },
  { id: 'T002', title: 'Submit Monthly Health Report', assignee: 'Ama Mensah', priority: 'MEDIUM', status: 'IN_PROGRESS', due: '2024-06-25' },
  { id: 'T003', title: 'Clean Water Tanks', assignee: 'Yaw Asare', priority: 'LOW', status: 'COMPLETED', due: '2024-06-15' },
];

export const PERFORMANCE_DATA = [
  { date: 'Mon', mortalityRate: 0.2, fcr: 1.5, production: 92, weight: 1.2 },
  { date: 'Tue', mortalityRate: 0.1, fcr: 1.52, production: 91, weight: 1.25 },
  { date: 'Wed', mortalityRate: 0.5, fcr: 1.48, production: 94, weight: 1.31 },
  { date: 'Thu', mortalityRate: 0.2, fcr: 1.5, production: 93, weight: 1.38 },
  { date: 'Fri', mortalityRate: 0.3, fcr: 1.55, production: 90, weight: 1.45 },
  { date: 'Sat', mortalityRate: 0.1, fcr: 1.53, production: 92, weight: 1.52 },
  { date: 'Sun', mortalityRate: 0.1, fcr: 1.5, production: 95, weight: 1.6 },
];
