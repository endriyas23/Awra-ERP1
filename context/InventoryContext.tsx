
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { InventoryItem, FeedConsumption, EggCollectionLog, SaleRecord, FinancialTransaction, Task, Flock, HealthRecord, DailyLog, Customer, SaleStatus, FarmEvent, Employee, PayrollRun } from '../types';
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
  dailyLogs: DailyLog[];
  customers: Customer[];
  customEvents: FarmEvent[];
  employees: Employee[];
  payrollRuns: PayrollRun[];
  
  addItem: (item: InventoryItem) => void;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  adjustStock: (id: string, amount: number) => Promise<void>; 
  logConsumption: (record: FeedConsumption) => void;
  updateConsumption: (id: string, updates: Partial<FeedConsumption>) => void;
  deleteConsumption: (id: string) => void;
  
  logEggCollection: (log: EggCollectionLog) => void;
  updateEggLog: (id: string, updates: Partial<EggCollectionLog>) => void;
  deleteEggLog: (id: string) => void;

  addSale: (sale: SaleRecord) => void;
  updateSale: (id: string, updates: Partial<SaleRecord>) => void;
  deleteSale: (id: string) => void;
  updateSaleStatus: (id: string, status: SaleStatus) => void;
  
  addTransaction: (transaction: FinancialTransaction) => void;
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => void;
  deleteTransaction: (id: string) => void;
  
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  addFlock: (flock: Flock) => void;
  updateFlock: (id: string, updates: Partial<Flock>) => void;
  deleteFlock: (id: string) => void;
  addHealthRecord: (record: HealthRecord) => void;
  updateHealthRecord: (id: string, updates: Partial<HealthRecord>) => void;
  deleteHealthRecord: (id: string) => void;

  addDailyLog: (log: DailyLog) => void;
  updateDailyLog: (id: string, updates: Partial<DailyLog>) => void;
  deleteDailyLog: (id: string) => void;

  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  addCustomEvent: (event: FarmEvent) => void;
  deleteCustomEvent: (id: string) => void;

  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  
  addPayrollRun: (run: PayrollRun) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const CACHE_KEY = 'awra_offline_data';

const calculateFlockAge = (startDate: string, initialAge: number) => {
  const start = new Date(startDate);
  const now = new Date();
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
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customEvents, setCustomEvents] = useState<FarmEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);

  const cacheData = (data: any) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache data locally', e);
    }
  };

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
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
        setDailyLogs(data.dailyLogs || []);
        setCustomers(data.customers || []);
        setCustomEvents(data.customEvents || []);
        setEmployees(data.employees || []);
        setPayrollRuns(data.payrollRuns || []);
      }
    } catch (e) {
      console.error('Failed to load cache', e);
    }
  };

  // --- Task Reminder Logic ---
  useEffect(() => {
    const checkTaskReminders = () => {
      try {
        const settingsStr = localStorage.getItem('awra_settings');
        if (!settingsStr) return;
        
        const settings = JSON.parse(settingsStr);
        // Check if reminders are enabled in settings
        if (!settings.notifications?.taskReminders) return;

        const reminderDays = settings.notifications.reminderDaysBefore ?? 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Avoid duplicate alerts per session
        const notifiedKey = 'awra_notified_tasks';
        const notifiedTasks = JSON.parse(sessionStorage.getItem(notifiedKey) || '[]');
        let newNotified = [...notifiedTasks];
        let hasNew = false;

        tasks.forEach(task => {
          if (task.status === 'COMPLETED' || newNotified.includes(task.id)) return;

          const dueDate = new Date(task.due);
          dueDate.setHours(0, 0, 0, 0);
          
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Trigger if due date is today or within the next N days
          // Also trigger for Overdue items (negative diffDays) that haven't been notified this session
          if (diffDays <= reminderDays) {
             let message = '';
             let type: 'WARNING' | 'ERROR' = 'WARNING';

             if (diffDays < 0) {
                 message = `Task OVERDUE: "${task.title}" was due on ${task.due}.`;
                 type = 'ERROR';
             } else if (diffDays === 0) {
                 message = `Task Due Today: "${task.title}"`;
             } else {
                 message = `Upcoming Task: "${task.title}" is due in ${diffDays} day(s).`;
             }
             
             addNotification(type, 'Task Reminder', message);
             newNotified.push(task.id);
             hasNew = true;
          }
        });

        if (hasNew) {
          sessionStorage.setItem(notifiedKey, JSON.stringify(newNotified));
        }
      } catch (e) {
        console.warn("Error checking task reminders", e);
      }
    };

    // Run check on mount and when tasks change, with a slight delay to ensure settings/data are ready
    const timer = setTimeout(checkTaskReminders, 2500);
    return () => clearTimeout(timer);
  }, [tasks, addNotification]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const safeFetch = async (promise: Promise<any>) => {
            try {
                return await promise;
            } catch (err) {
                return { data: null, error: err };
            }
        };

        const results = await Promise.all([
          safeFetch(supabase.from('flocks').select('*')),
          safeFetch(supabase.from('inventory_items').select('*')),
          safeFetch(supabase.from('health_records').select('*')),
          safeFetch(supabase.from('transactions').select('*')),
          safeFetch(supabase.from('sales').select('*')),
          safeFetch(supabase.from('consumption_logs').select('*')),
          safeFetch(supabase.from('egg_logs').select('*')),
          safeFetch(supabase.from('tasks').select('*')),
          safeFetch(supabase.from('daily_logs').select('*')),
          safeFetch(supabase.from('customers').select('*')),
          safeFetch(supabase.from('custom_events').select('*'))
        ]);

        const [
          { data: flocksData },
          { data: inventoryData },
          { data: healthData },
          { data: transData },
          { data: salesData },
          { data: consData },
          { data: eggData },
          { data: taskData },
          { data: dailyLogData },
          { data: customerData },
          { data: customEventData }
        ] = results;

        if (flocksData) {
            const flocksWithAge = flocksData.map((f: any) => ({
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
        if (dailyLogData) setDailyLogs(dailyLogData);
        if (customerData) setCustomers(customerData);
        if (customEventData) setCustomEvents(customEventData);

        // Load local-only HR data from cache for this update as we aren't migrating backend schema live
        loadFromCache();

      } catch (error) {
        loadFromCache();
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        cacheData({
            items, consumptionRecords, eggLogs, salesRecords, transactions, tasks, flocks, healthRecords, dailyLogs, customers, customEvents, employees, payrollRuns
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [items, consumptionRecords, eggLogs, salesRecords, transactions, tasks, flocks, healthRecords, dailyLogs, customers, customEvents, employees, payrollRuns]);

  // Helper to suppress unhandled rejections during offline mode
  const safeSupabaseCall = async (call: Promise<any>) => {
      try {
          await call;
      } catch (e) {
          console.warn('Supabase sync failed (offline?):', e);
      }
  };

  const addItem = async (item: InventoryItem) => {
    setItems(prev => [item, ...prev]);
    safeSupabaseCall(supabase.from('inventory_items').insert([item]));
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    safeSupabaseCall(supabase.from('inventory_items').update(updates).eq('id', id));
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    safeSupabaseCall(supabase.from('inventory_items').delete().eq('id', id));
  };

  const adjustStock = async (id: string, amount: number) => {
    const currentItem = items.find(i => i.id === id);
    if (!currentItem) return;
    const newQuantity = Math.max(0, currentItem.quantity + amount);
    const newLastRestocked = amount > 0 ? new Date().toISOString().split('T')[0] : currentItem.lastRestocked;
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQuantity, lastRestocked: newLastRestocked } : item));
    safeSupabaseCall(supabase.from('inventory_items').update({ quantity: newQuantity, lastRestocked: newLastRestocked }).eq('id', id));
  };

  const logConsumption = async (record: FeedConsumption) => {
    setConsumptionRecords(prev => [record, ...prev]);
    safeSupabaseCall(supabase.from('consumption_logs').insert([record]));
  };

  const updateConsumption = async (id: string, updates: Partial<FeedConsumption>) => {
    setConsumptionRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    safeSupabaseCall(supabase.from('consumption_logs').update(updates).eq('id', id));
  };

  const deleteConsumption = async (id: string) => {
    setConsumptionRecords(prev => prev.filter(r => r.id !== id));
    safeSupabaseCall(supabase.from('consumption_logs').delete().eq('id', id));
  };

  const logEggCollection = async (log: EggCollectionLog) => {
    setEggLogs(prev => [log, ...prev]);
    safeSupabaseCall(supabase.from('egg_logs').insert([log]));
  };

  const updateEggLog = async (id: string, updates: Partial<EggCollectionLog>) => {
    setEggLogs(prev => prev.map(log => log.id === id ? { ...log, ...updates } : log));
    safeSupabaseCall(supabase.from('egg_logs').update(updates).eq('id', id));
  };

  const deleteEggLog = async (id: string) => {
    setEggLogs(prev => prev.filter(log => log.id !== id));
    safeSupabaseCall(supabase.from('egg_logs').delete().eq('id', id));
  };

  const addSale = async (sale: SaleRecord) => {
    setSalesRecords(prev => [sale, ...prev]);
    if (sale.status === 'PAID' || sale.status === 'INVOICED') {
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
      safeSupabaseCall(supabase.from('transactions').insert([transaction]));
    }
    safeSupabaseCall(supabase.from('sales').insert([sale]));
  };

  const updateSale = async (id: string, updates: Partial<SaleRecord>) => {
    setSalesRecords(prev => prev.map(sale => sale.id === id ? { ...sale, ...updates } : sale));
    safeSupabaseCall(supabase.from('sales').update(updates).eq('id', id));
  };

  const deleteSale = async (id: string) => {
    setSalesRecords(prev => prev.filter(sale => sale.id !== id));
    safeSupabaseCall(supabase.from('sales').delete().eq('id', id));
  };

  const updateSaleStatus = async (id: string, status: SaleStatus) => {
    setSalesRecords(prev => prev.map(sale => sale.id === id ? { ...sale, status } : sale));
    safeSupabaseCall(supabase.from('sales').update({ status }).eq('id', id));
  };

  const addTransaction = async (transaction: FinancialTransaction) => {
    setTransactions(prev => [transaction, ...prev]);
    safeSupabaseCall(supabase.from('transactions').insert([transaction]));
  };

  const updateTransaction = async (id: string, updates: Partial<FinancialTransaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    safeSupabaseCall(supabase.from('transactions').update(updates).eq('id', id));
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    safeSupabaseCall(supabase.from('transactions').delete().eq('id', id));
  };

  const addTask = async (task: Task) => {
    setTasks(prev => [task, ...prev]);
    safeSupabaseCall(supabase.from('tasks').insert([task]));
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    safeSupabaseCall(supabase.from('tasks').update(updates).eq('id', id));
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    safeSupabaseCall(supabase.from('tasks').delete().eq('id', id));
  };

  const addFlock = async (flock: Flock) => {
    const flockWithAge = { ...flock, ageInDays: calculateFlockAge(flock.startDate, flock.initialAge) };
    setFlocks(prev => [flockWithAge, ...prev]);
    safeSupabaseCall(supabase.from('flocks').insert([flockWithAge]));
  };

  const updateFlock = async (id: string, updates: Partial<Flock>) => {
    setFlocks(prev => prev.map(f => {
        if (f.id === id) {
            const updatedFlock = { ...f, ...updates };
            if (updates.startDate || updates.initialAge !== undefined) {
                updatedFlock.ageInDays = calculateFlockAge(updatedFlock.startDate, updatedFlock.initialAge);
            }
            return updatedFlock;
        }
        return f;
    }));
    safeSupabaseCall(supabase.from('flocks').update(updates).eq('id', id));
  };

  const deleteFlock = async (id: string) => {
    setFlocks(prev => prev.filter(f => f.id !== id));
    safeSupabaseCall(supabase.from('flocks').delete().eq('id', id));
  };

  const addHealthRecord = async (record: HealthRecord) => {
    setHealthRecords(prev => [record, ...prev]);
    safeSupabaseCall(supabase.from('health_records').insert([record]));
  };

  const updateHealthRecord = async (id: string, updates: Partial<HealthRecord>) => {
    setHealthRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    safeSupabaseCall(supabase.from('health_records').update(updates).eq('id', id));
  };

  const deleteHealthRecord = async (id: string) => {
    setHealthRecords(prev => prev.filter(r => r.id !== id));
    safeSupabaseCall(supabase.from('health_records').delete().eq('id', id));
  };

  const addDailyLog = async (log: DailyLog) => {
    setDailyLogs(prev => [log, ...prev]);
    safeSupabaseCall(supabase.from('daily_logs').insert([log]));
  };

  const updateDailyLog = async (id: string, updates: Partial<DailyLog>) => {
    setDailyLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    safeSupabaseCall(supabase.from('daily_logs').update(updates).eq('id', id));
  };

  const deleteDailyLog = async (id: string) => {
    setDailyLogs(prev => prev.filter(l => l.id !== id));
    safeSupabaseCall(supabase.from('daily_logs').delete().eq('id', id));
  };

  const addCustomer = async (customer: Customer) => {
    setCustomers(prev => [customer, ...prev]);
    safeSupabaseCall(supabase.from('customers').insert([customer]));
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    safeSupabaseCall(supabase.from('customers').update(updates).eq('id', id));
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    safeSupabaseCall(supabase.from('customers').delete().eq('id', id));
  };

  const addCustomEvent = async (event: FarmEvent) => {
    setCustomEvents(prev => [event, ...prev]);
    safeSupabaseCall(supabase.from('custom_events').insert([event]));
  };

  const deleteCustomEvent = async (id: string) => {
    setCustomEvents(prev => prev.filter(e => e.id !== id));
    safeSupabaseCall(supabase.from('custom_events').delete().eq('id', id));
  };

  const addEmployee = (employee: Employee) => {
    setEmployees(prev => [...prev, employee]);
    // Simulate backend sync for offline demo or expand Supabase later
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const addPayrollRun = (run: PayrollRun) => {
    setPayrollRuns(prev => [...prev, run]);
  };

  return (
    <InventoryContext.Provider value={{ 
      items, consumptionRecords, eggLogs, salesRecords, transactions, tasks, flocks, healthRecords, dailyLogs, customers, customEvents, employees, payrollRuns,
      addItem, updateItem, deleteItem, adjustStock, 
      logConsumption, updateConsumption, deleteConsumption, 
      logEggCollection, updateEggLog, deleteEggLog,
      addSale, updateSale, deleteSale, updateSaleStatus,
      addTransaction, updateTransaction, deleteTransaction,
      addTask, updateTask, deleteTask,
      addFlock, updateFlock, deleteFlock, addHealthRecord, updateHealthRecord, deleteHealthRecord,
      addDailyLog, updateDailyLog, deleteDailyLog,
      addCustomer, updateCustomer, deleteCustomer,
      addCustomEvent, deleteCustomEvent,
      addEmployee, updateEmployee, deleteEmployee, addPayrollRun
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
