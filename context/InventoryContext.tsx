
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { MOCK_INVENTORY, MOCK_EGG_LOGS, MOCK_SALES, MOCK_TRANSACTIONS, MOCK_TASKS, MOCK_FLOCKS, MOCK_HEALTH_RECORDS } from '../constants';
import { InventoryItem, FeedConsumption, EggCollectionLog, SaleRecord, FinancialTransaction, Task, Flock, HealthRecord } from '../types';
import { useNotification } from './NotificationContext';

interface InventoryContextType {
  items: InventoryItem[];
  consumptionRecords: FeedConsumption[];
  eggLogs: EggCollectionLog[];
  salesRecords: SaleRecord[];
  transactions: FinancialTransaction[];
  tasks: Task[];
  flocks: Flock[];
  healthRecords: HealthRecord[];
  
  addItem: (item: InventoryItem) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (id: string, amount: number) => void; 
  logConsumption: (record: FeedConsumption) => void;
  logEggCollection: (log: EggCollectionLog) => void;
  addSale: (sale: SaleRecord) => void;
  updateSaleStatus: (id: string, status: 'PAID' | 'PENDING' | 'CANCELLED') => void;
  addTransaction: (transaction: FinancialTransaction) => void;
  deleteTransaction: (id: string) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  // Flock & Health
  addFlock: (flock: Flock) => void;
  updateFlock: (id: string, updates: Partial<Flock>) => void;
  deleteFlock: (id: string) => void;
  addHealthRecord: (record: HealthRecord) => void;
  updateHealthRecord: (id: string, updates: Partial<HealthRecord>) => void;
  deleteHealthRecord: (id: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { addNotification } = useNotification();
  
  const [items, setItems] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [consumptionRecords, setConsumptionRecords] = useState<FeedConsumption[]>([
    { id: 'C1', flockId: 'F001', feedItemId: 'I001', quantity: 450, date: '2024-05-14', cost: 292.50 },
    { id: 'C2', flockId: 'F003', feedItemId: 'I001', quantity: 210, date: '2024-05-14', cost: 136.50 },
  ]);
  const [eggLogs, setEggLogs] = useState<EggCollectionLog[]>(MOCK_EGG_LOGS);
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>(MOCK_SALES);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(MOCK_TRANSACTIONS);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [flocks, setFlocks] = useState<Flock[]>(MOCK_FLOCKS);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>(MOCK_HEALTH_RECORDS);

  // Check for Overdue Tasks on Mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const overdueTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.due < today);
    
    if (overdueTasks.length > 0) {
      addNotification(
        'WARNING', 
        'Overdue Tasks Detected', 
        `You have ${overdueTasks.length} tasks pending attention. Please review the HR & Tasks module.`
      );
    }
  }, []); // Run once on application load

  const addItem = (item: InventoryItem) => {
    setItems(prev => [item, ...prev]);
  };

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const adjustStock = (id: string, amount: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + amount);
        
        // Critical Alert: Low Stock Trigger
        // Trigger only if consuming stock (amount < 0) AND dropping below threshold
        if (amount < 0 && newQuantity <= item.minThreshold && item.quantity > item.minThreshold) {
           addNotification(
             'WARNING', 
             'Low Stock Alert', 
             `${item.name} has dropped to ${newQuantity} ${item.unit}. Please restock immediately.`
           );
        }

        return { 
          ...item, 
          quantity: newQuantity,
          lastRestocked: amount > 0 ? new Date().toISOString().split('T')[0] : item.lastRestocked
        };
      }
      return item;
    }));
  };

  const logConsumption = (record: FeedConsumption) => {
    setConsumptionRecords(prev => [record, ...prev]);
  };

  const logEggCollection = (log: EggCollectionLog) => {
    setEggLogs(prev => [log, ...prev]);
  };

  const addSale = (sale: SaleRecord) => {
    setSalesRecords(prev => [sale, ...prev]);
    
    // Calculate Net Cash Flow
    const netReceivable = sale.totalAmount - (sale.withholdingAmount || 0);

    // Automatically log into Finance Module
    const transaction: FinancialTransaction = {
      id: `AUTO-T-${Date.now()}`,
      date: sale.date,
      description: `Sale - ${sale.customer} (${sale.item})`,
      amount: netReceivable, // Cash hitting the bank
      vatAmount: sale.vatAmount,
      withholdingAmount: sale.withholdingAmount,
      type: 'INCOME',
      category: 'SALES',
      referenceId: sale.id,
      status: sale.status === 'PAID' ? 'COMPLETED' : 'PENDING'
    };
    setTransactions(prev => [transaction, ...prev]);
  };

  const updateSaleStatus = (id: string, status: 'PAID' | 'PENDING' | 'CANCELLED') => {
    setSalesRecords(prev => prev.map(sale => sale.id === id ? { ...sale, status } : sale));
    // Also update linked transaction if exists
    setTransactions(prev => prev.map(t => {
      if (t.referenceId === id) {
        if (status === 'CANCELLED') return { ...t, status: 'CANCELLED' };
        if (status === 'PAID') return { ...t, status: 'COMPLETED' };
        if (status === 'PENDING') return { ...t, status: 'PENDING' };
      }
      return t;
    }));
  };

  const addTransaction = (transaction: FinancialTransaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const addTask = (task: Task) => {
    setTasks(prev => [task, ...prev]);
    addNotification('INFO', 'New Task Assigned', `Task "${task.title}" has been created.`);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // --- Flock & Health Methods ---
  const addFlock = (flock: Flock) => {
    setFlocks(prev => [flock, ...prev]);
  };

  const updateFlock = (id: string, updates: Partial<Flock>) => {
    setFlocks(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteFlock = (id: string) => {
    setFlocks(prev => prev.filter(f => f.id !== id));
  };

  const addHealthRecord = (record: HealthRecord) => {
    setHealthRecords(prev => [record, ...prev]);
    
    // Critical Alert: Disease Outbreak or High Mortality
    if (record.type === 'OUTBREAK') {
        const flock = flocks.find(f => f.id === record.flockId);
        const flockName = flock ? flock.name : 'Unknown Flock';
        addNotification(
            'ERROR', 
            'CRITICAL: Disease Outbreak Reported', 
            `Diagnosis: ${record.diagnosis} in ${flockName}. Initiate biosecurity protocols immediately.`
        );
    } else if (record.type === 'MORTALITY' && record.mortality >= 10) {
         const flock = flocks.find(f => f.id === record.flockId);
         const flockName = flock ? flock.name : 'Unknown Flock';
         addNotification(
            'ERROR', 
            'High Mortality Alert', 
            `${record.mortality} birds reported dead in ${flockName}. Investigation required.`
         );
    }
  };

  const updateHealthRecord = (id: string, updates: Partial<HealthRecord>) => {
    setHealthRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteHealthRecord = (id: string) => {
    setHealthRecords(prev => prev.filter(r => r.id !== id));
  };

  return (
    <InventoryContext.Provider value={{ 
      items, consumptionRecords, eggLogs, salesRecords, transactions, tasks, flocks, healthRecords,
      addItem, updateItem, deleteItem, adjustStock, 
      logConsumption, logEggCollection, addSale, updateSaleStatus,
      addTransaction, deleteTransaction,
      addTask, updateTask, deleteTask,
      addFlock, updateFlock, deleteFlock, addHealthRecord, updateHealthRecord, deleteHealthRecord
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
