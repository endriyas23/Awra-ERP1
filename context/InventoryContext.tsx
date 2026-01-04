
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

// --- Mappers for Snake_Case (DB) <-> CamelCase (App) ---

const mapEmployeeFromDB = (db: any): Employee => ({
  id: db.id,
  fullName: db.full_name,
  nationalId: db.national_id,
  phone: db.phone,
  address: db.address,
  emergencyContact: db.emergency_contact,
  gender: db.gender,
  dob: db.dob,
  photoUrl: db.photo_url,
  jobTitle: db.job_title,
  department: db.department,
  employmentType: db.employment_type,
  status: db.status,
  hireDate: db.hire_date,
  contractEnd: db.contract_end_date,
  probationEnd: db.probation_end_date,
  salaryStructure: db.salary_structure,
  baseSalary: Number(db.base_salary),
  allowances: db.allowances || { housing: 0, transport: 0, risk: 0, other: 0 },
  deductions: db.deductions || { pension: 0, tax: 0, healthInsurance: 0 }
});

const mapEmployeeToDB = (emp: Partial<Employee>) => {
  const dbObj: any = {};
  if (emp.id !== undefined) dbObj.id = emp.id;
  if (emp.fullName !== undefined) dbObj.full_name = emp.fullName;
  if (emp.nationalId !== undefined) dbObj.national_id = emp.nationalId;
  if (emp.phone !== undefined) dbObj.phone = emp.phone;
  if (emp.address !== undefined) dbObj.address = emp.address;
  if (emp.emergencyContact !== undefined) dbObj.emergency_contact = emp.emergencyContact;
  if (emp.gender !== undefined) dbObj.gender = emp.gender;
  
  // Date Fields: Send NULL if empty string to avoid invalid input syntax for date types
  if (emp.dob !== undefined) dbObj.dob = emp.dob === '' ? null : emp.dob;
  
  if (emp.photoUrl !== undefined) dbObj.photo_url = emp.photoUrl;
  if (emp.jobTitle !== undefined) dbObj.job_title = emp.jobTitle;
  if (emp.department !== undefined) dbObj.department = emp.department;
  if (emp.employmentType !== undefined) dbObj.employment_type = emp.employmentType;
  if (emp.status !== undefined) dbObj.status = emp.status;
  
  if (emp.hireDate !== undefined) dbObj.hire_date = emp.hireDate === '' ? null : emp.hireDate;
  if (emp.contractEnd !== undefined) dbObj.contract_end_date = emp.contractEnd === '' ? null : emp.contractEnd;
  if (emp.probationEnd !== undefined) dbObj.probation_end_date = emp.probationEnd === '' ? null : emp.probationEnd;
  
  if (emp.salaryStructure !== undefined) dbObj.salary_structure = emp.salaryStructure;
  if (emp.baseSalary !== undefined) dbObj.base_salary = emp.baseSalary;
  if (emp.allowances !== undefined) dbObj.allowances = emp.allowances;
  if (emp.deductions !== undefined) dbObj.deductions = emp.deductions;
  return dbObj;
};

const mapPayrollFromDB = (db: any): PayrollRun => ({
  id: db.id,
  period: db.period,
  dateProcessed: db.date_processed,
  employeeId: db.employee_id,
  employeeName: db.employees ? (Array.isArray(db.employees) ? db.employees[0]?.full_name : db.employees.full_name) : 'Unknown',
  basePay: Number(db.base_pay),
  totalAllowances: Number(db.total_allowances),
  totalDeductions: Number(db.total_deductions),
  overtimeHours: Number(db.overtime_hours),
  overtimePay: Number(db.overtime_pay),
  netPay: Number(db.net_pay),
  status: db.status
});

const mapPayrollToDB = (run: PayrollRun) => ({
  id: run.id,
  period: run.period,
  date_processed: run.dateProcessed,
  employee_id: run.employeeId,
  base_pay: run.basePay,
  total_allowances: run.totalAllowances,
  total_deductions: run.totalDeductions,
  overtime_hours: run.overtimeHours,
  overtime_pay: run.overtimePay,
  net_pay: run.netPay,
  status: run.status
});


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
        if (!settings.notifications?.taskReminders) return;

        const reminderDays = settings.notifications.reminderDaysBefore ?? 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
          safeFetch(supabase.from('custom_events').select('*')),
          safeFetch(supabase.from('employees').select('*')), 
          safeFetch(supabase.from('payroll_records').select('*, employees(full_name)')),
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
          { data: customEventData },
          { data: empData, error: empError },
          { data: payrollData, error: payrollError }
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
        
        // HR Data Mapping
        if (empData) setEmployees(empData.map(mapEmployeeFromDB));
        if (empError) console.warn("Supabase: Error fetching employees:", empError.message);

        if (payrollData) setPayrollRuns(payrollData.map(mapPayrollFromDB));
        if (payrollError) console.warn("Supabase: Error fetching payroll:", payrollError.message);

        if (!flocksData && !empData) {
            // If main data missing, assume offline and load cache
            loadFromCache();
        }

      } catch (error) {
        console.error("Critical error fetching data:", error);
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

  // Helper to handle Supabase responses correctly (checking error object)
  const safeSupabaseCall = async (call: Promise<any>, errorContext = "Operation") => {
      try {
          const { error } = await call;
          if (error) {
              console.error(`Supabase error [${errorContext}]:`, error);
              const errMsg = error.message || error.details || JSON.stringify(error);
              addNotification('ERROR', 'Sync Failed', `${errorContext}: ${errMsg}`);
          }
      } catch (e: any) {
          console.warn(`Network error [${errorContext}]:`, e);
          // Don't notify for network error to avoid spamming offline users
      }
  };

  const addItem = async (item: InventoryItem) => {
    setItems(prev => [item, ...prev]);
    safeSupabaseCall(supabase.from('inventory_items').insert([item]), 'Add Item');
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    safeSupabaseCall(supabase.from('inventory_items').update(updates).eq('id', id), 'Update Item');
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    safeSupabaseCall(supabase.from('inventory_items').delete().eq('id', id), 'Delete Item');
  };

  const adjustStock = async (id: string, amount: number) => {
    const currentItem = items.find(i => i.id === id);
    if (!currentItem) return;
    const newQuantity = Math.max(0, currentItem.quantity + amount);
    const newLastRestocked = amount > 0 ? new Date().toISOString().split('T')[0] : currentItem.lastRestocked;
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQuantity, lastRestocked: newLastRestocked } : item));
    safeSupabaseCall(supabase.from('inventory_items').update({ quantity: newQuantity, lastRestocked: newLastRestocked }).eq('id', id), 'Adjust Stock');
  };

  const logConsumption = async (record: FeedConsumption) => {
    setConsumptionRecords(prev => [record, ...prev]);
    safeSupabaseCall(supabase.from('consumption_logs').insert([record]), 'Log Feed');
  };

  const updateConsumption = async (id: string, updates: Partial<FeedConsumption>) => {
    setConsumptionRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    safeSupabaseCall(supabase.from('consumption_logs').update(updates).eq('id', id), 'Update Feed Log');
  };

  const deleteConsumption = async (id: string) => {
    setConsumptionRecords(prev => prev.filter(r => r.id !== id));
    safeSupabaseCall(supabase.from('consumption_logs').delete().eq('id', id), 'Delete Feed Log');
  };

  const logEggCollection = async (log: EggCollectionLog) => {
    setEggLogs(prev => [log, ...prev]);
    safeSupabaseCall(supabase.from('egg_logs').insert([log]), 'Log Eggs');
  };

  const updateEggLog = async (id: string, updates: Partial<EggCollectionLog>) => {
    setEggLogs(prev => prev.map(log => log.id === id ? { ...log, ...updates } : log));
    safeSupabaseCall(supabase.from('egg_logs').update(updates).eq('id', id), 'Update Egg Log');
  };

  const deleteEggLog = async (id: string) => {
    setEggLogs(prev => prev.filter(log => log.id !== id));
    safeSupabaseCall(supabase.from('egg_logs').delete().eq('id', id), 'Delete Egg Log');
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
      safeSupabaseCall(supabase.from('transactions').insert([transaction]), 'Auto-Log Transaction');
    }
    safeSupabaseCall(supabase.from('sales').insert([sale]), 'Add Sale');
  };

  const updateSale = async (id: string, updates: Partial<SaleRecord>) => {
    setSalesRecords(prev => prev.map(sale => sale.id === id ? { ...sale, ...updates } : sale));
    safeSupabaseCall(supabase.from('sales').update(updates).eq('id', id), 'Update Sale');
  };

  const deleteSale = async (id: string) => {
    setSalesRecords(prev => prev.filter(sale => sale.id !== id));
    safeSupabaseCall(supabase.from('sales').delete().eq('id', id), 'Delete Sale');
  };

  const updateSaleStatus = async (id: string, status: SaleStatus) => {
    setSalesRecords(prev => prev.map(sale => sale.id === id ? { ...sale, status } : sale));
    safeSupabaseCall(supabase.from('sales').update({ status }).eq('id', id), 'Update Sale Status');
  };

  const addTransaction = async (transaction: FinancialTransaction) => {
    setTransactions(prev => [transaction, ...prev]);
    safeSupabaseCall(supabase.from('transactions').insert([transaction]), 'Add Transaction');
  };

  const updateTransaction = async (id: string, updates: Partial<FinancialTransaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    safeSupabaseCall(supabase.from('transactions').update(updates).eq('id', id), 'Update Transaction');
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    safeSupabaseCall(supabase.from('transactions').delete().eq('id', id), 'Delete Transaction');
  };

  const addTask = async (task: Task) => {
    setTasks(prev => [task, ...prev]);
    safeSupabaseCall(supabase.from('tasks').insert([task]), 'Add Task');
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    safeSupabaseCall(supabase.from('tasks').update(updates).eq('id', id), 'Update Task');
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    safeSupabaseCall(supabase.from('tasks').delete().eq('id', id), 'Delete Task');
  };

  const addFlock = async (flock: Flock) => {
    const flockWithAge = { ...flock, ageInDays: calculateFlockAge(flock.startDate, flock.initialAge) };
    setFlocks(prev => [flockWithAge, ...prev]);
    
    // IMPORTANT: Exclude fields that do not exist in the database schema.
    // 'acquisitionVatRate', 'ageInDays', 'costPerBird', 'totalAcquisitionCost' are known to cause errors if sent.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { acquisitionVatRate, ageInDays, costPerBird, totalAcquisitionCost, ...dbPayload } = flockWithAge;
    
    safeSupabaseCall(supabase.from('flocks').insert([dbPayload]), 'Add Flock');
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
    
    // Ensure we don't send potentially missing columns on update either
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { acquisitionVatRate, ageInDays, costPerBird, totalAcquisitionCost, ...safeUpdates } = updates;
    
    safeSupabaseCall(supabase.from('flocks').update(safeUpdates).eq('id', id), 'Update Flock');
  };

  const deleteFlock = async (id: string) => {
    setFlocks(prev => prev.filter(f => f.id !== id));
    safeSupabaseCall(supabase.from('flocks').delete().eq('id', id), 'Delete Flock');
  };

  const addHealthRecord = async (record: HealthRecord) => {
    setHealthRecords(prev => [record, ...prev]);
    safeSupabaseCall(supabase.from('health_records').insert([record]), 'Add Health Record');
  };

  const updateHealthRecord = async (id: string, updates: Partial<HealthRecord>) => {
    setHealthRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    safeSupabaseCall(supabase.from('health_records').update(updates).eq('id', id), 'Update Health Record');
  };

  const deleteHealthRecord = async (id: string) => {
    setHealthRecords(prev => prev.filter(r => r.id !== id));
    safeSupabaseCall(supabase.from('health_records').delete().eq('id', id), 'Delete Health Record');
  };

  const addDailyLog = async (log: DailyLog) => {
    setDailyLogs(prev => [log, ...prev]);
    safeSupabaseCall(supabase.from('daily_logs').insert([log]), 'Add Daily Log');
  };

  const updateDailyLog = async (id: string, updates: Partial<DailyLog>) => {
    setDailyLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    safeSupabaseCall(supabase.from('daily_logs').update(updates).eq('id', id), 'Update Daily Log');
  };

  const deleteDailyLog = async (id: string) => {
    setDailyLogs(prev => prev.filter(l => l.id !== id));
    safeSupabaseCall(supabase.from('daily_logs').delete().eq('id', id), 'Delete Daily Log');
  };

  const addCustomer = async (customer: Customer) => {
    setCustomers(prev => [customer, ...prev]);
    safeSupabaseCall(supabase.from('customers').insert([customer]), 'Add Customer');
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    safeSupabaseCall(supabase.from('customers').update(updates).eq('id', id), 'Update Customer');
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    safeSupabaseCall(supabase.from('customers').delete().eq('id', id), 'Delete Customer');
  };

  const addCustomEvent = async (event: FarmEvent) => {
    setCustomEvents(prev => [event, ...prev]);
    safeSupabaseCall(supabase.from('custom_events').insert([event]), 'Add Event');
  };

  const deleteCustomEvent = async (id: string) => {
    setCustomEvents(prev => prev.filter(e => e.id !== id));
    safeSupabaseCall(supabase.from('custom_events').delete().eq('id', id), 'Delete Event');
  };

  // --- HR / Employee Management ---

  const addEmployee = async (employee: Employee) => {
    setEmployees(prev => [...prev, employee]);
    const dbRecord = mapEmployeeToDB(employee);
    safeSupabaseCall(supabase.from('employees').insert([dbRecord]), 'Add Employee');
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const dbUpdates = mapEmployeeToDB(updates);
    safeSupabaseCall(supabase.from('employees').update(dbUpdates).eq('id', id), 'Update Employee');
  };

  const deleteEmployee = async (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    safeSupabaseCall(supabase.from('employees').delete().eq('id', id), 'Delete Employee');
  };

  const addPayrollRun = async (run: PayrollRun) => {
    setPayrollRuns(prev => [...prev, run]);
    const dbRecord = mapPayrollToDB(run);
    safeSupabaseCall(supabase.from('payroll_records').insert([dbRecord]), 'Add Payroll');
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
