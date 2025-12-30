
import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import StatCard from '../components/StatCard';
import { PERFORMANCE_DATA } from '../constants';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, flocks, items, salesRecords, healthRecords } = useInventory();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'TASKS' | 'ACTIVITIES'>('TASKS');

  // KPI Calculations
  const activeFlocksCount = flocks.filter(f => f.status === 'ACTIVE').length;
  const totalBirds = flocks.reduce((acc, f) => acc + f.currentCount, 0);
  const feedStock = items.filter(i => i.category === 'FEED').reduce((acc, i) => acc + i.quantity, 0);
  const revenue = salesRecords.filter(s => s.status === 'PAID').reduce((acc, s) => acc + s.totalAmount, 0);
  
  // Role Access Checks
  const showFinancials = [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT].includes(role as UserRole);
  const showOperations = [UserRole.ADMIN, UserRole.MANAGER, UserRole.VETERINARIAN, UserRole.FARM_WORKER].includes(role as UserRole);
  const showHealth = [UserRole.ADMIN, UserRole.MANAGER, UserRole.VETERINARIAN].includes(role as UserRole);

  const eggProduction = '---'; 
  const mortalityRate = '---%';

  // Build KPIs based on Role
  const kpis = [];

  if (showOperations) {
    kpis.push({ label: 'Active Flocks', value: activeFlocksCount, icon: '🏠', color: 'bg-blue-500', trend: { value: 0, positive: true }, path: '/flock' });
    kpis.push({ label: 'Total Birds', value: totalBirds.toLocaleString(), icon: '🐔', color: 'bg-teal-500', trend: { value: 0, positive: true }, path: '/flock' });
  }

  if (role !== UserRole.ACCOUNTANT) {
     kpis.push({ label: 'Egg Production', value: eggProduction, icon: '🥚', color: 'bg-amber-500', trend: { value: 0, positive: true }, path: '/production' });
  }

  if (showOperations) {
    kpis.push({ label: 'Feed Stock', value: `${feedStock} Bags`, icon: '🌾', color: 'bg-indigo-500', trend: { value: 0, positive: false }, path: '/feed' });
  }

  if (showHealth) {
    kpis.push({ label: 'Mortality Rate', value: mortalityRate, icon: '📉', color: 'bg-red-500', trend: { value: 0, positive: false }, path: '/health' });
  }

  if (showFinancials) {
    kpis.push({ label: 'Revenue', value: `$${revenue.toLocaleString()}`, icon: '💰', color: 'bg-emerald-500', trend: { value: 0, positive: true }, path: '/finance' });
  }

  // Filter tasks to show only active ones
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED').slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* 1. KPI Cards */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${kpis.length > 4 ? 'xl:grid-cols-6' : 'xl:grid-cols-4'} gap-4`}>
        {kpis.map((kpi, idx) => (
          <StatCard 
            key={idx} 
            {...kpi} 
            onClick={() => navigate(kpi.path)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column (Main Content) */}
        <div className="xl:col-span-2 space-y-6">
            
            {/* 2. Production Overview - Hidden for Accountant */}
            {role !== UserRole.ACCOUNTANT && (
                <div 
                    onClick={() => navigate('/production')}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all group"
                >
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-teal-700 transition-colors">Egg Production</h3>
                            <p className="text-xs text-slate-400">Egg production & weight gain trends</p>
                        </div>
                        <select 
                            onClick={(e) => e.stopPropagation()} 
                            className="bg-slate-50 border-none rounded-lg text-sm font-medium px-3 py-1 outline-none text-slate-600"
                        >
                            <option>Last 30 Days</option>
                            <option>Last 7 Days</option>
                        </select>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={PERFORMANCE_DATA}>
                                <defs>
                                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                <Area type="monotone" dataKey="production" stroke="#0f766e" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 3. Active Flocks View - Ops Only */}
                {showOperations && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Active Flocks</h3>
                            <button onClick={() => navigate('/flock')} className="text-teal-600 text-xs font-bold hover:underline uppercase tracking-wider">View All</button>
                        </div>
                        <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[300px]">
                            {flocks.filter(f => f.status === 'ACTIVE').slice(0, 3).map(flock => (
                                <div key={flock.id} onClick={() => navigate(`/flock/${flock.id}`)} className="p-4 rounded-2xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/10 transition-all cursor-pointer group">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-slate-700">{flock.name}</span>
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${flock.type === 'BROILER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{flock.type}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Age: <strong className="text-slate-600">{flock.ageInDays} Days</strong></span>
                                        <span>Pop: <strong className="text-slate-600">{flock.currentCount.toLocaleString()}</strong></span>
                                    </div>
                                    <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full ${flock.type === 'BROILER' ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: '65%' }}></div>
                                    </div>
                                </div>
                            ))}
                            {flocks.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                    No flocks registered.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. Recent Sales - Financials Only */}
                {showFinancials && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Recent Sales</h3>
                            <button onClick={() => navigate('/sales')} className="text-teal-600 text-xs font-bold hover:underline uppercase tracking-wider">All Sales</button>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3">Customer</th>
                                        <th className="px-5 py-3">Amount</th>
                                        <th className="px-5 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {salesRecords.slice(0, 4).map(sale => (
                                        <tr key={sale.id} onClick={() => navigate('/sales')} className="hover:bg-slate-50/50 cursor-pointer">
                                            <td className="px-5 py-3">
                                                <div className="font-medium text-slate-700 truncate max-w-[100px]">{sale.customer}</div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-[100px]">{sale.item}</div>
                                            </td>
                                            <td className="px-5 py-3 font-bold text-slate-700">${sale.totalAmount.toLocaleString()}</td>
                                            <td className="px-5 py-3">
                                                <span className={`w-2 h-2 rounded-full inline-block mr-2 ${sale.status === 'PAID' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                            </td>
                                        </tr>
                                    ))}
                                    {salesRecords.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-5 py-8 text-center text-slate-400 italic text-xs">No sales recorded.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Right Column (Sidebar Widgets) */}
        <div className="space-y-6">
            
            {/* 5. Alert System */}
             <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-50 flex items-center justify-center sm:justify-between">
                     <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <h3 className="font-bold text-slate-800">System Alerts</h3>
                     </div>
                     <button onClick={() => navigate('/health')} className="hidden sm:block text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition-colors">Action Required</button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                     {showOperations && items.filter(i => i.quantity < i.minThreshold).map(item => (
                        <div key={item.id} onClick={() => navigate('/inventory')} className="p-4 border-b border-slate-50 hover:bg-red-50/30 transition-colors cursor-pointer group last:border-0">
                            <div className="flex gap-3 items-start">
                                <div className="mt-0.5 text-lg">⚠️</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-red-700">Low Stock: {item.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Only {item.quantity} {item.unit} remaining (Min: {item.minThreshold}).</p>
                                </div>
                            </div>
                        </div>
                     ))}
                     {healthRecords.filter(h => h.status !== 'RESOLVED').map(record => (
                        <div key={record.id} onClick={() => navigate('/health')} className="p-4 border-b border-slate-50 hover:bg-amber-50/30 transition-colors cursor-pointer group last:border-0">
                            <div className="flex gap-3 items-start">
                                <div className="mt-0.5 text-lg">🩺</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-amber-700">Health Issue: {record.diagnosis}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Flock {record.flockId} • Status: {record.status}</p>
                                </div>
                            </div>
                        </div>
                     ))}
                     {(items.filter(i => i.quantity < i.minThreshold).length === 0 || !showOperations) && healthRecords.filter(h => h.status !== 'RESOLVED').length === 0 && (
                         <div className="p-8 text-center text-slate-400 italic">
                             No critical alerts at this moment.
                         </div>
                     )}
                </div>
            </div>

            {/* 6. Today's Overview (Tasks/Activities) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
                <div className="flex border-b border-slate-100">
                    <button 
                        onClick={() => setActiveTab('TASKS')}
                        className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'TASKS' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        My Tasks
                    </button>
                    <button 
                        onClick={() => setActiveTab('ACTIVITIES')}
                        className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'ACTIVITIES' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        Activity Feed
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {activeTab === 'TASKS' ? (
                        activeTasks.length > 0 ? (
                            activeTasks.map((task) => (
                                <div 
                                    key={task.id} 
                                    onClick={() => navigate('/hr')}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-teal-200 transition-colors group cursor-pointer"
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'COMPLETED' ? 'bg-teal-500 border-teal-500' : task.status === 'IN_PROGRESS' ? 'border-blue-400 bg-blue-50' : 'border-slate-300 group-hover:border-teal-400'}`}>
                                        {task.status === 'COMPLETED' && <span className="text-white text-[10px] font-bold">✓</span>}
                                        {task.status === 'IN_PROGRESS' && <span className="text-blue-400 text-[8px]">●</span>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</p>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">Due: {task.due} • {task.assignee}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-slate-400 py-8 text-sm italic">
                                No active tasks. <br/> <span className="text-xs">Great job!</span>
                            </div>
                        )
                    ) : (
                        <div className="space-y-6 pt-2 pl-2">
                            {/* Static activity feed placeholder as real data isn't fully linked to an activity stream yet */}
                            <div className="text-center text-slate-400 py-8 text-sm italic">
                                Activity feed will populate as you use the app.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 7. Quick Actions - Dynamic based on Role */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/20">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center gap-2">⚡ Quick Actions</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {showOperations && (
                        <>
                            <button onClick={() => navigate('/flock')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex flex-col items-center gap-2 transition-all hover:-translate-y-0.5">
                                <span className="text-xl">📝</span>
                                <span className="text-xs font-bold">Daily Log</span>
                            </button>
                            <button onClick={() => navigate('/feed')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex flex-col items-center gap-2 transition-all hover:-translate-y-0.5">
                                <span className="text-xl">📦</span>
                                <span className="text-xs font-bold">Restock</span>
                            </button>
                        </>
                    )}
                    {showFinancials && (
                        <button onClick={() => navigate('/sales')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl flex flex-col items-center gap-2 transition-all hover:-translate-y-0.5">
                            <span className="text-xl">💸</span>
                            <span className="text-xs font-bold">New Sale</span>
                        </button>
                    )}
                    {showHealth && (
                        <button onClick={() => navigate('/health')} className="p-3 bg-gradient-to-br from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 rounded-xl flex flex-col items-center gap-2 transition-all hover:-translate-y-0.5 shadow-lg shadow-teal-900/50">
                            <span className="text-xl">🩺</span>
                            <span className="text-xs font-bold">Diagnose</span>
                        </button>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
