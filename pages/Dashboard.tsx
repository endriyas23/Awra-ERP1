
import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import StatCard from '../components/StatCard';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { UserRole, Flock } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, flocks, items, salesRecords, healthRecords, consumptionRecords, eggLogs, transactions } = useInventory();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'TASKS' | 'ACTIVITIES'>('ACTIVITIES');

  // --- Real-Time KPI Calculations ---
  
  // 1. Flock & Birds
  const activeFlocks = flocks.filter(f => f.status === 'ACTIVE');
  const activeFlocksCount = activeFlocks.length;
  const totalBirds = activeFlocks.reduce((acc, f) => acc + f.currentCount, 0);
  
  // 2. Mortality Rate (Cumulative for Active Flocks)
  const totalInitialBirds = activeFlocks.reduce((acc, f) => acc + f.initialCount, 0);
  const totalLostBirds = totalInitialBirds - totalBirds;
  const mortalityRateVal = totalInitialBirds > 0 ? (totalLostBirds / totalInitialBirds) * 100 : 0;
  const mortalityRate = `${mortalityRateVal.toFixed(1)}%`;

  // 3. Inventory (Feed)
  const feedStock = items.filter(i => i.category === 'FEED').reduce((acc, i) => acc + i.quantity, 0);
  
  // 4. Financials (Revenue)
  const revenue = salesRecords.filter(s => s.status === 'PAID').reduce((acc, s) => acc + s.totalAmount, 0);

  // 5. Egg Production (Today's Total)
  const todayStr = new Date().toISOString().split('T')[0];
  const eggsToday = eggLogs
    .filter(l => l.date === todayStr)
    .reduce((acc, l) => acc + l.totalGoodEggs, 0);
  const eggProductionDisplay = eggsToday.toLocaleString();

  // --- Chart Data: Production Trend (Last 7 Days) ---
  const productionChartData = useMemo(() => {
    const data = [];
    const today = new Date();
    // We want the chart to be consistent, so we generate dates for the last 7 days
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Aggregate logs for this date
        const dayLogs = eggLogs.filter(l => l.date === dateStr);
        const dayTotal = dayLogs.reduce((acc, l) => acc + l.totalGoodEggs, 0);
        
        data.push({
            date: dateStr.slice(5), // MM-DD
            production: dayTotal
        });
    }
    return data;
  }, [eggLogs]);
  
  // Role Access Checks
  const showFinancials = [UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT].includes(role as UserRole);
  const showOperations = [UserRole.ADMIN, UserRole.MANAGER, UserRole.VETERINARIAN, UserRole.FARM_WORKER].includes(role as UserRole);
  const showHealth = [UserRole.ADMIN, UserRole.MANAGER, UserRole.VETERINARIAN].includes(role as UserRole);

  // Build KPIs based on Role
  const kpis = [];

  if (showOperations) {
    kpis.push({ label: 'Active Flocks', value: activeFlocksCount, icon: '🏠', color: 'bg-blue-500', trend: { value: 0, positive: true }, path: '/flock' });
    kpis.push({ label: 'Total Birds', value: totalBirds.toLocaleString(), icon: '🐔', color: 'bg-teal-500', trend: { value: 0, positive: true }, path: '/flock' });
  }

  if (role !== UserRole.ACCOUNTANT) {
     kpis.push({ label: 'Eggs Collected (Today)', value: eggProductionDisplay, icon: '🥚', color: 'bg-amber-500', trend: { value: 0, positive: true }, path: '/production' });
  }

  if (showOperations) {
    kpis.push({ label: 'Feed Stock', value: `${feedStock} Bags`, icon: '🌾', color: 'bg-indigo-500', trend: { value: 0, positive: false }, path: '/feed' });
  }

  if (showHealth) {
    kpis.push({ label: 'Mortality Rate', value: mortalityRate, icon: '📉', color: parseFloat(mortalityRateVal.toFixed(1)) > 5 ? 'bg-red-500' : 'bg-emerald-500', trend: { value: 0, positive: false }, path: '/health' });
  }

  if (showFinancials) {
    kpis.push({ label: 'Revenue', value: `$${revenue.toLocaleString()}`, icon: '💰', color: 'bg-emerald-500', trend: { value: 0, positive: true }, path: '/finance' });
  }

  // Filter tasks to show only active ones
  const activeTasks = tasks.filter(t => t.status !== 'COMPLETED').slice(0, 5);

  // --- Activity Feed Logic ---
  const recentActivities = useMemo(() => {
    const activities: any[] = [];

    // Helper to try and extract timestamp from ID or use current time as fallback
    const getTime = (id: string, dateStr: string) => {
        // Try parsing ID for timestamp
        const parts = id.split('-');
        let timestamp = 0;
        for(const p of parts) {
            if(p.length >= 10 && !isNaN(Number(p))) {
                timestamp = Number(p);
                break;
            }
        }
        // If ID timestamp extraction failed, use the date string (start of day)
        if (timestamp === 0) {
            timestamp = new Date(dateStr).getTime();
        }
        return timestamp;
    };

    // 1. Sales
    if (showFinancials) {
        salesRecords.forEach(s => {
            activities.push({
                id: s.id,
                type: 'SALE',
                title: `New Sale: ${s.customer}`,
                desc: `${s.quantity}x ${s.item} ($${s.totalAmount.toLocaleString()})`,
                date: s.date,
                timestamp: getTime(s.id, s.date),
                icon: '💰',
                color: 'bg-emerald-100 text-emerald-600',
                path: '/sales'
            });
        });
    }

    // 2. Health
    if (showHealth) {
        healthRecords.forEach(h => {
            const flockName = flocks.find(f => f.id === h.flockId)?.name || h.flockId;
            activities.push({
                id: h.id,
                type: 'HEALTH',
                title: `${h.type === 'MORTALITY' ? 'Mortality' : h.diagnosis}`,
                desc: `${flockName} • ${h.status}`,
                date: h.date,
                timestamp: getTime(h.id, h.date),
                icon: h.type === 'MORTALITY' || h.type === 'OUTBREAK' ? '💀' : '🩺',
                color: h.type === 'MORTALITY' || h.type === 'OUTBREAK' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600',
                path: '/health'
            });
        });
    }

    // 3. Feed
    if (showOperations) {
        consumptionRecords.forEach(c => {
            const flockName = flocks.find(f => f.id === c.flockId)?.name || c.flockId;
            const item = items.find(i => i.id === c.feedItemId)?.name || 'Feed';
            activities.push({
                id: c.id,
                type: 'FEED',
                title: 'Feed Consumed',
                desc: `${c.quantity}kg ${item} • ${flockName}`,
                date: c.date,
                timestamp: getTime(c.id, c.date),
                icon: '🌾',
                color: 'bg-amber-100 text-amber-600',
                path: '/feed'
            });
        });
    }

    // 4. Eggs
    if (showOperations) {
        eggLogs.forEach(e => {
            const flockName = flocks.find(f => f.id === e.flockId)?.name || e.flockId;
            activities.push({
                id: e.id,
                type: 'EGG',
                title: 'Egg Collection',
                desc: `${e.totalGoodEggs} Collected • ${flockName}`,
                date: e.date,
                timestamp: getTime(e.id, e.date),
                icon: '🥚',
                color: 'bg-yellow-100 text-yellow-600',
                path: '/production'
            });
        });
    }

    // 5. Restocks (New)
    if (showOperations || showFinancials) {
        transactions.filter(t => t.type === 'EXPENSE' && (t.category === 'FEED' || t.category === 'MEDICINE' || t.category === 'LIVESTOCK')).forEach(t => {
             activities.push({
                 id: t.id,
                 type: 'RESTOCK',
                 title: `Stock Added: ${t.category}`,
                 desc: t.description,
                 date: t.date,
                 timestamp: getTime(t.id, t.date),
                 icon: '📦',
                 color: 'bg-indigo-100 text-indigo-600',
                 path: '/inventory'
             });
        });
    }

    // 6. New Flocks (New)
    if (showOperations) {
        flocks.forEach(f => {
            activities.push({
                id: f.id,
                type: 'FLOCK_NEW',
                title: 'New Flock Started',
                desc: `${f.name} (${f.initialCount} Birds)`,
                date: f.startDate,
                timestamp: getTime(f.id, f.startDate),
                icon: '🐣',
                color: 'bg-teal-100 text-teal-600',
                path: `/flock/${f.id}`
            });
        });
    }

    // Sort descending by time
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [salesRecords, healthRecords, consumptionRecords, eggLogs, flocks, items, showFinancials, showHealth, showOperations, transactions]);

  // --- Helpers for Enhanced Widgets ---
  const getCycleProgress = (flock: Flock) => {
    const target = flock.type === 'BROILER' ? 45 : 500; // days
    const pct = Math.min(100, (flock.ageInDays / target) * 100);
    return pct;
  };

  const getFlockHealthStatus = (flockId: string) => {
    const issues = healthRecords.filter(h => h.flockId === flockId && (h.status === 'PENDING' || h.status === 'SCHEDULED' || h.status === 'TREATED'));
    if (issues.some(i => i.type === 'OUTBREAK' || i.type === 'MORTALITY')) return { status: 'CRITICAL', color: 'bg-red-500', text: 'Critical' };
    if (issues.length > 0) return { status: 'WARNING', color: 'bg-amber-500', text: 'Attention' };
    return { status: 'GOOD', color: 'bg-emerald-500', text: 'Good' };
  };

  // --- New Dynamic Data Summaries ---

  // 1. Flock Health Breakdown
  const flockHealthStats = useMemo(() => {
    let good = 0, warning = 0, critical = 0;
    activeFlocks.forEach(f => {
      const status = getFlockHealthStatus(f.id).status;
      if (status === 'GOOD') good++;
      else if (status === 'WARNING') warning++;
      else critical++;
    });
    return [
      { name: 'Healthy', value: good, color: '#10b981' },
      { name: 'Warning', value: warning, color: '#f59e0b' },
      { name: 'Critical', value: critical, color: '#ef4444' }
    ].filter(s => s.value > 0);
  }, [activeFlocks, healthRecords]);

  // 2. Inventory Status Breakdown
  const inventoryStats = useMemo(() => {
    let inStock = 0, lowStock = 0, outOfStock = 0;
    items.forEach(i => {
      if (i.quantity === 0) outOfStock++;
      else if (i.quantity <= i.minThreshold) lowStock++;
      else inStock++;
    });
    return [
      { name: 'Good', value: inStock, color: '#3b82f6' },
      { name: 'Low', value: lowStock, color: '#f59e0b' },
      { name: 'Empty', value: outOfStock, color: '#ef4444' }
    ];
  }, [items]);

  // 3. Recent 5 Health Events (Dedicated List)
  const recentHealthEvents = healthRecords
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

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
                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-teal-700 transition-colors">Egg Production Trend</h3>
                            <p className="text-xs text-slate-400">Total collection over the last 7 days</p>
                        </div>
                        <div className="bg-slate-50 text-slate-600 text-xs font-bold px-3 py-1 rounded-lg">Last 7 Days</div>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={productionChartData}>
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

            {/* New Row: Health & Inventory Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Flock Health Overview */}
                {showHealth && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-slate-800">Flock Health Status</h3>
                            <button onClick={() => navigate('/health')} className="text-teal-600 text-xs font-bold hover:underline">Details</button>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            {flockHealthStats.length > 0 ? (
                                <div className="flex items-center gap-4 w-full">
                                    <div className="h-40 w-40 flex-shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={flockHealthStats}
                                                    innerRadius={40}
                                                    outerRadius={60}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {flockHealthStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-col gap-2 flex-1">
                                        {flockHealthStats.map((stat, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: stat.color}}></span>
                                                    <span className="text-slate-600 font-medium">{stat.name}</span>
                                                </div>
                                                <span className="font-bold text-slate-800">{stat.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm italic">No active flocks.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Inventory Status Overview */}
                {showOperations && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800">Inventory Health</h3>
                            <button onClick={() => navigate('/inventory')} className="text-teal-600 text-xs font-bold hover:underline">Manage</button>
                        </div>
                        <div className="flex-1 space-y-4">
                            {inventoryStats.map(stat => {
                                const totalItems = items.length || 1;
                                const pct = (stat.value / totalItems) * 100;
                                return (
                                    <div key={stat.name}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium text-slate-600">{stat.name} Stock</span>
                                            <span className="font-bold text-slate-800">{stat.value} items</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full transition-all duration-1000"
                                                style={{ width: `${pct}%`, backgroundColor: stat.color }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 3. Active Flocks View - Ops Only */}
                {showOperations && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Active Flocks Summary</h3>
                            <button onClick={() => navigate('/flock')} className="text-teal-600 text-xs font-bold hover:underline uppercase tracking-wider">View All</button>
                        </div>
                        <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
                            {activeFlocks.slice(0, 4).map(flock => {
                                const progress = getCycleProgress(flock);
                                const health = getFlockHealthStatus(flock.id);
                                return (
                                <div key={flock.id} onClick={() => navigate(`/flock/${flock.id}`)} className="p-4 rounded-2xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50/10 transition-all cursor-pointer group">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700">{flock.name}</span>
                                            <span className={`w-2 h-2 rounded-full ${health.color}`} title={`Health: ${health.text}`}></span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${flock.type === 'BROILER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{flock.type}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Age: <strong className="text-slate-600">{flock.ageInDays} Days</strong></span>
                                        <span>Pop: <strong className="text-slate-600">{flock.currentCount.toLocaleString()}</strong></span>
                                    </div>
                                    <div className="mt-3 relative w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${flock.type === 'BROILER' ? 'bg-amber-500' : 'bg-blue-500'}`} 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
                                        <span>Cycle Progress</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                </div>
                            )})}
                            {activeFlocks.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                    No active flocks.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. Recent Health Events (Dedicated) */}
                {showHealth && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Recent Diagnostics</h3>
                            <button onClick={() => navigate('/health')} className="text-teal-600 text-xs font-bold hover:underline uppercase tracking-wider">Log New</button>
                        </div>
                        <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
                            {recentHealthEvents.length > 0 ? recentHealthEvents.map(h => {
                                const flockName = flocks.find(f => f.id === h.flockId)?.name || h.flockId;
                                const isCritical = h.type === 'OUTBREAK' || h.type === 'MORTALITY';
                                return (
                                    <div key={h.id} className={`p-3 rounded-xl border flex gap-3 items-start ${isCritical ? 'border-red-100 bg-red-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${isCritical ? 'bg-red-100' : 'bg-blue-100'}`}>
                                            {h.type === 'MORTALITY' ? '💀' : h.type === 'VACCINATION' ? '💉' : '🩺'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-xs font-bold text-slate-800 truncate">{h.diagnosis}</p>
                                                <span className="text-[9px] font-bold text-slate-400">{h.date}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500">{flockName} • {h.status}</p>
                                        </div>
                                    </div>
                                )
                            }) : (
                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                    No recent health records.
                                </div>
                            )}
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
                        <h3 className="font-bold text-slate-800">Operational Alerts</h3>
                     </div>
                     <button onClick={() => navigate('/health')} className="hidden sm:block text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition-colors">Action Required</button>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                     {/* Inventory Alerts */}
                     {showOperations && items.filter(i => i.quantity < i.minThreshold).map(item => (
                        <div key={item.id} onClick={() => navigate('/inventory')} className="p-4 border-b border-slate-50 hover:bg-red-50/30 transition-colors cursor-pointer group last:border-0">
                            <div className="flex gap-3 items-start">
                                <div className="mt-0.5 w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">!</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 group-hover:text-red-700">Low Stock: {item.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Only {item.quantity} {item.unit} remaining (Min: {item.minThreshold}).</p>
                                </div>
                            </div>
                        </div>
                     ))}
                     
                     {/* Health Alerts */}
                     {healthRecords.filter(h => h.status !== 'RESOLVED' && h.status !== 'COMPLETED').map(record => {
                        const isCritical = record.type === 'OUTBREAK' || record.type === 'MORTALITY';
                        return (
                        <div key={record.id} onClick={() => navigate('/health')} className={`p-4 border-b border-slate-50 transition-colors cursor-pointer group last:border-0 ${isCritical ? 'hover:bg-red-50/30' : 'hover:bg-amber-50/30'}`}>
                            <div className="flex gap-3 items-start">
                                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isCritical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {isCritical ? '⚕️' : '🩺'}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${isCritical ? 'text-red-800' : 'text-slate-800'} group-hover:underline`}>{record.type === 'MORTALITY' ? 'High Mortality' : record.diagnosis}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Flock {record.flockId} • {record.status}</p>
                                </div>
                            </div>
                        </div>
                     )})}

                     {(items.filter(i => i.quantity < i.minThreshold).length === 0 || !showOperations) && healthRecords.filter(h => h.status !== 'RESOLVED' && h.status !== 'COMPLETED').length === 0 && (
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
                        onClick={() => setActiveTab('ACTIVITIES')}
                        className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'ACTIVITIES' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        Recent Activity
                    </button>
                    <button 
                        onClick={() => setActiveTab('TASKS')}
                        className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'TASKS' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/30' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        My Tasks
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-[350px]">
                    {activeTab === 'TASKS' ? (
                        activeTasks.length > 0 ? (
                            activeTasks.map((task) => (
                                <div 
                                    key={task.id} 
                                    onClick={() => navigate('/hr')}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-teal-200 transition-colors group cursor-pointer"
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'COMPLETED' ? 'bg-teal-50 border-teal-500' : task.status === 'IN_PROGRESS' ? 'border-blue-400 bg-blue-50' : 'border-slate-300 group-hover:border-teal-400'}`}>
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
                        recentActivities.length > 0 ? (
                            <div className="space-y-3">
                                {recentActivities.map((activity) => (
                                    <div 
                                        key={activity.id}
                                        onClick={() => navigate(activity.path)}
                                        className="flex gap-3 p-3 rounded-xl border border-slate-50 hover:bg-slate-50 transition-all cursor-pointer group"
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${activity.color}`}>
                                            {activity.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-slate-700 truncate">{activity.title}</p>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                    {activity.date === new Date().toISOString().split('T')[0] ? 'Today' : activity.date.slice(5)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">{activity.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 py-8 text-sm italic">
                                No recent activity found.
                            </div>
                        )
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
