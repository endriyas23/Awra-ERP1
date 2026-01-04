
import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useNotification } from '../context/NotificationContext';
import { Employee, Department, EmploymentType, SalaryStructure, PayrollRun, Task, UserRole } from '../types';
import StatCard from '../components/StatCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#0f766e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

const HRManagement: React.FC = () => {
  const { employees, addEmployee, updateEmployee, deleteEmployee, payrollRuns, addPayrollRun, transactions, addTransaction, tasks, addTask, updateTask, deleteTask, flocks } = useInventory();
  const { addNotification } = useNotification();
  
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'EMPLOYEES' | 'PAYROLL' | 'TASKS'>('DASHBOARD');
  
  // --- States for Employee Modal ---
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empStep, setEmpStep] = useState(1);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  
  const initialEmpForm: Partial<Employee> = {
      fullName: '', nationalId: '', phone: '', address: '', emergencyContact: '', gender: 'MALE', dob: '', photoUrl: '',
      jobTitle: '', department: 'FARM_OPS', employmentType: 'PERMANENT', status: 'ACTIVE', hireDate: new Date().toISOString().split('T')[0],
      salaryStructure: 'MONTHLY', baseSalary: 0,
      allowances: { housing: 0, transport: 0, risk: 0, other: 0 },
      deductions: { pension: 0, tax: 0, healthInsurance: 0 }
  };
  const [empForm, setEmpForm] = useState(initialEmpForm);

  // --- States for Payroll ---
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // --- States for Task ---
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
      title: '', assignee: '', priority: 'MEDIUM', due: new Date().toISOString().split('T')[0], department: 'FARM_OPS', flockId: ''
  });

  // --- Analytics Data ---
  const activeEmployees = employees.filter(e => e.status === 'ACTIVE');
  
  const payrollCostByDept = useMemo(() => {
      const data: Record<string, number> = {};
      employees.forEach(e => {
          if (e.status === 'ACTIVE') {
              const total = e.baseSalary + (Object.values(e.allowances) as number[]).reduce((a, b) => a + b, 0);
              data[e.department] = (data[e.department] || 0) + total;
          }
      });
      return Object.keys(data).map(key => ({ name: key.replace('_', ' '), value: data[key] }));
  }, [employees]);

  const productivityData = useMemo(() => {
      // Mock productivity based on completed tasks per assignee
      const counts: Record<string, number> = {};
      tasks.filter(t => t.status === 'COMPLETED').forEach(t => {
          if (t.assignee) counts[t.assignee] = (counts[t.assignee] || 0) + 1;
      });
      return Object.keys(counts).map(key => ({ name: key, tasks: counts[key] })).slice(0, 7);
  }, [tasks]);

  // --- Handlers ---

  const handleOpenEmpModal = (emp?: Employee) => {
      if (emp) {
          setEditingEmpId(emp.id);
          setEmpForm(emp);
      } else {
          setEditingEmpId(null);
          setEmpForm(initialEmpForm);
      }
      setEmpStep(1);
      setIsEmpModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
      e.preventDefault();
      // Basic validation
      if (!empForm.fullName || !empForm.jobTitle || !empForm.baseSalary) {
          addNotification('WARNING', 'Missing Data', 'Please fill required fields (Name, Job, Base Salary).');
          return;
      }

      if (editingEmpId) {
          updateEmployee(editingEmpId, empForm);
          addNotification('SUCCESS', 'Updated', 'Employee record updated.');
      } else {
          // Use randomUUID if available, otherwise simple fallback for legacy browsers
          const newId = typeof crypto !== 'undefined' && crypto.randomUUID 
              ? crypto.randomUUID() 
              : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                  const r = Math.random() * 16 | 0;
                  const v = c === 'x' ? r : (r & 0x3 | 0x8);
                  return v.toString(16);
              });
              
          addEmployee({ ...empForm, id: newId } as Employee);
          addNotification('SUCCESS', 'Created', 'New employee onboarded.');
      }
      setIsEmpModalOpen(false);
  };

  const calculateNetPay = (emp: Employee) => {
      const allowances = (Object.values(emp.allowances) as number[]).reduce((a, b) => a + b, 0);
      const deductions = (Object.values(emp.deductions) as number[]).reduce((a, b) => a + b, 0);
      return (emp.baseSalary + allowances) - deductions;
  };

  const handleRunPayroll = () => {
      // Check if already run
      if (payrollRuns.some(p => p.period === payrollPeriod)) {
          if (!confirm(`Payroll for ${payrollPeriod} already exists entries. Continue adding?`)) return;
      }

      let totalNetPay = 0;
      let totalTax = 0;
      let totalPension = 0;
      let count = 0;

      activeEmployees.forEach(emp => {
          // Skip if already processed for this period
          if (payrollRuns.some(p => p.period === payrollPeriod && p.employeeId === emp.id)) return;

          const allowances = (Object.values(emp.allowances) as number[]).reduce((a, b) => a + b, 0);
          const deductions = (Object.values(emp.deductions) as number[]).reduce((a, b) => a + b, 0);
          const net = (emp.baseSalary + allowances) - deductions;

          // Track specific deduction totals for Financials
          totalTax += emp.deductions.tax || 0;
          totalPension += emp.deductions.pension || 0;

          const run: PayrollRun = {
              id: `PR-${payrollPeriod}-${emp.id}`, // Note: Payroll ID structure might need check if strictly UUID, but usually this is custom text in types. If DB payroll_records id is UUID, this will also fail. Assuming only employees table for now based on error.
              period: payrollPeriod,
              dateProcessed: new Date().toISOString().split('T')[0],
              employeeId: emp.id,
              employeeName: emp.fullName,
              basePay: emp.baseSalary,
              totalAllowances: allowances,
              totalDeductions: deductions,
              overtimeHours: 0, // Mock for now
              overtimePay: 0,
              netPay: net,
              status: 'PAID'
          };
          
          addPayrollRun(run);
          totalNetPay += net;
          count++;
      });

      if (count > 0) {
          const today = new Date().toISOString().split('T')[0];

          // 1. Log Net Salary Expense (Cash Outflow - COMPLETED)
          if (totalNetPay > 0) {
              addTransaction({
                  id: `EXP-PAY-NET-${payrollPeriod}-${Date.now()}`,
                  date: today,
                  description: `Net Salary Payout: ${payrollPeriod}`,
                  amount: totalNetPay,
                  type: 'EXPENSE',
                  category: 'LABOR',
                  status: 'COMPLETED'
              });
          }

          // 2. Log Tax Liability (Accrued Expense - PENDING Payment to Govt)
          if (totalTax > 0) {
              addTransaction({
                  id: `EXP-PAY-TAX-${payrollPeriod}-${Date.now()}`,
                  date: today,
                  description: `Payroll Tax (PAYE): ${payrollPeriod}`,
                  amount: totalTax,
                  type: 'EXPENSE',
                  category: 'OTHER', // Tax isn't strictly Labor cost in cash flow sense yet, but a liability
                  status: 'PENDING'
              });
          }

          // 3. Log Pension Liability (Accrued Expense - PENDING Payment to Fund)
          if (totalPension > 0) {
              addTransaction({
                  id: `EXP-PAY-PEN-${payrollPeriod}-${Date.now()}`,
                  date: today,
                  description: `Pension Fund: ${payrollPeriod}`,
                  amount: totalPension,
                  type: 'EXPENSE',
                  category: 'OTHER',
                  status: 'PENDING'
              });
          }

          addNotification('SUCCESS', 'Payroll Processed', `${count} payslips generated. Ledger updated with Net Pay, Tax, and Pension liabilities.`);
      } else {
          addNotification('INFO', 'No Action', 'All active employees already processed for this period.');
      }
      setIsPayrollModalOpen(false);
  };

  const handleDeleteEmployee = (id: string) => {
      if (confirm("Terminate this employee record?")) {
          deleteEmployee(id);
      }
  };

  // --- Render Sections ---

  const renderDashboard = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="Total Employees" value={employees.length} icon="👥" color="bg-blue-500" />
              <StatCard label="Active Workforce" value={activeEmployees.length} icon="👷" color="bg-emerald-500" />
              <StatCard label="Pending Tasks" value={tasks.filter(t => t.status !== 'COMPLETED').length} icon="📋" color="bg-amber-500" />
              <StatCard label="Monthly Payroll Est." value={`$${activeEmployees.reduce((sum, e) => sum + calculateNetPay(e), 0).toLocaleString()}`} icon="💵" color="bg-indigo-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">Labor Cost Distribution</h3>
                  <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={payrollCostByDept} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                  {payrollCostByDept.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">Task Productivity (Top Performers)</h3>
                  <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={productivityData} layout="vertical" margin={{ left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                              <Tooltip cursor={{fill: '#f1f5f9'}} />
                              <Bar dataKey="tasks" fill="#0f766e" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderEmployees = () => (
      <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800">Employee Master Data</h3>
              <button onClick={() => handleOpenEmpModal()} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">+ Add Employee</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {employees.map(emp => (
                  <div key={emp.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-400">
                              {emp.photoUrl ? <img src={emp.photoUrl} alt="" className="w-full h-full rounded-full object-cover"/> : emp.fullName.charAt(0)}
                          </div>
                          <div className="flex-1">
                              <h4 className="font-bold text-slate-800">{emp.fullName}</h4>
                              <p className="text-xs text-slate-500">{emp.jobTitle}</p>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded mt-1 inline-block">{emp.department.replace('_', ' ')}</span>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                              <button onClick={() => handleOpenEmpModal(emp)} className="text-slate-400 hover:text-teal-600">✎</button>
                              <button onClick={() => handleDeleteEmployee(emp.id)} className="text-slate-400 hover:text-red-600">🗑</button>
                          </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50 text-xs text-slate-500 space-y-2">
                          <div className="flex justify-between"><span>Status:</span> <span className={`font-bold ${emp.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-500'}`}>{emp.status}</span></div>
                          <div className="flex justify-between"><span>Phone:</span> <span>{emp.phone}</span></div>
                          <div className="flex justify-between"><span>Type:</span> <span>{emp.employmentType}</span></div>
                          <div className="flex justify-between"><span>Base Pay:</span> <span className="font-bold text-slate-800">${emp.baseSalary.toLocaleString()}</span></div>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const renderPayroll = () => (
      <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                  <h3 className="font-bold text-slate-800">Payroll Processing</h3>
                  <input type="month" value={payrollPeriod} onChange={e => setPayrollPeriod(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-teal-500"/>
              </div>
              <button onClick={() => setIsPayrollModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200">
                  Process {payrollPeriod}
              </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                      <tr>
                          <th className="px-6 py-4">Employee</th>
                          <th className="px-6 py-4">Period</th>
                          <th className="px-6 py-4">Base Pay</th>
                          <th className="px-6 py-4">Allowances</th>
                          <th className="px-6 py-4">Deductions</th>
                          <th className="px-6 py-4 text-right">Net Pay</th>
                          <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                      {payrollRuns.filter(p => p.period === payrollPeriod).map(run => (
                          <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-700">{run.employeeName}</td>
                              <td className="px-6 py-4 font-mono text-slate-500">{run.period}</td>
                              <td className="px-6 py-4 text-slate-600">${run.basePay.toLocaleString()}</td>
                              <td className="px-6 py-4 text-emerald-600">+${run.totalAllowances.toLocaleString()}</td>
                              <td className="px-6 py-4 text-red-500">-${run.totalDeductions.toLocaleString()}</td>
                              <td className="px-6 py-4 text-right font-bold text-slate-800">${run.netPay.toLocaleString()}</td>
                              <td className="px-6 py-4 text-right">
                                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">{run.status}</span>
                              </td>
                          </tr>
                      ))}
                      {payrollRuns.filter(p => p.period === payrollPeriod).length === 0 && (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">No payroll records for this period. Click 'Process' to generate.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const renderTasks = () => (
      <div className="space-y-6 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800">Task Management</h3>
              <button onClick={() => setIsTaskModalOpen(true)} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">+ Assign Task</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {['PENDING', 'IN_PROGRESS', 'COMPLETED'].map(status => (
                  <div key={status} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <h4 className="font-bold text-slate-500 text-xs uppercase mb-4 flex justify-between">
                          {status.replace('_', ' ')}
                          <span className="bg-slate-200 text-slate-600 px-2 rounded-full">{tasks.filter(t => t.status === status).length}</span>
                      </h4>
                      <div className="space-y-3">
                          {tasks.filter(t => t.status === status).map(task => (
                              <div key={task.id} className={`bg-white p-3 rounded-xl border border-slate-100 border-l-4 shadow-sm hover:shadow-md transition-all ${
                                  task.priority === 'HIGH' ? 'border-l-red-500' : 
                                  task.priority === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-emerald-500'
                              }`}>
                                  <div className="flex justify-between items-start mb-2">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          task.priority === 'HIGH' ? 'bg-red-50 text-red-600' : 
                                          task.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                      }`}>
                                          {task.priority}
                                      </span>
                                      {task.flockId && (
                                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1" title="Associated Flock">
                                              🐣 {flocks.find(f => f.id === task.flockId)?.name || 'Unknown Flock'}
                                          </span>
                                      )}
                                      <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 font-bold text-lg leading-none ml-2">×</button>
                                  </div>
                                  
                                  <p className="font-bold text-slate-800 text-sm mb-2">{task.title}</p>
                                  
                                  {/* Priority Indicator Bar */}
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
                                      <div 
                                          className={`h-full rounded-full transition-all duration-500 ${
                                              task.priority === 'HIGH' ? 'w-full bg-red-500' : 
                                              task.priority === 'MEDIUM' ? 'w-2/3 bg-amber-500' : 'w-1/3 bg-emerald-500'
                                          }`}
                                          title={`Priority Level: ${task.priority}`}
                                      ></div>
                                  </div>

                                  <div className="text-xs text-slate-500 flex justify-between items-center">
                                      <span className="flex items-center gap-1" title={task.assignee}>
                                          👤 {task.assignee ? (task.assignee.length > 12 ? task.assignee.substring(0,10)+'...' : task.assignee) : 'Unassigned'}
                                      </span>
                                      <span className={`${new Date(task.due) < new Date() && status !== 'COMPLETED' ? 'text-red-500 font-bold' : ''}`}>
                                          📅 {new Date(task.due).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                      </span>
                                  </div>
                                  
                                  {status !== 'COMPLETED' && (
                                      <button 
                                          onClick={() => updateTask(task.id, { status: status === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED' })}
                                          className="w-full mt-3 py-1.5 bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-600 text-xs font-bold rounded-lg border border-slate-100 transition-all flex items-center justify-center gap-1"
                                      >
                                          {status === 'PENDING' ? 'Start Task' : 'Complete'} <span className="text-[10px]">→</span>
                                      </button>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-20">
        {/* Header */}
        <div>
            <h2 className="text-3xl font-bold text-slate-900">HR & Operations</h2>
            <p className="text-slate-500 mt-1">Manage workforce, payroll, and operational tasks.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
            {['DASHBOARD', 'EMPLOYEES', 'PAYROLL', 'TASKS'].map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    {tab}
                </button>
            ))}
        </div>

        {/* Content */}
        {activeTab === 'DASHBOARD' && renderDashboard()}
        {activeTab === 'EMPLOYEES' && renderEmployees()}
        {activeTab === 'PAYROLL' && renderPayroll()}
        {activeTab === 'TASKS' && renderTasks()}

        {/* Employee Modal */}
        {isEmpModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
                        <h3 className="text-xl font-bold text-slate-800">{editingEmpId ? 'Edit Employee' : 'New Employee Onboarding'}</h3>
                        <button onClick={() => setIsEmpModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    
                    {/* Stepper */}
                    <div className="flex bg-slate-50 border-b border-slate-100">
                        {[1, 2, 3].map(s => (
                            <button key={s} onClick={() => setEmpStep(s)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${empStep === s ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-400'}`}>
                                {s === 1 ? 'Personal' : s === 2 ? 'Employment' : 'Compensation'}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSaveEmployee} className="p-6 flex-1 overflow-y-auto">
                        {empStep === 1 && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                        <input required type="text" className="w-full p-3 rounded-xl border border-slate-200" value={empForm.fullName} onChange={e => setEmpForm({...empForm, fullName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">National ID</label>
                                        <input type="text" className="w-full p-3 rounded-xl border border-slate-200" value={empForm.nationalId} onChange={e => setEmpForm({...empForm, nationalId: e.target.value})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                                        <input type="tel" className="w-full p-3 rounded-xl border border-slate-200" value={empForm.phone} onChange={e => setEmpForm({...empForm, phone: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gender</label>
                                        <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={empForm.gender} onChange={e => setEmpForm({...empForm, gender: e.target.value as any})}>
                                            <option value="MALE">Male</option>
                                            <option value="FEMALE">Female</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                                    <textarea className="w-full p-3 rounded-xl border border-slate-200 h-20 resize-none" value={empForm.address} onChange={e => setEmpForm({...empForm, address: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Emergency Contact</label>
                                    <input type="text" className="w-full p-3 rounded-xl border border-slate-200" value={empForm.emergencyContact} onChange={e => setEmpForm({...empForm, emergencyContact: e.target.value})} />
                                </div>
                            </div>
                        )}

                        {empStep === 2 && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Job Title</label>
                                        <input required type="text" className="w-full p-3 rounded-xl border border-slate-200" value={empForm.jobTitle} onChange={e => setEmpForm({...empForm, jobTitle: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                                        <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={empForm.department} onChange={e => setEmpForm({...empForm, department: e.target.value as any})}>
                                            <option value="FARM_OPS">Farm Operations</option>
                                            <option value="HATCHERY">Hatchery</option>
                                            <option value="FEED_MILL">Feed Mill</option>
                                            <option value="PROCESSING">Processing</option>
                                            <option value="ADMIN">Admin</option>
                                            <option value="VETERINARY">Veterinary</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employment Type</label>
                                        <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={empForm.employmentType} onChange={e => setEmpForm({...empForm, employmentType: e.target.value as any})}>
                                            <option value="PERMANENT">Permanent</option>
                                            <option value="CONTRACT">Contract</option>
                                            <option value="DAILY_LABOR">Daily Labor</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hire Date</label>
                                        <input type="date" className="w-full p-3 rounded-xl border border-slate-200" value={empForm.hireDate} onChange={e => setEmpForm({...empForm, hireDate: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                                    <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={empForm.status} onChange={e => setEmpForm({...empForm, status: e.target.value as any})}>
                                        <option value="ACTIVE">Active</option>
                                        <option value="SUSPENDED">Suspended</option>
                                        <option value="TERMINATED">Terminated</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {empStep === 3 && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Structure</label>
                                        <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={empForm.salaryStructure} onChange={e => setEmpForm({...empForm, salaryStructure: e.target.value as any})}>
                                            <option value="MONTHLY">Monthly Salary</option>
                                            <option value="DAILY">Daily Wage</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Base Amount</label>
                                        <input required type="number" className="w-full p-3 rounded-xl border border-slate-200" value={empForm.baseSalary} onChange={e => setEmpForm({...empForm, baseSalary: Number(e.target.value)})} />
                                    </div>
                                </div>
                                
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <h4 className="text-xs font-bold text-emerald-800 mb-2 uppercase">Allowances</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-emerald-700">Housing</label>
                                            <input type="number" className="w-full p-2 text-sm border border-emerald-200 rounded-lg" value={empForm.allowances?.housing} onChange={e => setEmpForm({...empForm, allowances: {...empForm.allowances!, housing: Number(e.target.value)}})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-emerald-700">Transport</label>
                                            <input type="number" className="w-full p-2 text-sm border border-emerald-200 rounded-lg" value={empForm.allowances?.transport} onChange={e => setEmpForm({...empForm, allowances: {...empForm.allowances!, transport: Number(e.target.value)}})} />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                    <h4 className="text-xs font-bold text-red-800 mb-2 uppercase">Deductions</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-red-700">Tax</label>
                                            <input type="number" className="w-full p-2 text-sm border border-red-200 rounded-lg" value={empForm.deductions?.tax} onChange={e => setEmpForm({...empForm, deductions: {...empForm.deductions!, tax: Number(e.target.value)}})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-red-700">Pension</label>
                                            <input type="number" className="w-full p-2 text-sm border border-red-200 rounded-lg" value={empForm.deductions?.pension} onChange={e => setEmpForm({...empForm, deductions: {...empForm.deductions!, pension: Number(e.target.value)}})} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-6 flex justify-between">
                            {empStep > 1 && (
                                <button type="button" onClick={() => setEmpStep(s => s - 1)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold">Back</button>
                            )}
                            <div className="flex-1"></div>
                            {empStep < 3 ? (
                                <button type="button" onClick={() => setEmpStep(s => s + 1)} className="px-6 py-2 bg-teal-600 text-white rounded-xl font-bold">Next</button>
                            ) : (
                                <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">Save Employee</button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Task Modal */}
        {isTaskModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-800">Assign Task</h3>
                        <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        addTask({
                            id: `TASK-${Date.now()}`,
                            status: 'PENDING',
                            ...taskForm as any
                        });
                        setIsTaskModalOpen(false);
                    }} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                            <input required type="text" className="w-full p-3 rounded-xl border border-slate-200" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} placeholder="e.g. Clean Coop A" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Flock (Optional)</label>
                            <select 
                                className="w-full p-3 rounded-xl border border-slate-200 bg-white"
                                value={taskForm.flockId || ''}
                                onChange={e => setTaskForm({...taskForm, flockId: e.target.value})}
                            >
                                <option value="">-- General Task --</option>
                                {flocks.filter(f => f.status === 'ACTIVE').map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignee</label>
                            <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={taskForm.assignee} onChange={e => setTaskForm({...taskForm, assignee: e.target.value})}>
                                <option value="">-- Select Employee --</option>
                                {activeEmployees.map(e => <option key={e.id} value={e.fullName}>{e.fullName}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                                <input type="date" className="w-full p-3 rounded-xl border border-slate-200" value={taskForm.due} onChange={e => setTaskForm({...taskForm, due: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                                <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value as any})}>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">Create Task</button>
                    </form>
                </div>
            </div>
        )}

        {/* Payroll Confirmation Modal */}
        {isPayrollModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Confirm Payroll Run</h3>
                    <p className="text-slate-500 text-sm mb-6">
                        You are about to process payroll for <strong>{payrollPeriod}</strong> for {activeEmployees.length} active employees. 
                        This will generate expenses in the Finance module.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setIsPayrollModalOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600">Cancel</button>
                        <button onClick={handleRunPayroll} className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 rounded-xl font-bold text-white shadow-lg">Confirm</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default HRManagement;
