
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';
import { useNotification } from '../context/NotificationContext';
import { Task } from '../types';
import { supabase } from '../lib/supabaseClient';

// --- Types ---
interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  rating: number; // 1-5
  feedback: string;
  goals: string;
  reviewer: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'SICK' | 'VACATION' | 'PERSONAL' | 'MATERNITY' | 'OTHER';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface RolePermission {
  id: string;
  name: string; // Role Name
  permissions: Record<string, string>; // e.g., { inventory: 'read', health: 'write' }
}

// Progressive Income Tax Calculator
const calculateIncomeTax = (gross: number) => {
  const safeGross = Number(gross) || 0;
  let tax = 0;
  if (safeGross <= 2000) return 0;
  
  const taxable15 = Math.min(safeGross - 2000, 2000);
  tax += taxable15 * 0.15;
  if (safeGross <= 4000) return tax;

  const taxable20 = Math.min(safeGross - 4000, 3000);
  tax += taxable20 * 0.20;
  if (safeGross <= 7000) return tax;

  const taxable25 = Math.min(safeGross - 7000, 3000);
  tax += taxable25 * 0.25;
  if (safeGross <= 10000) return tax;

  const taxable30 = Math.min(safeGross - 10000, 4000);
  tax += taxable30 * 0.30;
  if (safeGross <= 14000) return tax;

  const taxable35 = safeGross - 14000;
  tax += taxable35 * 0.35;

  return tax;
};

const MODULES = ['health', 'flock', 'inventory', 'finance', 'sales', 'production', 'feed', 'hr'];

const HRManagement: React.FC = () => {
  const { addTransaction, tasks, addTask, deleteTask, updateTask, flocks } = useInventory();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  
  // Initialized as empty arrays
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  
  // Access Control State
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'PAYROLL' | 'TASKS' | 'PERFORMANCE' | 'LEAVE' | 'ACCESS'>('DIRECTORY');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  
  // Forms
  const [newEmployee, setNewEmployee] = useState({ name: '', role: 'Farm Hand', phone: '', salary: '' });
  const [newTask, setNewTask] = useState({ title: '', assignee: '', priority: 'MEDIUM' as const, due: '', flockId: '' });
  const [reviewForm, setReviewForm] = useState({
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      rating: 3,
      feedback: '',
      goals: '',
      reviewer: 'Current Manager'
  });
  const [leaveForm, setLeaveForm] = useState({
      employeeId: '',
      type: 'SICK' as LeaveRequest['type'],
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      reason: ''
  });

  // Fetch Roles on Load if Access Tab active
  useEffect(() => {
    if (activeTab === 'ACCESS') {
      fetchRoles();
    }
  }, [activeTab]);

  const fetchRoles = async () => {
    setLoadingRoles(true);
    const { data, error } = await supabase.from('roles').select('*').order('name');
    if (data) {
      setRoles(data);
    }
    setLoadingRoles(false);
  };

  // Stats
  const totalStaff = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'ACTIVE');
  const totalPayrollGross = employees.reduce((sum, e) => sum + (Number(e.salary) || 0), 0);
  
  // Performance Stats
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : '0.0';
  
  // Calculations for Run Payroll Modal
  const payrollPreview = activeEmployees.map(e => {
      const salary = Number(e.salary) || 0;
      const tax = calculateIncomeTax(salary);
      return {
          ...e,
          salary, // Ensure it's a number
          calculatedTax: tax,
          netPay: salary - tax
      };
  });

  const totalRunGross = payrollPreview.reduce((sum, e) => sum + e.salary, 0);
  const totalRunTax = payrollPreview.reduce((sum, e) => sum + e.calculatedTax, 0);
  const totalRunNet = payrollPreview.reduce((sum, e) => sum + e.netPay, 0);

  // --- Handlers ---

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = {
      id: `E00${employees.length + 1}`,
      name: newEmployee.name,
      role: newEmployee.role,
      status: 'ACTIVE',
      phone: newEmployee.phone,
      salary: Number(newEmployee.salary) || 0,
      joinedDate: new Date().toISOString().split('T')[0],
      avatar: newEmployee.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    };
    setEmployees([...employees, emp as any]);
    setIsModalOpen(false);
    setNewEmployee({ name: '', role: 'Farm Hand', phone: '', salary: '' });
    addNotification('SUCCESS', 'Employee Onboarded', `${emp.name} added successfully.`);
  };

  const deleteEmployee = (id: string) => {
    if(confirm('Are you sure you want to remove this employee?')) {
      setEmployees(employees.filter(e => e.id !== id));
      addNotification('INFO', 'Employee Removed', 'Staff directory updated.');
    }
  };

  const handleRunPayroll = () => {
      const today = new Date().toISOString().split('T')[0];
      const dateObj = new Date();
      const monthName = dateObj.toLocaleString('default', { month: 'long' });
      const batchId = `PAY-BATCH-${Date.now()}`;
      
      const newRecords = payrollPreview.map((emp, index) => ({
          id: `PAY-${Date.now()}-${index}`,
          date: today,
          employee: emp.name,
          gross: emp.salary,
          tax: emp.calculatedTax,
          net: emp.netPay,
          status: 'PAID'
      }));

      // 1. Log Net Salary Expense (Cash Outflow)
      addTransaction({
          id: `EXP-SALARY-${batchId}`,
          date: today,
          description: `Payroll Net Payout: ${monthName} (${activeEmployees.length} Staff)`,
          amount: totalRunNet, 
          withholdingAmount: totalRunTax, // Linked for tax reporting reference
          type: 'EXPENSE',
          category: 'LABOR',
          status: 'COMPLETED',
          referenceId: batchId
      });

      // 2. Log Tax Liability (Pending Payment)
      if (totalRunTax > 0) {
          addTransaction({
              id: `EXP-TAX-${batchId}`,
              date: today,
              description: `Payroll Tax Liability: ${monthName}`,
              amount: totalRunTax,
              type: 'EXPENSE', // Logged as expense accrual
              category: 'LABOR', // Part of total labor cost
              status: 'PENDING', // Outstanding liability
              referenceId: batchId
          });
      }

      setPayrollHistory([...newRecords, ...payrollHistory]);
      setIsPayrollModalOpen(false);
      
      addNotification('SUCCESS', 'Payroll Processed', `Net Payout: $${totalRunNet.toLocaleString()} | Tax Accrued: $${totalRunTax.toLocaleString()}`);
  };

  const handleAddTask = (e: React.FormEvent) => {
      e.preventDefault();
      const task: Task = {
          id: `T-${Date.now()}`,
          title: newTask.title,
          assignee: newTask.assignee || 'Unassigned',
          priority: newTask.priority,
          status: 'PENDING',
          due: newTask.due || new Date().toISOString().split('T')[0],
          flockId: newTask.flockId || undefined
      };
      addTask(task);
      setIsTaskModalOpen(false);
      setNewTask({ title: '', assignee: '', priority: 'MEDIUM', due: '', flockId: '' });
      addNotification('INFO', 'Task Assigned', `Task "${task.title}" created.`);
  };

  const handleSaveReview = (e: React.FormEvent) => {
      e.preventDefault();
      const employee = employees.find(e => e.id === reviewForm.employeeId);
      if(!employee) return;

      const newReview: PerformanceReview = {
          id: `R-${Date.now()}`,
          employeeId: employee.id,
          employeeName: employee.name,
          date: reviewForm.date,
          rating: reviewForm.rating,
          feedback: reviewForm.feedback,
          goals: reviewForm.goals,
          reviewer: reviewForm.reviewer
      };

      setReviews([newReview, ...reviews]);
      setIsReviewModalOpen(false);
      setReviewForm({ employeeId: '', date: new Date().toISOString().split('T')[0], rating: 3, feedback: '', goals: '', reviewer: 'Current Manager' });
      addNotification('SUCCESS', 'Review Saved', 'Performance evaluation logged.');
  };

  const handleRequestLeave = (e: React.FormEvent) => {
      e.preventDefault();
      const employee = employees.find(e => e.id === leaveForm.employeeId);
      if(!employee || !leaveForm.endDate) return;

      // Calculate days
      const start = new Date(leaveForm.startDate);
      const end = new Date(leaveForm.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const newLeave: LeaveRequest = {
          id: `L-${Date.now()}`,
          employeeId: employee.id,
          employeeName: employee.name,
          type: leaveForm.type,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          days: diffDays,
          reason: leaveForm.reason,
          status: 'PENDING'
      };

      setLeaveRequests([newLeave, ...leaveRequests]);
      setIsLeaveModalOpen(false);
      setLeaveForm({ employeeId: '', type: 'SICK', startDate: new Date().toISOString().split('T')[0], endDate: '', reason: '' });
      addNotification('INFO', 'Leave Requested', `${employee.name} requested ${diffDays} days.`);
  };

  const updateLeaveStatus = (id: string, status: 'APPROVED' | 'REJECTED') => {
      setLeaveRequests(prev => prev.map(req => {
          if (req.id === id) return { ...req, status };
          return req;
      }));
      addNotification(status === 'APPROVED' ? 'SUCCESS' : 'WARNING', `Leave ${status}`, 'Employee has been notified.');
  };

  const cycleTaskStatus = (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      
      const next = task.status === 'PENDING' ? 'IN_PROGRESS' : task.status === 'IN_PROGRESS' ? 'COMPLETED' : 'PENDING';
      updateTask(id, { status: next });
  };

  const handleDeleteTask = (id: string) => {
      if(confirm('Delete this task?')) {
          deleteTask(id);
      }
  };

  const deleteReview = (id: string) => {
      if(confirm('Delete this performance review?')) {
          setReviews(reviews.filter(r => r.id !== id));
      }
  };

  const deleteLeave = (id: string) => {
      if(confirm('Cancel this leave request?')) {
          setLeaveRequests(leaveRequests.filter(l => l.id !== id));
      }
  };

  // --- Access Control Handlers ---
  const handleCreateRole = async () => {
    const roleName = prompt("Enter new Role Name:");
    if (!roleName) return;
    
    const { error } = await supabase.from('roles').insert({ name: roleName.toUpperCase(), permissions: {} });
    if (error) {
      addNotification('ERROR', 'Failed to create role', error.message);
    } else {
      addNotification('SUCCESS', 'Role Created', `${roleName} added.`);
      fetchRoles();
    }
  };

  const handleUpdatePermission = async (roleId: string, module: string, type: 'read' | 'write' | 'none') => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    const newPermissions = { ...role.permissions, [module]: type };
    if (type === 'none') delete newPermissions[module];

    // Optimistic Update
    setRoles(roles.map(r => r.id === roleId ? { ...r, permissions: newPermissions } : r));

    const { error } = await supabase.from('roles').update({ permissions: newPermissions }).eq('id', roleId);
    if (error) {
      addNotification('ERROR', 'Update Failed', error.message);
      fetchRoles(); // Revert
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">HR & Team Management</h2>
          <p className="text-slate-500 mt-1">Manage staff, rosters, payroll, and performance.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2"
        >
          <span>+</span> Add Employee
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Employees" value={totalStaff} icon="👥" color="bg-blue-500" />
        <StatCard label="Monthly Gross Salary" value={`$${totalPayrollGross.toLocaleString()}`} icon="💰" color="bg-emerald-500" />
        <StatCard label="Team Performance Avg" value={`${avgRating} / 5.0`} icon="⭐" color="bg-amber-500" />
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
           {(['DIRECTORY', 'PAYROLL', 'LEAVE', 'TASKS', 'PERFORMANCE', 'ACCESS'] as const).map(tab => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`flex-1 py-4 text-sm font-bold transition-all whitespace-nowrap px-4 ${activeTab === tab ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
             >
               {tab === 'DIRECTORY' ? 'Team Directory' : 
                tab === 'PAYROLL' ? 'Payroll History' : 
                tab === 'LEAVE' ? 'Leave Requests' :
                tab === 'ACCESS' ? 'Access Control Matrix' :
                tab === 'TASKS' ? 'Task Board' : 'Performance Reviews'}
             </button>
           ))}
        </div>

        <div className="p-6 flex-1 flex flex-col">
           {activeTab === 'DIRECTORY' && (
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest rounded-lg">
                   <tr>
                     <th className="px-4 py-3 rounded-l-lg">Employee</th>
                     <th className="px-4 py-3">Role</th>
                     <th className="px-4 py-3">Status</th>
                     <th className="px-4 py-3">Contact</th>
                     <th className="px-4 py-3">Gross Salary</th>
                     <th className="px-4 py-3">Est. Tax</th>
                     <th className="px-4 py-3 rounded-r-lg text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 text-sm">
                   {employees.map(emp => {
                     const salary = Number(emp.salary) || 0;
                     const estimatedTax = calculateIncomeTax(salary);
                     return (
                     <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                       <td className="px-4 py-4">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs border border-slate-200">
                             {emp.avatar}
                           </div>
                           <div>
                             <div className="font-bold text-slate-800">{emp.name}</div>
                             <div className="text-xs text-slate-400">{emp.id}</div>
                           </div>
                         </div>
                       </td>
                       <td className="px-4 py-4 text-slate-600">{emp.role}</td>
                       <td className="px-4 py-4">
                         <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                           emp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                         }`}>
                           {emp.status.replace('_', ' ')}
                         </span>
                       </td>
                       <td className="px-4 py-4 text-slate-600 font-mono text-xs">{emp.phone}</td>
                       <td className="px-4 py-4 font-medium text-slate-800">${salary.toLocaleString()}</td>
                       <td className="px-4 py-4 text-slate-500">
                           ${estimatedTax.toLocaleString()}
                           <span className="text-[10px] text-slate-400 ml-1">
                               ({salary > 0 ? ((estimatedTax/salary)*100).toFixed(1) : 0}%)
                           </span>
                       </td>
                       <td className="px-4 py-4 text-right">
                         <button 
                           onClick={() => deleteEmployee(emp.id)}
                           className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                         >
                           Remove
                         </button>
                       </td>
                     </tr>
                   )})}
                   {employees.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No employees found.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
           )}

           {activeTab === 'ACCESS' && (
             <div className="flex flex-col h-full space-y-4">
               <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                      <h4 className="font-bold text-slate-800">Role-Based Access Control (RBAC)</h4>
                      <p className="text-xs text-slate-500">Define system permissions per role.</p>
                  </div>
                  <button 
                      onClick={handleCreateRole}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 text-sm"
                  >
                      <span>➕</span> Create New Role
                  </button>
               </div>

               {loadingRoles ? (
                 <div className="text-center py-10 text-slate-400">Loading Access Matrix...</div>
               ) : (
                 <div className="overflow-x-auto rounded-xl border border-slate-100">
                   <table className="w-full text-left">
                     <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest sticky left-0">
                       <tr>
                         <th className="px-4 py-3 border-b border-r border-slate-200 bg-slate-50 sticky left-0 min-w-[150px] z-10">Module / Feature</th>
                         {roles.map(role => (
                           <th key={role.id} className="px-4 py-3 border-b border-slate-200 text-center min-w-[120px]">{role.name}</th>
                         ))}
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 text-sm">
                       {MODULES.map(module => (
                         <tr key={module} className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-3 font-bold text-slate-700 border-r border-slate-100 capitalize bg-white sticky left-0 z-10">{module}</td>
                           {roles.map(role => {
                             const perm = role.permissions?.[module] || 'none';
                             return (
                               <td key={`${role.id}-${module}`} className="px-4 py-3 text-center">
                                 <select 
                                   value={perm}
                                   onChange={(e) => handleUpdatePermission(role.id, module, e.target.value as any)}
                                   className={`text-xs font-bold rounded px-2 py-1 uppercase outline-none border ${
                                     perm === 'write' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                     perm === 'read' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                     'bg-slate-100 text-slate-400 border-slate-200'
                                   }`}
                                 >
                                   <option value="none">--</option>
                                   <option value="read">Read</option>
                                   <option value="write">Write</option>
                                 </select>
                               </td>
                             );
                           })}
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
               <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                 <strong>Note:</strong> Changes to permissions are saved automatically but may require users to re-login to take full effect in complex scenarios.
               </div>
             </div>
           )}

           {activeTab === 'PAYROLL' && (
             <div className="flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <h4 className="font-bold text-slate-800">Payroll Ledger</h4>
                        <p className="text-xs text-slate-500">History of salary disbursements</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => navigate('/finance')}
                            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all text-sm flex items-center gap-2"
                        >
                            <span>📊</span> View Financials
                        </button>
                        <button 
                            onClick={() => setIsPayrollModalOpen(true)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 text-sm"
                        >
                            <span>💸</span> Process Payroll
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Gross</th>
                        <th className="px-6 py-4">Tax (WHT)</th>
                        <th className="px-6 py-4">Net Pay</th>
                        <th className="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                        {payrollHistory.map(pay => (
                        <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-slate-500">{pay.date}</td>
                            <td className="px-6 py-4 font-bold text-slate-700">{pay.employee}</td>
                            <td className="px-6 py-4 text-slate-500">${pay.gross.toLocaleString()}</td>
                            <td className="px-6 py-4 text-red-500 text-xs">-${pay.tax.toLocaleString()}</td>
                            <td className="px-6 py-4 text-emerald-700 font-bold">${pay.net.toLocaleString()}</td>
                            <td className="px-6 py-4">
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase">
                                {pay.status}
                            </span>
                            </td>
                        </tr>
                        ))}
                        {payrollHistory.length === 0 && (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No payroll history found.</td></tr>
                        )}
                    </tbody>
                    </table>
                </div>
             </div>
           )}

           {activeTab === 'LEAVE' && (
             <div className="flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <h4 className="font-bold text-slate-800">Leave Management</h4>
                        <p className="text-xs text-slate-500">Track employee absence and time off.</p>
                    </div>
                    <button 
                        onClick={() => setIsLeaveModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 text-sm"
                    >
                        <span>📅</span> Request Leave
                    </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4 w-1/3">Reason</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {leaveRequests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{req.employeeName}</div>
                                        <div className="text-[10px] text-slate-400">{req.employeeId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            req.type === 'SICK' ? 'bg-pink-100 text-pink-700' : 
                                            req.type === 'VACATION' ? 'bg-blue-100 text-blue-700' :
                                            'bg-purple-100 text-purple-700'
                                        }`}>
                                            {req.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-800 font-medium">{req.days} Days</div>
                                        <div className="text-[10px] text-slate-500">{req.startDate} → {req.endDate}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 italic">
                                        "{req.reason}"
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                            req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                                            req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {req.status === 'PENDING' && (
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => updateLeaveStatus(req.id, 'APPROVED')}
                                                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded text-xs font-bold"
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    onClick={() => updateLeaveStatus(req.id, 'REJECTED')}
                                                    className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs font-bold"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {req.status !== 'PENDING' && (
                                            <button 
                                                onClick={() => deleteLeave(req.id)}
                                                className="text-slate-300 hover:text-red-500 font-bold"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {leaveRequests.length === 0 && (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No leave requests found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
           )}

           {activeTab === 'TASKS' && (
             <div className="flex flex-col h-full space-y-4">
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <h4 className="font-bold text-slate-800">Team Tasks</h4>
                        <p className="text-xs text-slate-500">Assign and track operational duties</p>
                    </div>
                    <button 
                        onClick={() => setIsTaskModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 text-sm"
                    >
                        <span>📋</span> Assign Task
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tasks.map(task => {
                        const linkedFlock = flocks.find(f => f.id === task.flockId);
                        return (
                        <div key={task.id} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-blue-200 transition-colors flex flex-col justify-between group">
                            <div className="mb-3">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                        task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 
                                        task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        {task.priority} Priority
                                    </span>
                                    <button onClick={() => handleDeleteTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>
                                </div>
                                <h4 className="font-bold text-slate-800">{task.title}</h4>
                                <div className="text-xs text-slate-500 mt-1 flex gap-2 flex-wrap">
                                    <span>👤 {task.assignee}</span>
                                    <span>📅 Due: {task.due}</span>
                                </div>
                                {linkedFlock && (
                                    <div className="mt-2 pt-2 border-t border-slate-200/50">
                                        <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md flex items-center gap-1 w-fit">
                                            <span>🐣</span> {linkedFlock.name}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                                <span className={`text-xs font-bold ${
                                    task.status === 'COMPLETED' ? 'text-emerald-600' :
                                    task.status === 'IN_PROGRESS' ? 'text-blue-600' :
                                    'text-slate-500'
                                }`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                                <button 
                                    onClick={() => cycleTaskStatus(task.id)}
                                    className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-bold transition-colors"
                                >
                                    Update Status
                                </button>
                            </div>
                        </div>
                    )})}
                    {tasks.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                           No tasks assigned.
                        </div>
                    )}
                </div>
             </div>
           )}

           {activeTab === 'PERFORMANCE' && (
             <div className="flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <h4 className="font-bold text-slate-800">Performance Reviews</h4>
                        <p className="text-xs text-slate-500">Track evaluations and goals.</p>
                    </div>
                    <button 
                        onClick={() => setIsReviewModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 text-sm"
                    >
                        <span>⭐</span> New Review
                    </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Rating</th>
                                <th className="px-6 py-4 w-1/3">Feedback / Goals</th>
                                <th className="px-6 py-4">Reviewer</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {reviews.map(review => (
                                <tr key={review.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-slate-500">{review.date}</td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{review.employeeName}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex text-amber-400 text-lg">
                                            {'★'.repeat(review.rating)}
                                            <span className="text-slate-200">{'★'.repeat(5 - review.rating)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <p className="text-slate-600 italic">"{review.feedback}"</p>
                                            {review.goals && (
                                                <p className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded w-fit">
                                                    🎯 Goal: {review.goals}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs">{review.reviewer}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => deleteReview(review.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {reviews.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No reviews recorded yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
           )}
        </div>
      </div>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
              <h3 className="text-xl font-bold text-slate-800">New Employee</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Kofi Annan"
                  value={newEmployee.name}
                  onChange={e => setNewEmployee({...newEmployee, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                <select 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                  value={newEmployee.role}
                  onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}
                >
                  <option value="Farm Manager">Farm Manager</option>
                  <option value="Veterinarian">Veterinarian</option>
                  <option value="Farm Hand">Farm Hand</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Security">Security</option>
                  <option value="Driver">Driver</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="+233..."
                    value={newEmployee.phone}
                    onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gross Salary</label>
                  <input 
                    required
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="0.00"
                    value={newEmployee.salary}
                    onChange={e => setNewEmployee({...newEmployee, salary: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
                  <p><strong>Note:</strong> Income tax will be calculated automatically based on standard brackets (0% - 35%) when payroll is processed.</p>
              </div>
              <button 
                type="submit" 
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg mt-2 transition-all"
              >
                Onboard Employee
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
              <h3 className="text-xl font-bold text-slate-800">Assign New Task</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                <input 
                  required
                  type="text" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Repair Fence"
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                <select 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newTask.assignee}
                  onChange={e => setNewTask({...newTask, assignee: e.target.value})}
                >
                  <option value="">-- Select Employee --</option>
                  {activeEmployees.map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Related Flock (Optional)</label>
                <select
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newTask.flockId}
                  onChange={e => setNewTask({...newTask, flockId: e.target.value})}
                >
                  <option value="">-- General Task --</option>
                  {flocks.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value as any})}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newTask.due}
                    onChange={e => setNewTask({...newTask, due: e.target.value})}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg mt-2 transition-all"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <h3 className="text-xl font-bold text-slate-800">Log Performance Review</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveReview} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee</label>
                    <select 
                        required
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={reviewForm.employeeId}
                        onChange={e => setReviewForm({...reviewForm, employeeId: e.target.value})}
                    >
                        <option value="">-- Select --</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input 
                        required
                        type="date"
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={reviewForm.date}
                        onChange={e => setReviewForm({...reviewForm, date: e.target.value})}
                    />
                  </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Performance Rating</label>
                 <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(rating => (
                        <button
                            key={rating}
                            type="button"
                            onClick={() => setReviewForm({...reviewForm, rating})}
                            className={`flex-1 py-2 rounded-xl text-lg font-bold transition-all ${
                                reviewForm.rating >= rating 
                                    ? 'bg-amber-400 text-white shadow-md shadow-amber-400/30' 
                                    : 'bg-slate-100 text-slate-300'
                            }`}
                        >
                            ★
                        </button>
                    ))}
                 </div>
                 <div className="text-center text-xs text-slate-400 mt-1 font-bold">
                     {reviewForm.rating === 5 ? 'Outstanding' : reviewForm.rating === 4 ? 'Exceeds Expectations' : reviewForm.rating === 3 ? 'Meets Expectations' : reviewForm.rating === 2 ? 'Needs Improvement' : 'Unsatisfactory'}
                 </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feedback / Comments</label>
                <textarea 
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                    placeholder="Describe strengths and areas for improvement..."
                    value={reviewForm.feedback}
                    onChange={e => setReviewForm({...reviewForm, feedback: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Goals for Next Period</label>
                <textarea 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                    placeholder="Specific, Measurable, Achievable, Relevant, Time-bound..."
                    value={reviewForm.goals}
                    onChange={e => setReviewForm({...reviewForm, goals: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reviewer Name</label>
                <input 
                    type="text"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={reviewForm.reviewer}
                    onChange={e => setReviewForm({...reviewForm, reviewer: e.target.value})}
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg mt-2 transition-all"
              >
                Save Evaluation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <h3 className="text-xl font-bold text-slate-800">Submit Leave Request</h3>
              <button onClick={() => setIsLeaveModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleRequestLeave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee</label>
                <select 
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={leaveForm.employeeId}
                    onChange={e => setLeaveForm({...leaveForm, employeeId: e.target.value})}
                >
                    <option value="">-- Select --</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Leave Type</label>
                    <select 
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={leaveForm.type}
                        onChange={e => setLeaveForm({...leaveForm, type: e.target.value as any})}
                    >
                        <option value="SICK">Sick Leave</option>
                        <option value="VACATION">Vacation</option>
                        <option value="PERSONAL">Personal</option>
                        <option value="MATERNITY">Maternity</option>
                        <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                    <input 
                        required
                        type="date"
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={leaveForm.startDate}
                        onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})}
                    />
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                <input 
                    required
                    type="date"
                    min={leaveForm.startDate}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason</label>
                <textarea 
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                    placeholder="Briefly describe the reason..."
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg mt-2 transition-all"
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Run Payroll Modal */}
      {isPayrollModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 Run Monthly Payroll
               </h3>
               <button onClick={() => setIsPayrollModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <div className="p-6">
                <div className="mb-4">
                    <p className="text-sm text-slate-500 mb-2">Review payout breakdown (Auto-calculated Tax).</p>
                    <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Employee</th>
                                    <th className="px-4 py-2 text-right">Gross</th>
                                    <th className="px-4 py-2 text-right">Tax (Calculated)</th>
                                    <th className="px-4 py-2 text-right">Net Pay</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm">
                                {payrollPreview.map(emp => (
                                    <tr key={emp.id}>
                                        <td className="px-4 py-2">
                                            <div className="font-bold text-slate-700">{emp.name}</div>
                                            <div className="text-[10px] text-slate-400">{emp.role}</div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-slate-500">
                                            ${emp.salary.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-red-500">
                                            -${emp.calculatedTax.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-emerald-700 font-bold">
                                            ${emp.netPay.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {payrollPreview.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-4 text-center text-slate-400 italic">No employees available for payroll.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-3 gap-4 mb-6 text-center">
                    <div>
                         <span className="text-xs font-bold text-slate-400 uppercase">Total Gross</span>
                         <div className="text-lg font-bold text-slate-600">${totalRunGross.toLocaleString()}</div>
                    </div>
                    <div>
                         <span className="text-xs font-bold text-slate-400 uppercase">Total Tax Withheld</span>
                         <div className="text-lg font-bold text-red-500">${totalRunTax.toLocaleString()}</div>
                    </div>
                    <div>
                         <span className="text-xs font-bold text-slate-400 uppercase">Total Net Payout</span>
                         <div className="text-2xl font-bold text-emerald-600">${totalRunNet.toLocaleString()}</div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsPayrollModalOpen(false)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleRunPayroll}
                        disabled={payrollPreview.length === 0}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all"
                    >
                        Confirm Payout & Deduct
                    </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRManagement;
