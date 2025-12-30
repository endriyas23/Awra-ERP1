
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, ReferenceLine } from 'recharts';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';
import { FinancialTransaction, TransactionType } from '../types';

const COLORS = {
  INCOME: '#10b981',
  EXPENSE: '#ef4444',
  PIE: ['#0f766e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'],
  COSTS: {
      FEED: '#f59e0b',
      OPS: '#0f766e',
      HEALTH: '#6366f1'
  }
};

const FinanceManagement: React.FC = () => {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, consumptionRecords, items, salesRecords, flocks, healthRecords } = useInventory();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'REPORTS' | 'LEDGER' | 'TAX' | 'COST_ANALYSIS'>('OVERVIEW');
  
  // Date Range State
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1st of current year
    end: new Date().toISOString().split('T')[0] // Today
  });

  // Form State
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    baseAmount: '', 
    vatAmount: '',
    withholdingAmount: '',
    type: 'EXPENSE' as TransactionType,
    category: 'OTHER',
    status: 'COMPLETED' as 'COMPLETED' | 'PENDING' | 'CANCELLED'
  });

  // --- Helpers ---
  const setDatePreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'LAST_30_DAYS') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'THIS_MONTH') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (preset === 'LAST_MONTH') {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (preset === 'THIS_YEAR') {
        start = new Date(today.getFullYear(), 0, 1);
        end = today;
    } else if (preset === 'LAST_30_DAYS') {
        start.setDate(today.getDate() - 30);
        end = today;
    }

    setDateRange({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    });
  };

  // --- Filtering ---
  
  const filteredTransactions = useMemo(() => {
      return transactions.filter(t => 
          t.status !== 'CANCELLED' && 
          t.date >= dateRange.start && 
          t.date <= dateRange.end
      );
  }, [transactions, dateRange]);

  // --- Financial Calculations (Period Specific) ---
  
  // 1. P&L Components
  const pnl = useMemo(() => {
      const revenue = filteredTransactions
          .filter(t => t.type === 'INCOME' && t.category === 'SALES')
          .reduce((acc, t) => acc + t.amount, 0);
      
      const otherIncome = filteredTransactions
          .filter(t => t.type === 'INCOME' && t.category !== 'SALES')
          .reduce((acc, t) => acc + t.amount, 0);

      // COGS: Direct costs (Feed, Medicine, Livestock purchases)
      const cogs = filteredTransactions
          .filter(t => t.type === 'EXPENSE' && ['FEED', 'MEDICINE', 'LIVESTOCK'].includes(t.category))
          .reduce((acc, t) => acc + t.amount, 0);

      // OpEx: Indirect costs (Labor, Utilities, Maintenance, Other)
      const opex = filteredTransactions
          .filter(t => t.type === 'EXPENSE' && !['FEED', 'MEDICINE', 'LIVESTOCK'].includes(t.category))
          .reduce((acc, t) => acc + t.amount, 0);

      const grossProfit = (revenue + otherIncome) - cogs;
      const netProfit = grossProfit - opex;
      const margin = (revenue + otherIncome) > 0 ? (netProfit / (revenue + otherIncome)) * 100 : 0;

      return { revenue, otherIncome, totalRevenue: revenue + otherIncome, cogs, opex, grossProfit, netProfit, margin };
  }, [filteredTransactions]);

  // Chart Data for P&L
  const pnlChartData = useMemo(() => [
    { name: 'Revenue', amount: pnl.totalRevenue, fill: '#10b981' },
    { name: 'COGS', amount: pnl.cogs, fill: '#f59e0b' },
    { name: 'Gross Profit', amount: pnl.grossProfit, fill: '#3b82f6' },
    { name: 'OpEx', amount: pnl.opex, fill: '#ef4444' },
    { name: 'Net Income', amount: pnl.netProfit, fill: pnl.netProfit >= 0 ? '#0f766e' : '#991b1b' },
  ], [pnl]);

  // 2. Balance Sheet Components (Snapshot / Cumulative)
  const balanceSheet = useMemo(() => {
      // Assets
      const inventoryValue = items.reduce((sum, i) => sum + (i.quantity * (i.pricePerUnit || 0)), 0);
      const receivables = salesRecords.filter(s => s.status === 'PENDING').reduce((sum, s) => sum + s.totalAmount, 0);
      
      // Cash on Hand (Cumulative of all COMPLETED transactions ever)
      const cashOnHand = transactions
          .filter(t => t.status === 'COMPLETED')
          .reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : -t.amount), 0);

      // Liabilities
      const payables = transactions.filter(t => t.status === 'PENDING').reduce((acc, t) => acc + t.amount, 0);
      
      // Net VAT Liability (Cumulative)
      const totalOutputVAT = transactions.filter(t => t.type === 'INCOME' && t.status !== 'CANCELLED').reduce((acc, t) => acc + (t.vatAmount || 0), 0);
      const totalInputVAT = transactions.filter(t => t.type === 'EXPENSE' && t.status !== 'CANCELLED').reduce((acc, t) => acc + (t.vatAmount || 0), 0);
      const taxPayable = Math.max(0, totalOutputVAT - totalInputVAT);

      return {
          assets: { inventoryValue, receivables, cashOnHand, total: inventoryValue + receivables + cashOnHand },
          liabilities: { payables, taxPayable, total: payables + taxPayable }
      };
  }, [items, salesRecords, transactions]);

  // Chart Data for Balance Sheet
  const balanceSheetChartData = useMemo(() => [
      { name: 'Cash', type: 'Asset', value: balanceSheet.assets.cashOnHand },
      { name: 'Inventory', type: 'Asset', value: balanceSheet.assets.inventoryValue },
      { name: 'Receivables', type: 'Asset', value: balanceSheet.assets.receivables },
      { name: 'Payables', type: 'Liability', value: balanceSheet.liabilities.payables },
      { name: 'Tax Due', type: 'Liability', value: balanceSheet.liabilities.taxPayable },
  ], [balanceSheet]);

  // 3. Tax Report Data (Period)
  const taxData = useMemo(() => {
      const output = filteredTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (t.vatAmount || 0), 0);
      const input = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (t.vatAmount || 0), 0);
      const whtPayable = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (t.withholdingAmount || 0), 0);
      const whtReceivable = filteredTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (t.withholdingAmount || 0), 0);
      
      return { output, input, net: output - input, whtPayable, whtReceivable };
  }, [filteredTransactions]);

  // 4. Trend Data for Chart
  const trendData = useMemo(() => {
    const grouped: Record<string, { income: number; expense: number }> = {};
    const sorted = [...filteredTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(t => {
       const d = t.date.slice(5); // MM-DD 
       if (!grouped[d]) grouped[d] = { income: 0, expense: 0 };
       if (t.type === 'INCOME') grouped[d].income += t.amount;
       else grouped[d].expense += t.amount;
    });

    return Object.keys(grouped).map(date => ({
        date,
        income: grouped[date].income,
        expense: grouped[date].expense,
        profit: grouped[date].income - grouped[date].expense
    }));
  }, [filteredTransactions]);

  // 5. Cost Breakdown Chart
  const expenseBreakdown = useMemo(() => {
     const grouped: Record<string, number> = {};
     filteredTransactions.filter(t => t.type === 'EXPENSE').forEach(t => {
         grouped[t.category] = (grouped[t.category] || 0) + t.amount;
     });
     return Object.keys(grouped).map(cat => ({ name: cat, value: grouped[cat] })).sort((a,b) => b.value - a.value);
  }, [filteredTransactions]);

  // 6. Flock Cost Analysis (Cumulative, strictly flock related)
  const flockCostAnalysis = useMemo(() => {
    const flockIds = new Set<string>();
    flocks.forEach(f => flockIds.add(f.id));
    
    return Array.from(flockIds).map(id => {
        const flock = flocks.find(f => f.id === id);
        const name = flock ? flock.name : `Flock ${id}`;
        
        const feedCost = consumptionRecords
            .filter(c => c.flockId === id)
            .reduce((sum, c) => sum + c.cost, 0);

        const transCost = transactions
            .filter(t => t.type === 'EXPENSE' && t.referenceId === id && t.status !== 'CANCELLED')
            .reduce((sum, t) => sum + t.amount, 0);

        const healthCost = healthRecords
            .filter(h => h.flockId === id && h.cost)
            .reduce((sum, h) => sum + (h.cost || 0), 0);

        return { id, name, feedCost, transCost, healthCost, total: feedCost + transCost + healthCost };
    }).sort((a,b) => b.total - a.total);
  }, [consumptionRecords, transactions, flocks, healthRecords]);


  // --- Handlers ---

  const handleOpenModal = (transaction?: FinancialTransaction) => {
    if (transaction) {
      setEditingId(transaction.id);
      setForm({
        date: transaction.date,
        description: transaction.description,
        baseAmount: (transaction.amount - (transaction.vatAmount || 0) + (transaction.withholdingAmount || 0)).toString(),
        vatAmount: (transaction.vatAmount || '').toString(),
        withholdingAmount: (transaction.withholdingAmount || '').toString(),
        type: transaction.type,
        category: transaction.category,
        status: transaction.status
      });
    } else {
      setEditingId(null);
      setForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        baseAmount: '',
        vatAmount: '',
        withholdingAmount: '',
        type: 'EXPENSE',
        category: 'OTHER',
        status: 'COMPLETED'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.baseAmount) return;

    const base = parseFloat(form.baseAmount) || 0;
    const vat = parseFloat(form.vatAmount) || 0;
    const wht = parseFloat(form.withholdingAmount) || 0;
    const cashFlowAmount = base + vat - wht;

    if (editingId) {
      updateTransaction(editingId, {
        date: form.date,
        description: form.description,
        amount: cashFlowAmount,
        vatAmount: vat > 0 ? vat : undefined,
        withholdingAmount: wht > 0 ? wht : undefined,
        type: form.type,
        category: form.category as any,
        status: form.status
      });
    } else {
      const newTransaction: FinancialTransaction = {
          id: `T-${Date.now()}`,
          date: form.date,
          description: form.description,
          amount: cashFlowAmount,
          vatAmount: vat > 0 ? vat : undefined,
          withholdingAmount: wht > 0 ? wht : undefined,
          type: form.type,
          category: form.category as any,
          status: form.status
      };
      addTransaction(newTransaction);
    }
    
    setIsModalOpen(false);
  };

  const handleToggleStatus = (e: React.MouseEvent, id: string, currentStatus: string) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'PENDING' ? 'COMPLETED' : 'PENDING';
    updateTransaction(id, { status: newStatus });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); // CRITICAL: Stop row clicks or other events
      e.preventDefault();
      if(window.confirm("Are you sure you want to delete this transaction entry? This will affect your financial reports.")) {
          deleteTransaction(id);
      }
  };

  const previewCashFlow = () => {
      const base = parseFloat(form.baseAmount) || 0;
      const vat = parseFloat(form.vatAmount) || 0;
      const wht = parseFloat(form.withholdingAmount) || 0;
      return base + vat - wht;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header with Date Picker */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Financial Management</h2>
          <p className="text-slate-500 mt-1">Track income, expenses, profit margins, and tax obligations.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
            {/* Presets */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setDatePreset('THIS_MONTH')} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg">Month</button>
                <button onClick={() => setDatePreset('LAST_30_DAYS')} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg">30d</button>
                <button onClick={() => setDatePreset('THIS_YEAR')} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg">YTD</button>
            </div>

            {/* Date Range Picker */}
            <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">From</span>
                    <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                        className="text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                    />
                </div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">To</span>
                    <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                        className="text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                    />
                </div>
            </div>

            <button 
                onClick={() => handleOpenModal()}
                className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
                <span>➕</span> New Transaction
            </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-white p-1 rounded-xl w-full md:w-fit border border-slate-100 shadow-sm overflow-x-auto">
            {(['OVERVIEW', 'REPORTS', 'LEDGER', 'TAX', 'COST_ANALYSIS'] as const).map(tab => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                {tab === 'REPORTS' ? 'P&L / Balance Sheet' : tab.replace('_', ' ')}
                </button>
            ))}
      </div>

      {/* --- DASHBOARD / OVERVIEW --- */}
      {activeTab === 'OVERVIEW' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    label="Total Revenue" 
                    value={`$${pnl.totalRevenue.toLocaleString()}`} 
                    icon="💰" 
                    color="bg-emerald-500" 
                />
                <StatCard 
                    label="Total Expenses" 
                    value={`$${(pnl.cogs + pnl.opex).toLocaleString()}`} 
                    icon="💸" 
                    color="bg-red-500" 
                />
                <StatCard 
                    label="Net Profit" 
                    value={`$${pnl.netProfit.toLocaleString()}`} 
                    icon="📈" 
                    color={pnl.netProfit >= 0 ? "bg-blue-500" : "bg-orange-500"} 
                />
                <StatCard 
                    label="Profit Margin" 
                    value={`${pnl.margin.toFixed(1)}%`} 
                    icon="📊" 
                    color="bg-indigo-500" 
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Cash Flow Chart */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Cash Flow Trends</h3>
                        <div className="flex gap-2 text-xs font-bold">
                            <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Income</span>
                            <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-500"></span> Expense</span>
                        </div>
                        </div>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInc)" />
                                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                            </AreaChart>
                            </ResponsiveContainer>
                        </div>
                  </div>

                  {/* Expense Breakdown Pie */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Expense Distribution</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={expenseBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {expenseBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS.PIE[index % COLORS.PIE.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`}/>
                            </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                            {expenseBreakdown.slice(0, 5).map((entry, index) => (
                                <div key={index} className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS.PIE[index % COLORS.PIE.length]}}></span>
                                    {entry.name}
                                </div>
                            ))}
                        </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- REPORTS (P&L, BALANCE SHEET) --- */}
      {activeTab === 'REPORTS' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
              
              {/* Income Statement Section */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
                      <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                          <h3 className="text-lg font-bold text-slate-800">Income Statement (P&L)</h3>
                          <span className="text-xs text-slate-400 font-medium">{dateRange.start} to {dateRange.end}</span>
                      </div>
                      <div className="p-6 flex-1">
                          <table className="w-full text-sm">
                              <tbody>
                                  <tr className="border-b border-slate-100"><td colSpan={2} className="py-2 font-bold text-emerald-700 uppercase text-xs tracking-wider">Revenue</td></tr>
                                  <tr><td className="py-2 pl-4 text-slate-600">Sales Revenue</td><td className="py-2 text-right font-medium">${pnl.revenue.toLocaleString()}</td></tr>
                                  <tr><td className="py-2 pl-4 text-slate-600">Other Income</td><td className="py-2 text-right font-medium">${pnl.otherIncome.toLocaleString()}</td></tr>
                                  <tr className="bg-emerald-50/50 font-bold"><td className="py-2 pl-4">Total Revenue</td><td className="py-2 text-right text-emerald-700">${pnl.totalRevenue.toLocaleString()}</td></tr>
                                  
                                  <tr><td colSpan={2} className="py-3 font-bold text-amber-700 uppercase text-xs tracking-wider">Direct Costs (COGS)</td></tr>
                                  <tr><td className="py-2 pl-4 text-slate-600">Feed, Meds & Stock</td><td className="py-2 text-right font-medium">(${pnl.cogs.toLocaleString()})</td></tr>
                                  
                                  <tr className="bg-slate-50 font-bold text-slate-800 border-t border-b border-slate-200"><td className="py-3 pl-4">Gross Profit</td><td className="py-3 text-right">${pnl.grossProfit.toLocaleString()}</td></tr>

                                  <tr><td colSpan={2} className="py-3 font-bold text-red-700 uppercase text-xs tracking-wider">Operating Expenses (OpEx)</td></tr>
                                  <tr><td className="py-2 pl-4 text-slate-600">Overhead & Labor</td><td className="py-2 text-right font-medium">(${pnl.opex.toLocaleString()})</td></tr>

                                  <tr className={`font-bold text-lg border-t-2 border-slate-200 ${pnl.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                      <td className="py-4 pl-4">Net Income</td>
                                      <td className="py-4 text-right">${pnl.netProfit.toLocaleString()}</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* P&L Visualization */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col">
                      <h3 className="text-lg font-bold text-slate-800 mb-6">Financial Performance Visualization</h3>
                      <div className="flex-1 min-h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={pnlChartData} barSize={60}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `$${val/1000}k`} />
                                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} formatter={(val: number) => `$${val.toLocaleString()}`} />
                                  <ReferenceLine y={0} stroke="#cbd5e1" />
                                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                    {pnlChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>

              {/* Balance Sheet Section */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Balance Sheet Snapshot */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-full">
                      <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-blue-50/30">
                          <h3 className="text-lg font-bold text-slate-800">Balance Sheet (Snapshot)</h3>
                          <span className="text-xs text-slate-400 font-medium">As of Today</span>
                      </div>
                      <div className="p-6 grid grid-cols-2 gap-8">
                          {/* Assets */}
                          <div>
                              <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 border-b border-blue-100 pb-1">Assets</h4>
                              <div className="space-y-2 text-sm">
                                  <div className="flex justify-between"><span className="text-slate-500">Cash on Hand</span> <span className="font-bold">${balanceSheet.assets.cashOnHand.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-500">Inventory Value</span> <span className="font-bold">${balanceSheet.assets.inventoryValue.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-500">Receivables</span> <span className="font-bold">${balanceSheet.assets.receivables.toLocaleString()}</span></div>
                                  <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-blue-700">
                                      <span>Total Assets</span>
                                      <span>${balanceSheet.assets.total.toLocaleString()}</span>
                                  </div>
                              </div>
                          </div>

                          {/* Liabilities */}
                          <div>
                              <h4 className="text-xs font-bold text-red-600 uppercase mb-3 border-b border-red-100 pb-1">Liabilities</h4>
                              <div className="space-y-2 text-sm">
                                  <div className="flex justify-between"><span className="text-slate-500">Accounts Payable</span> <span className="font-bold">${balanceSheet.liabilities.payables.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-500">Tax Payable</span> <span className="font-bold">${balanceSheet.liabilities.taxPayable.toLocaleString()}</span></div>
                                  <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-red-700">
                                      <span>Total Liabilities</span>
                                      <span>${balanceSheet.liabilities.total.toLocaleString()}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Owner's Equity</p>
                          <p className="text-xl font-bold text-slate-800">${(balanceSheet.assets.total - balanceSheet.liabilities.total).toLocaleString()}</p>
                      </div>
                  </div>

                  {/* Balance Sheet Visualization */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col">
                      <h3 className="text-lg font-bold text-slate-800 mb-6">Assets vs Liabilities Composition</h3>
                      <div className="flex-1 min-h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={balanceSheetChartData} layout="vertical" margin={{left: 20}}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                  <XAxis type="number" hide />
                                  <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fill: '#64748b'}} />
                                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} formatter={(val: number) => `$${val.toLocaleString()}`} />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {balanceSheetChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.type === 'Asset' ? '#3b82f6' : '#ef4444'} />
                                    ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- LEDGER (Transactions Table) --- */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
             <div className="p-6 border-b border-slate-50">
                <h3 className="font-bold text-slate-800">Transaction Ledger</h3>
                <p className="text-xs text-slate-400">Showing {filteredTransactions.length} records from {dateRange.start} to {dateRange.end}</p>
             </div>
             
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Tax / WHT</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                        {filteredTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4 font-mono text-slate-500">{t.date}</td>
                                <td className="px-6 py-4 font-medium text-slate-800">
                                    {t.description}
                                    {t.referenceId && <span className="text-[10px] text-teal-600 block">Ref: {t.referenceId}</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase">{t.category}</span>
                                </td>
                                <td className="px-6 py-4 font-bold text-[10px] uppercase tracking-wider">
                                    <span className={t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}>{t.type}</span>
                                </td>
                                <td className={`px-6 py-4 font-bold ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {t.type === 'INCOME' ? '+' : '-'}${t.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </td>
                                <td className="px-6 py-4">
                                    {(t.vatAmount || t.withholdingAmount) ? (
                                        <div className="text-[10px] text-slate-500">
                                            {t.vatAmount && <div>VAT: ${t.vatAmount}</div>}
                                            {t.withholdingAmount && <div className="text-red-400">WHT: ${t.withholdingAmount}</div>}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 text-xs">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                        t.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 
                                        t.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right relative z-10">
                                    <div className="flex justify-end gap-2">
                                        {(t.status === 'PENDING' || t.status === 'COMPLETED') && (
                                            <button 
                                                onClick={(e) => handleToggleStatus(e, t.id, t.status)}
                                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${t.status === 'PENDING' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                                                title={t.status === 'PENDING' ? "Mark Paid" : "Mark Pending"}
                                            >
                                                {t.status === 'PENDING' ? '✓' : '↺'}
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(t); }}
                                            className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg hover:bg-teal-100 hover:text-teal-600 transition-colors"
                                            title="Edit"
                                        >
                                            ✎
                                        </button>
                                        <button 
                                            onClick={(e) => handleDelete(e, t.id)} 
                                            className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"
                                            title="Delete"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                            <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">No transactions found in this period.</td></tr>
                        )}
                    </tbody>
                 </table>
             </div>
          </div>
      )}

      {/* --- TAX REPORT VIEW --- */}
      {activeTab === 'TAX' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="Net VAT Payable" value={`$${Math.max(0, taxData.net).toLocaleString()}`} icon="🏛️" color={taxData.net > 0 ? "bg-red-500" : "bg-emerald-500"} />
                <StatCard label="Output VAT" value={`$${taxData.output.toLocaleString()}`} icon="📥" color="bg-amber-500" />
                <StatCard label="Input VAT" value={`$${taxData.input.toLocaleString()}`} icon="📤" color="bg-blue-500" />
                <StatCard label="WHT Credit" value={`$${taxData.whtReceivable.toLocaleString()}`} icon="🧾" color="bg-teal-500" />
              </div>
              
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                  <h3 className="text-xl font-bold mb-6">Tax Summary ({dateRange.start} to {dateRange.end})</h3>
                  <div className="space-y-4 max-w-lg">
                      <div className="flex justify-between border-b border-slate-700 pb-3">
                          <span className="text-slate-400">Total VAT Collected (Sales)</span>
                          <span className="font-bold">${taxData.output.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-700 pb-3">
                          <span className="text-slate-400">Less: VAT Paid (Expenses)</span>
                          <span className="text-emerald-400">(${taxData.input.toFixed(2)})</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-700 pb-3 pt-2">
                          <span className="font-bold text-lg">Net VAT Position</span>
                          <span className={`font-bold text-lg ${taxData.net > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              ${Math.abs(taxData.net).toFixed(2)} {taxData.net < 0 ? '(Credit)' : '(Payable)'}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- COST ANALYSIS VIEW --- */}
      {activeTab === 'COST_ANALYSIS' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-800">Cost per Flock Allocation</h3>
                      <div className="flex gap-4 text-xs font-bold">
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#f59e0b]"></span> Feed</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#0f766e]"></span> Operations</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#6366f1]"></span> Health</span>
                      </div>
                  </div>
                  <div className="h-80">
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={flockCostAnalysis} layout="vertical" barSize={32} margin={{left: 40}}>
                             <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                             <XAxis type="number" tick={{fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                             <YAxis dataKey="name" type="category" tick={{fontSize: 11, fontWeight: 600}} width={100} />
                             <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px'}} formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                             <Legend />
                             <Bar dataKey="feedCost" name="Feed" stackId="a" fill={COLORS.COSTS.FEED} />
                             <Bar dataKey="transCost" name="Ops/Livestock" stackId="a" fill={COLORS.COSTS.OPS} />
                             <Bar dataKey="healthCost" name="Health" stackId="a" fill={COLORS.COSTS.HEALTH} radius={[0, 4, 4, 0]} />
                         </BarChart>
                     </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {/* New/Edit Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">{editingId ? 'Edit Transaction' : 'New Transaction'}</h3>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
               
               <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button type="button" onClick={() => setForm({...form, type: 'INCOME'})} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.type === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Income</button>
                    <button type="button" onClick={() => setForm({...form, type: 'EXPENSE'})} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.type === 'EXPENSE' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>Expense</button>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                  <input required type="text" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. Weekly Farm Labor" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input required type="date" className="w-full p-3 rounded-xl border border-slate-200" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Base Amount ($)</label>
                    <input required type="number" min="0" step="0.01" className="w-full p-3 rounded-xl border border-slate-200" placeholder="Excl. Tax" value={form.baseAmount} onChange={e => setForm({...form, baseAmount: e.target.value})} />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">VAT Amount ($)</label>
                    <input type="number" min="0" step="0.01" className="w-full p-3 rounded-xl border border-slate-200" placeholder="Optional" value={form.vatAmount} onChange={e => setForm({...form, vatAmount: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Withholding ($)</label>
                    <input type="number" min="0" step="0.01" className="w-full p-3 rounded-xl border border-slate-200" placeholder="Optional" value={form.withholdingAmount} onChange={e => setForm({...form, withholdingAmount: e.target.value})} />
                  </div>
               </div>
               
               <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
                  <span className="text-xs text-slate-500 font-bold uppercase">Net Cash Flow</span>
                  <span className="text-lg font-bold text-slate-800">${previewCashFlow().toLocaleString()}</span>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                     <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                        <option value="SALES">Sales / Revenue</option>
                        <option value="FEED">Feed</option>
                        <option value="MEDICINE">Medicine</option>
                        <option value="LABOR">Labor / Wages</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="UTILITIES">Utilities</option>
                        <option value="LIVESTOCK">Livestock</option>
                        <option value="OTHER">Other</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                     <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={form.status} onChange={e => setForm({...form, status: e.target.value as any})}>
                        <option value="COMPLETED">Completed (Paid)</option>
                        <option value="PENDING">Pending (Unpaid)</option>
                        <option value="CANCELLED">Cancelled</option>
                     </select>
                  </div>
               </div>

               <button type="submit" className={`w-full py-3 text-white rounded-xl font-bold shadow-lg transition-all ${form.type === 'INCOME' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'}`}>
                 {editingId ? 'Update' : 'Record'} {form.type === 'INCOME' ? 'Income' : 'Expense'}
               </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceManagement;
