
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';

const COLORS = ['#0f766e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

const AnalyticsManagement: React.FC = () => {
  const { transactions, consumptionRecords, salesRecords, flocks, healthRecords } = useInventory();
  const [timeRange, setTimeRange] = useState<'30D' | '90D' | 'YTD'>('YTD');

  // --- Financial Aggregation (General) ---
  const financialData = useMemo(() => {
    const grouped: Record<string, { revenue: number; expense: number; profit: number }> = {};
    const sorted = [...transactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sorted.forEach(t => {
      if(t.status === 'CANCELLED') return;
      const month = t.date.slice(0, 7); 
      if (!grouped[month]) grouped[month] = { revenue: 0, expense: 0, profit: 0 };
      
      if (t.type === 'INCOME') {
        grouped[month].revenue += t.amount;
      } else {
        grouped[month].expense += t.amount;
      }
      grouped[month].profit = grouped[month].revenue - grouped[month].expense;
    });

    return Object.keys(grouped).map(month => ({ name: month, ...grouped[month] }));
  }, [transactions]);

  // --- Cost Breakdown ---
  const costStructure = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'EXPENSE' && t.status !== 'CANCELLED');
    const grouped: Record<string, number> = {};
    expenses.forEach(t => {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount;
    });
    return Object.keys(grouped).map(cat => ({ name: cat, value: grouped[cat] })).sort((a,b) => b.value - a.value);
  }, [transactions]);

  // --- Flock Profitability & ROI Calculation ---
  const flockProfitability = useMemo(() => {
      return flocks.map(flock => {
          // 1. Revenue: Linked Sales
          const revenue = salesRecords
            .filter(s => s.flockId === flock.id && s.status !== 'CANCELLED')
            .reduce((acc, s) => acc + s.totalAmount, 0);

          // 2. Direct Expenses
          // Feed
          const feedCost = consumptionRecords
            .filter(c => c.flockId === flock.id)
            .reduce((acc, c) => acc + c.cost, 0);
          
          // Health
          const healthCost = healthRecords
            .filter(h => h.flockId === flock.id && h.cost)
            .reduce((acc, h) => acc + (h.cost || 0), 0);

          // Other Transactions (e.g. Livestock purchase, specific maintenance)
          const otherCost = transactions
            .filter(t => t.referenceId === flock.id && t.type === 'EXPENSE' && t.status !== 'CANCELLED')
            .reduce((acc, t) => acc + t.amount, 0);

          const totalCost = feedCost + healthCost + otherCost;
          const profit = revenue - totalCost;
          const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

          return {
              name: flock.name,
              revenue,
              cost: totalCost,
              profit,
              roi
          };
      }).sort((a,b) => b.revenue - a.revenue); // Sort by highest revenue
  }, [flocks, salesRecords, consumptionRecords, transactions, healthRecords]);

  // --- Predictive Modeling ---
  const projections = useMemo(() => {
      const activeBroilers = flocks.filter(f => f.type === 'BROILER' && f.status === 'ACTIVE');
      return activeBroilers.map(flock => {
          const targetWeight = 2.2; 
          const pricePerKg = 3.5; 
          const daysToHarvest = Math.max(0, 42 - flock.ageInDays);
          const estRevenue = flock.currentCount * targetWeight * pricePerKg;
          return {
              flock: flock.name,
              daysLeft: daysToHarvest,
              projectedRevenue: estRevenue,
              completion: (flock.ageInDays / 42) * 100
          };
      });
  }, [flocks]);

  // KPIs
  const totalRevenue = financialData.reduce((acc, d) => acc + d.revenue, 0);
  const totalProfit = financialData.reduce((acc, d) => acc + d.profit, 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Deep Analytics</h2>
          <p className="text-slate-500 mt-1">Strategic insights, profitability analysis, and predictive modeling.</p>
        </div>
        <div className="bg-slate-100 p-1 rounded-xl flex">
            {['30D', '90D', 'YTD'].map(range => (
                <button
                    key={range}
                    onClick={() => setTimeRange(range as any)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${timeRange === range ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {range}
                </button>
            ))}
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Net Profit Margin" value={`${profitMargin.toFixed(1)}%`} icon="💹" color={profitMargin > 15 ? "bg-emerald-500" : "bg-amber-500"} trend={{value: 0, positive: true}} />
        <StatCard label="Pipeline Revenue" value={`$${projections.reduce((acc, p) => acc + p.projectedRevenue, 0).toLocaleString()}`} icon="🔮" color="bg-indigo-500" />
        <StatCard label="Avg Flock ROI" value={`${(flockProfitability.reduce((acc, f) => acc + f.roi, 0) / (flockProfitability.length || 1)).toFixed(1)}%`} icon="📊" color="bg-blue-500" />
        <StatCard label="OpEx Ratio" value={`${((1 - (profitMargin/100)) * 100).toFixed(1)}%`} icon="📉" color="bg-orange-500" />
      </div>

      {/* Flock Profitability Matrix */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
              <div>
                  <h3 className="text-lg font-bold text-slate-800">Flock Profitability Matrix</h3>
                  <p className="text-xs text-slate-400">Attributed Revenue vs Direct Costs (Feed, Meds, Stock)</p>
              </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Chart */}
              <div className="lg:col-span-2 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={flockProfitability} barGap={0} barSize={32}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(val) => `$${val/1000}k`} />
                          <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                            formatter={(val: number) => `$${val.toLocaleString()}`}
                          />
                          <Legend />
                          <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="cost" name="Total Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
              
              {/* Leaderboard Table */}
              <div className="overflow-y-auto max-h-80 pr-2">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0">
                          <tr>
                              <th className="py-3 pl-3 rounded-l-lg">Flock</th>
                              <th className="py-3 text-right">Profit</th>
                              <th className="py-3 pr-3 text-right rounded-r-lg">ROI</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {flockProfitability.map(item => (
                              <tr key={item.name}>
                                  <td className="py-3 pl-3 font-medium text-slate-700">{item.name}</td>
                                  <td className={`py-3 text-right font-bold ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      ${item.profit.toLocaleString()}
                                  </td>
                                  <td className="py-3 pr-3 text-right">
                                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${item.roi >= 20 ? 'bg-emerald-100 text-emerald-700' : item.roi >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                          {item.roi.toFixed(0)}%
                                      </span>
                                  </td>
                              </tr>
                          ))}
                          {flockProfitability.length === 0 && (
                              <tr><td colSpan={3} className="py-8 text-center text-slate-400 italic">No flock data for analysis.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Financial Trend Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">Overall Cash Flow</h3>
                      <p className="text-xs text-slate-400">Monthly Revenue vs. Direct Costs</p>
                  </div>
              </div>
              <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={financialData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(val) => `$${val/1000}k`} />
                          <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                            formatter={(val: number) => `$${val.toLocaleString()}`}
                          />
                          <Bar dataKey="revenue" name="Revenue" barSize={20} fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" name="Expenses" barSize={20} fill="#ef4444" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#0f766e" strokeWidth={3} dot={{r: 4}} />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Cost Allocation Donut */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Cost Centers</h3>
              <p className="text-xs text-slate-400 mb-6">Distribution of operational expenses</p>
              <div className="h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={costStructure}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                          >
                              {costStructure.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                      </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                          <span className="text-xs text-slate-400 block">Total OpEx</span>
                          <span className="text-lg font-bold text-slate-800">
                              ${costStructure.reduce((acc, c) => acc + c.value, 0).toLocaleString()}
                          </span>
                      </div>
                  </div>
              </div>
              <div className="mt-4 space-y-2">
                  {costStructure.slice(0, 4).map((item, idx) => (
                      <div key={item.name} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></span>
                              <span className="text-slate-600 capitalize">{item.name.toLowerCase()}</span>
                          </div>
                          <span className="font-bold text-slate-800">${item.value.toLocaleString()}</span>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};

export default AnalyticsManagement;
