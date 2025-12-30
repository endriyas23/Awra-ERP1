
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { InventoryItem, FeedConsumption, EggCollectionLog, SaleRecord, FinancialTransaction, Task, Flock, HealthRecord } from '../types';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

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
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => void;
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

const CACHE_KEY = 'awra_offline_data';

// Helper to recalculate age dynamically
const calculateFlockAge = (startDate: string, initialAge: number) => {
  const start = new Date(startDate);
  const now = new Date();
  // Reset hours to ensure clean day difference
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays) + (initialAge || 0);
};

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { addNotification } = useNotification();
  const { user } = useAuth();
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [consumptionRecords, setConsumptionRecords] = useState<FeedConsumption[]>([]);
  const [eggLogs, setEggLogs] = useState<EggCollectionLog[]>([]);
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);

  // Prevent duplicate notifications per session
  const notifiedTasksRef = useRef<Set<string>>(new Set());

  // Helper to save all current state to local storage
  const cacheData = (data: any) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache data locally', e);
    }
  };

  // Helper to load from cache
  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        
        // Recalculate flock ages on load
        const flocksWithAge = (data.flocks || []).map((f: Flock) => ({
            ...f,
            ageInDays: calculateFlockAge(f.startDate, f.initialAge)
        }));

        setFlocks(flocksWithAge);
        setItems(data.items || []);
        setHealthRecords(data.healthRecords || []);
        setTransactions(data.transactions || []);
        setSalesRecords(data.salesRecords || []);
        setConsumptionRecords(data.consumptionRecords || []);
        setEggLogs(data.eggLogs || []);
        setTasks(data.tasks || []);
        addNotification('INFO', 'Offline Mode', 'Loaded data from local cache.');
      }
    } catch (e) {
      console.error('Failed to load cache', e);
    }
  };

  // --- Fetch Initial Data from Supabase ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: flocksData, error: err1 },
          { data: inventoryData, error: err2 },
          { data: healthData, error: err3 },
          { data: transData, error: err4 },
          { data: salesData, error: err5 },
          { data: consData, error: err6 },
          { data: eggData, error: err7 },
          { data: taskData, error: err8 }
        ] = await Promise.all([
          supabase.from('flocks').select('*'),
          supabase.from('inventory_items').select('*'),
          supabase.from('health_records').select('*'),
          supabase.from('transactions').select('*'),
          supabase.from('sales').select('*'),
          supabase.from('consumption_logs').select('*'),
          supabase.from('egg_logs').select('*'),
          supabase.from('tasks').select('*')
        ]);

        if (err1 || err2 || err3 || err4 || err5 || err6 || err7 || err8) throw new Error("Fetch failed");

        // Update State
        if (flocksData) {
            // Ensure age is accurate based on today's date
            const flocksWithAge = flocksData.map(f => ({
                ...f,
                ageInDays: calculateFlockAge(f.startDate, f.initialAge)
            }));
            setFlocks(flocksWithAge);
        }
        if (inventoryData) setItems(inventoryData);
        if (healthData) setHealthRecords(healthData);
        if (transData) setTransactions(transData);
        if (salesData) setSalesRecords(salesData);
        if (consData) setConsumptionRecords(consData);
        if (eggData) setEggLogs(eggData);
        if (taskData) setTasks(taskData);

        // Cache successful fetch
        cacheData({
          flocks: flocksData, // Note: We cache the raw data mostly, but calculate on read
          items: inventoryData,
          healthRecords: healthData,
          transactions: transData,
          salesRecords: salesData,
          consumptionRecords: consData,
          eggLogs: eggData,
          tasks: taskData
        });

      } catch (error) {
        console.error('Network error or fetch failure, loading cache...', error);
        loadFromCache();
      }
    };

    fetchData();
  }, []);

  // Update Cache on State Changes (Debounced ideally, but direct for simplicity here)
  useEffect(() => {
    const timer = setTimeout(() => {
        cacheData({
            items, consumptionRecords, eggLogs, salesRecords, transactions, tasks, flocks, healthRecords
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [items, consumptionRecords, eggLogs, salesRecords, transactions, tasks, flocks, healthRecords]);


  // Check for Task Reminders (Due Dates)
  useEffect(() => {
    if (!user || tasks.length === 0) return;

    // Read settings
    const savedSettings = localStorage.getItem('awra_settings');
    const settings = savedSettings ? JSON.parse(savedSettings) : { notifications: { taskReminders: true } };

    if (!settings.notifications?.taskReminders) return;

    const today = new Date().toISOString().split('T')[0];
    const currentUserFullName = user.user_metadata?.full_name || '';

    tasks.forEach(t => {
      // Skip completed tasks
      if (t.status === 'COMPLETED') return;
      
      // Skip if already notified this session
      if (notifiedTasksRef.current.has(t.id)) return;

      // Check assignment (Simple string match)
      // If task is unassigned or assigned to someone else, check if generic "Farm Hand" logic applies or strict matching
      // Here we assume strict matching to the user's name
      if (currentUserFullName && t.assignee !== currentUserFullName && t.assignee !== 'Unassigned') return;

      if (t.due < today) {
        addNotification('ERROR', 'Overdue Task', `Task "${t.title}" was due on ${t.due}.`);
        notifiedTasksRef.current.add(t.id);
      } else if (t.due === today) {
        addNotification('WARNING', 'Task Due Today', `Reminder: "${t.title}" is due today.`);
        notifiedTasksRef.current.add(t.id);
      }
    });
  }, [tasks, user, addNotification]); 

  // --- Helpers for Optimistic Update + Supabase Call ---

  const addItem = async (item: InventoryItem) => {
    setItems(prev => [item, ...prev]);
    await supabase.from('inventory_items').insert([item]);
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    if (updates.quantity !== undefined) {
      const currentItem = items.find(i => i.id === id);
      if (currentItem) {
        const threshold = updates.minThreshold !== undefined ? updates.minThreshold : currentItem.minThreshold;
        if (updates.quantity <= threshold && currentItem.quantity > threshold) {
          addNotification('WARNING', 'Low Stock Alert', `${updates.name || currentItem.name} is low.`);
        }
      }
    }
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    await supabase.from('inventory_items').update(updates).eq('id', id);
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    await supabase.from('inventory_items').delete().eq('id', id);
  };

  const adjustStock = async (id: string, amount: number) => {
    const currentItem = items.find(i => i.id === id);
    if (!currentItem) return;

    const newQuantity = Math.max(0, currentItem.quantity + amount);
    const newLastRestocked = amount > 0 ? new Date().toISOString().split('T')[0] : currentItem.lastRestocked;

    if (amount < 0 && newQuantity <= currentItem.minThreshold && currentItem.quantity > currentItem.minThreshold) {
       addNotification('WARNING', 'Low Stock Alert', `${currentItem.name} has dropped below threshold.`);
    }

    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: newQuantity, lastRestocked: newLastRestocked };
      }
      return item;
    }));

    await supabase.from('inventory_items').update({ 
        quantity: newQuantity, 
        lastRestocked: newLastRestocked 
    }).eq('id', id);
  };

  const logConsumption = async (record: FeedConsumption) => {
    setConsumptionRecords(prev => [record, ...prev]);
    await supabase.from('consumption_logs').insert([record]);
  };

  const logEggCollection = async (log: EggCollectionLog) => {
    setEggLogs(prev => [log, ...prev]);
    await supabase.from('egg_logs').insert([log]);
  };

  const addSale = async (sale: SaleRecord) => {
    setSalesRecords(prev => [sale, ...prev]);
    const netReceivable = sale.totalAmount - (sale.withholdingAmount || 0);
    const transaction: FinancialTransaction = {
      id: `AUTO-T-${Date.now()}`,
      date: sale.date,
      description: `Sale - ${sale.customer} (${sale.item})`,
      amount: netReceivable, 
      vatAmount: sale.vatAmount,
      withholdingAmount: sale.withholdingAmount,
      type: 'INCOME',
      category: 'SALES',
      referenceId: sale.id,
      status: sale.status === 'PAID' ? 'COMPLETED' : 'PENDING'
    };
    setTransactions(prev => [transaction, ...prev]);
    await supabase.from('sales').insert([sale]);
    await supabase.from('transactions').insert([transaction]);
  };

  const updateSaleStatus = async (id: string, status: 'PAID' | 'PENDING' | 'CANCELLED') => {
    setSalesRecords(prev => prev.map(sale => sale.id === id ? { ...sale, status } : sale));
    setTransactions(prev => prev.map(t => {
      if (t.referenceId === id) {
        const newStatus = status === 'CANCELLED' ? 'CANCELLED' : status === 'PAID' ? 'COMPLETED' : 'PENDING';
        supabase.from('transactions').update({ status: newStatus }).eq('referenceId', id);
        return { ...t, status: newStatus };
      }
      return t;
    }));
    await supabase.from('sales').update({ status }).eq('id', id);
  };

  const addTransaction = async (transaction: FinancialTransaction) => {
    setTransactions(prev => [transaction, ...prev]);
    await supabase.from('transactions').insert([transaction]);
  };

  const updateTransaction = async (id: string, updates: Partial<FinancialTransaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    await supabase.from('transactions').update(updates).eq('id', id);
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await supabase.from('transactions').delete().eq('id', id);
  };

  const addTask = async (task: Task) => {
    setTasks(prev => [task, ...prev]);
    addNotification('INFO', 'New Task Assigned', `Task "${task.title}" has been created.`);
    await supabase.from('tasks').insert([task]);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    await supabase.from('tasks').update(updates).eq('id', id);
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  // --- Flock & Health Methods ---
  const addFlock = async (flock: Flock) => {
    // Ensure age is accurate on creation
    const flockWithAge = { 
        ...flock, 
        ageInDays: calculateFlockAge(flock.startDate, flock.initialAge) 
    };
    setFlocks(prev => [flockWithAge, ...prev]);
    await supabase.from('flocks').insert([flockWithAge]);
  };

  const updateFlock = async (id: string, updates: Partial<Flock>) => {
    setFlocks(prev => prev.map(f => {
        if (f.id === id) {
            const updatedFlock = { ...f, ...updates };
            // Recalculate age if start date or initial age changes
            if (updates.startDate || updates.initialAge !== undefined) {
                updatedFlock.ageInDays = calculateFlockAge(updatedFlock.startDate, updatedFlock.initialAge);
            }
            return updatedFlock;
        }
        return f;
    }));
    await supabase.from('flocks').update(updates).eq('id', id);
  };

  const deleteFlock = async (id: string) => {
    setFlocks(prev => prev.filter(f => f.id !== id));
    setHealthRecords(prev => prev.filter(r => r.flockId !== id));
    setConsumptionRecords(prev => prev.filter(r => r.flockId !== id));
    setEggLogs(prev => prev.filter(r => r.flockId !== id));

    try {
        await Promise.all([
            supabase.from('health_records').delete().eq('flockId', id),
            supabase.from('consumption_logs').delete().eq('flockId', id),
            supabase.from('egg_logs').delete().eq('flockId', id)
        ]);
        await supabase.from('flocks').delete().eq('id', id);
        addNotification('SUCCESS', 'Flock Deleted', 'Flock and related records removed.');
    } catch (error) {
        console.error('Error deleting flock data:', error);
        addNotification('ERROR', 'Delete Failed', 'Could not fully remove flock data.');
    }
  };

  const addHealthRecord = async (record: HealthRecord) => {
    setHealthRecords(prev => [record, ...prev]);
    if (record.type === 'OUTBREAK') {
        addNotification('ERROR', 'CRITICAL: Disease Outbreak', `Diagnosis: ${record.diagnosis}.`);
    }
    await supabase.from('health_records').insert([record]);
  };

  const updateHealthRecord = async (id: string, updates: Partial<HealthRecord>) => {
    setHealthRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    await supabase.from('health_records').update(updates).eq('id', id);
  };

  const deleteHealthRecord = async (id: string) => {
    setHealthRecords(prev => prev.filter(r => r.id !== id));
    await supabase.from('health_records').delete().eq('id', id);
  };

  return (
    <InventoryContext.Provider value={{ 
      items, consumptionRecords, eggLogs, salesRecords, transactions, tasks, flocks, healthRecords,
      addItem, updateItem, deleteItem, adjustStock, 
      logConsumption, logEggCollection, addSale, updateSaleStatus,
      addTransaction, updateTransaction, deleteTransaction,
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
