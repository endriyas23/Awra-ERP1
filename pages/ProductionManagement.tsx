import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line, ComposedChart } from 'recharts';
import StatCard from '../components/StatCard';
import { EggCollectionLog } from '../types';
import { useInventory } from '../context/InventoryContext';

// Standard Layer Production Curve Model (Hy-Line / Cobb avg)
const getStandardProductionRate = (ageInWeeks: number) => {
    if (ageInWeeks < 19) return 0;
    if (ageInWeeks <= 21) return 0.05 + (ageInWeeks - 19) * 0.35; // Rapid onset (5% -> ~75%)
    if (ageInWeeks <= 25) return 0.75 + (ageInWeeks - 21) * 0.05; // Peak approach (75% -> 95%)
    if (ageInWeeks <= 40) return 0.95; // Peak plateau
    if (ageInWeeks <= 70) return 0.95 - ((ageInWeeks - 40) * 0.006); // Gradual decline to ~77%
    return Math.max(0.60, 0.77 - ((ageInWeeks - 70) * 0.008)); // Late stage decline
};

const ProductionManagement: React.FC = () => {
  const { items: inventoryItems, adjustStock, addItem, eggLogs, logEggCollection, updateEggLog, deleteEggLog, flocks, consumptionRecords, salesRecords } = useInventory();
  
  // States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY'>('OVERVIEW');

  // Form State
  const [form, setForm] = useState({
    flockId: '',
    date: new Date().toISOString().split('T')[0],
    timeOfDay: 'MORNING' as 'MORNING' | 'AFTERNOON' | 'EVENING',
    countLarge: '',
    countMedium: '',
    countSmall: '',
    damaged: '',
  });

  // Filters
  const layerFlocks = flocks.filter(f => f.type === 'LAYER' && f.status === 'ACTIVE');
  const produceItems = inventoryItems.filter(i => i.category === 'PRODUCE' && i.name.includes('Eggs'));
  const produceItemNames = produceItems.map(i => i.name);

  // --- KPI Calculations ---
  const today = new Date().toISOString().split('T')[0];
  const todaysLogs = eggLogs.filter(l => l.date === today);
  
  const totalEggsToday = todaysLogs.reduce((acc, l) => acc + l.totalGoodEggs, 0);
  
  // Active Layer Population
  const totalLayers = layerFlocks.reduce((acc, f) => acc + f.currentCount, 0);

  // --- Efficiency Metrics (Rolling 7-Day Average) ---
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateLimit = sevenDaysAgo.toISOString().split('T')[0];
  const layerFlockIds = layerFlocks.map(f => f.id);

  // Filter logs for last 7 days for active layer flocks
  const weeklyEggLogs = eggLogs.filter(l => l.date >= dateLimit && layerFlockIds.includes(l.flockId));
  const weeklyFeedLogs = consumptionRecords.filter(c => c.date >= dateLimit && layerFlockIds.includes(c.flockId));

  const sumEggs7d = weeklyEggLogs.reduce((acc, l) => acc + l.totalGoodEggs, 0);
  const sumFeed7d = weeklyFeedLogs.reduce((acc, l) => acc + l.quantity, 0); // kg

  // 1. FCR Calculation: Kg Feed / Kg Eggs (Assuming avg egg weight ~60g = 0.06kg)
  const estEggMassKg = sumEggs7d * 0.06;
  const fcr = estEggMassKg > 0 ? (sumFeed7d / estEggMassKg).toFixed(2) : '---';

  // 2. Eggs Per Bird Per Day (Hen-Day Production)
  const birdDays = totalLayers * 7;
  const eggsPerBird = birdDays > 0 ? (sumEggs7d / birdDays).toFixed(2) : '---';

  // --- Sales Integration ---
  const eggSales = salesRecords.filter(s => produceItemNames.includes(s.item) && s.status !== 'CANCELLED');
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const monthlyRevenue = eggSales
    .filter(s => s.date >= currentMonthStart)
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const currentStock = produceItems.reduce((acc, i) => acc + i.quantity, 0);

  // Chart Data Preparation (Last 7 Days)
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Production
        const dayLogs = eggLogs.filter(l => l.date === dateStr);
        const total = dayLogs.reduce((acc, l) => acc + l.totalGoodEggs, 0);
        const rate = totalLayers > 0 ? (total / totalLayers) * 100 : 0;
        
        // Sales
        const daySales = eggSales.filter(s => s.date === dateStr);
        const soldQty = daySales.reduce((acc, s) => acc + s.quantity, 0);

        data.push({
            date: dateStr.slice(5), // MM-DD
            production: Math.round(rate), // %
            total,
            sold: soldQty,
            standard: 95 // Mock standard
        });
    }
    return data;
  }, [eggLogs, eggSales, totalLayers]);

  // --- Historical Performance Adjustment ---
  const flockPerformanceFactors = useMemo(() => {
    const factors: Record<string, number> = {};
    layerFlocks.forEach(flock => {
        const flockLogs = eggLogs.filter(l => l.flockId === flock.id);
        if (flockLogs.length < 3) {
            factors[flock.id] = 1.0; 
            return;
        }
        
        const recent = flockLogs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 14);
        let totalEfficiency = 0;
        let count = 0;

        recent.forEach(log => {
            const logDate = new Date(log.date);
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysAgo = Math.floor((new Date().getTime() - logDate.getTime()) / msPerDay);
            const ageInWeeksAtLog = (Math.max(0, flock.ageInDays - daysAgo)) / 7;
            const stdRate = getStandardProductionRate(ageInWeeksAtLog);
            
            if (stdRate > 0.1 && flock.currentCount > 0) {
                const actualRate = log.totalGoodEggs / flock.currentCount;
                const efficiency = Math.max(0.5, Math.min(1.2, actualRate / stdRate));
                totalEfficiency += efficiency;
                count++;
            }
        });

        factors[flock.id] = count > 0 ? (totalEfficiency / count) : 1.0;
    });
    return factors;
  }, [layerFlocks, eggLogs]);

  // --- Forecast Data (Next 30 Days) ---
  const forecastData = useMemo(() => {
    const data: { date: string; projected: number; standard: number }[] = [];
    const daysToForecast = 30;
    
    for (let i = 1; i <= daysToForecast; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        let totalProjected = 0;
        let totalStandard = 0;
        
        layerFlocks.forEach(flock => {
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysSinceStart = Math.floor((date.getTime() - new Date(flock.startDate).getTime()) / msPerDay);
            const totalAgeDays = Math.max(0, daysSinceStart) + flock.initialAge;
            const ageInWeeks = totalAgeDays / 7;
            
            const standardRate = getStandardProductionRate(ageInWeeks);
            const perfFactor = flockPerformanceFactors[flock.id] || 1.0;
            const adjustedRate = Math.min(1.0, standardRate * perfFactor);
            const survivalFactor = Math.pow(0.999, i); 
            const flockCount = flock.currentCount * survivalFactor;
            
            totalProjected += flockCount * adjustedRate;
            totalStandard += flockCount * standardRate;
        });

        data.push({
            date: date.toISOString().slice(5, 10), // MM-DD
            projected: Math.round(totalProjected),
            standard: Math.round(totalStandard)
        });
    }
    return data;
  }, [layerFlocks, flockPerformanceFactors]);

  const totalForecastedEggs = forecastData.reduce((acc: number, d) => acc + d.projected, 0);

  // --- Handlers ---

  const handleOpenModal = () => {
    setEditingId(null);
    setForm({
        flockId: layerFlocks[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        timeOfDay: 'MORNING',
        countLarge: '',
        countMedium: '',
        countSmall: '',
        damaged: ''
    });
    setIsModalOpen(true);
  };

  const handleEditLog = (e: React.MouseEvent, log: EggCollectionLog) => {
    e.stopPropagation();
    setEditingId(log.id);
    
    let cLarge = '', cMedium = '', cSmall = '';
    
    log.collectedItems.forEach(item => {
        const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
        if (invItem) {
            const qty = item.quantity;
            if (invItem.name.includes('Large')) { cLarge = String(qty); }
            else if (invItem.name.includes('Medium')) { cMedium = String(qty); }
            else if (invItem.name.includes('Small')) { cSmall = String(qty); }
        }
    });

    setForm({
        flockId: log.flockId,
        date: log.date,
        timeOfDay: log.timeOfDay,
        countLarge: cLarge,
        countMedium: cMedium,
        countSmall: cSmall,
        damaged: String(log.damagedCount)
    });
    setIsModalOpen(true);
  };

  const promptDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLogToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (logToDelete) {
        // Find log to reverse stock
        const log = eggLogs.find(l => l.id === logToDelete);
        if (log) {
            log.collectedItems.forEach(item => {
                adjustStock(item.inventoryItemId, -item.quantity); // Remove from inventory
            });
        }
        deleteEggLog(logToDelete);
        setDeleteModalOpen(false);
        setLogToDelete(null);
    }
  };

  const ensureProduceItem = async (size: string, initialQty: number): Promise<{ id: string; wasCreated: boolean }> => {
      const existing = inventoryItems.find(i => i.category === 'PRODUCE' && i.name.includes(`Eggs (${size})`));
      if (existing) return { id: existing.id, wasCreated: false };

      // Auto-create missing item
      const newItem = {
          id: `PROD-EGG-${size.toUpperCase()}-${Date.now()}`,
          name: `Table Eggs (${size})`,
          category: 'PRODUCE' as const,
          quantity: initialQty, // Initialize with quantity to avoid race condition with adjustStock
          unit: 'Pieces',
          minThreshold: 100,
          lastRestocked: new Date().toISOString().split('T')[0],
          pricePerUnit: size === 'Large' ? 0.30 : size === 'Medium' ? 0.25 : 0.20
      };
      await addItem(newItem);
      return { id: newItem.id, wasCreated: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.flockId) return;

    const qtyLarge = parseInt(form.countLarge || '0', 10);
    const qtyMedium = parseInt(form.countMedium || '0', 10);
    const qtySmall = parseInt(form.countSmall || '0', 10);
    const qtyDamaged = parseInt(form.damaged || '0', 10);
    const damagedSafe = isNaN(qtyDamaged) ? 0 : qtyDamaged;
    const totalGood = qtyLarge + qtyMedium + qtySmall;

    if (totalGood === 0 && damagedSafe === 0) return;

    if (editingId) {
        // Ensure inventory items exist just in case they were deleted
        const rLarge = await ensureProduceItem('Large', 0);
        const rMedium = await ensureProduceItem('Medium', 0);
        const rSmall = await ensureProduceItem('Small', 0);
        
        const idLarge = rLarge.id;
        const idMedium = rMedium.id;
        const idSmall = rSmall.id;

        const collectedItems = [];
        if (qtyLarge > 0) collectedItems.push({ inventoryItemId: idLarge, quantity: qtyLarge });
        if (qtyMedium > 0) collectedItems.push({ inventoryItemId: idMedium, quantity: qtyMedium });
        if (qtySmall > 0) collectedItems.push({ inventoryItemId: idSmall, quantity: qtySmall });

        // Calculate Deltas for Stock Adjustment
        const oldLog = eggLogs.find(l => l.id === editingId);
        if (oldLog) {
            // Revert old quantities
            for (const item of oldLog.collectedItems) {
                await adjustStock(item.inventoryItemId, -item.quantity);
            }
            // Apply new quantities
            for (const item of collectedItems) {
                await adjustStock(item.inventoryItemId, item.quantity);
            }
        }

        updateEggLog(editingId, {
            date: form.date,
            flockId: form.flockId,
            timeOfDay: form.timeOfDay,
            collectedItems,
            damagedCount: damagedSafe,
            totalGoodEggs: totalGood,
        });
    } else {
        // New Entry: Create items if needed, passing initial quantity
        const rLarge = await ensureProduceItem('Large', qtyLarge);
        const rMedium = await ensureProduceItem('Medium', qtyMedium);
        const rSmall = await ensureProduceItem('Small', qtySmall);

        const collectedItems = [];
        // Only call adjustStock if the item ALREADY existed. 
        // If it was just created by ensureProduceItem, the quantity is already set.
        if (qtyLarge > 0) {
            collectedItems.push({ inventoryItemId: rLarge.id, quantity: qtyLarge });
            if (!rLarge.wasCreated) await adjustStock(rLarge.id, qtyLarge);
        }
        if (qtyMedium > 0) {
            collectedItems.push({ inventoryItemId: rMedium.id, quantity: qtyMedium });
            if (!rMedium.wasCreated) await adjustStock(rMedium.id, qtyMedium);
        }
        if (qtySmall > 0) {
            collectedItems.push({ inventoryItemId: rSmall.id, quantity: qtySmall });
            if (!rSmall.wasCreated) await adjustStock(rSmall.id, qtySmall);
        }

        const newLog: EggCollectionLog = {
            id: `EL-${Date.now()}`,
            date: form.date,
            flockId: form.flockId,
            timeOfDay: form.timeOfDay,
            collectedItems,
            damagedCount: damagedSafe,
            totalGoodEggs: totalGood,
            recordedBy: 'Current User' 
        };
        logEggCollection(newLog);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Production Management</h2>
          <p className="text-slate-500 mt-1">Track egg collection, grading, and laying efficiency.</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2"
        >
          <span>🥚</span> Record Collection
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard 
            label="Collected Today" 
            value={totalEggsToday.toLocaleString()} 
            icon="🧺" 
            color="bg-amber-500" 
            trend={{value: 0, positive: true}}
        />
        <StatCard 
            label="Egg Revenue (Mo)" 
            value={`$${monthlyRevenue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`} 
            icon="💵" 
            color="bg-emerald-500" 
        />
        <StatCard 
            label="Stock on Hand" 
            value={currentStock.toLocaleString()} 
            icon="📦" 
            color="bg-blue-500" 
        />
        <StatCard 
            label="Eggs/Bird (7-Day Avg)" 
            value={eggsPerBird} 
            icon="🐔" 
            color="bg-teal-500" 
        />
        <StatCard 
            label="FCR (7-Day Avg)" 
            value={fcr} 
            icon="⚖️" 
            color={parseFloat(fcr) > 2.2 ? "bg-red-500" : "bg-indigo-500"} 
        />
      </div>

      {/* Charts & Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Laying Performance (Last 7 Days)</h3>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" domain={[0, 100]} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                        <Legend verticalAlign="top" height={36}/>
                        <Area name="Actual Production %" type="monotone" dataKey="production" stroke="#0f766e" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                        <Area name="Breed Standard %" type="monotone" dataKey="standard" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Volume Flow</h3>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                         <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                         <Legend verticalAlign="top" height={36}/>
                         <Bar dataKey="total" name="Collected" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                         <Line type="monotone" dataKey="sold" name="Sold" stroke="#10b981" strokeWidth={2} dot={{r: 3}} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Forecast Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div>
                  <h3 className="text-lg font-bold text-slate-800">Smart Production Forecast (30 Days)</h3>
                  <p className="text-xs text-slate-400">Prediction based on breed standards & recent flock performance</p>
              </div>
              <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wider">Est. Yield</span>
                  <span className="text-xl font-bold">{totalForecastedEggs.toLocaleString()} <span className="text-sm">eggs</span></span>
              </div>
          </div>
          <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} 
                        formatter={(val: number, name: string) => [`${val.toLocaleString()} eggs`, name === 'projected' ? 'AI Prediction' : 'Standard Curve']}
                      />
                      <Legend verticalAlign="top" height={36}/>
                      <Line type="monotone" name="AI Prediction" dataKey="projected" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{r: 6}} />
                      <Line type="monotone" name="Standard Curve" dataKey="standard" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 flex gap-4">
             <button 
                onClick={() => setActiveTab('OVERVIEW')}
                className={`text-sm font-bold transition-colors ${activeTab === 'OVERVIEW' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                Recent Logs
             </button>
             <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`text-sm font-bold transition-colors ${activeTab === 'HISTORY' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
                History Analysis
             </button>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                        <th className="px-6 py-4">Date / Time</th>
                        <th className="px-6 py-4">Flock</th>
                        <th className="px-6 py-4">Total Collected</th>
                        <th className="px-6 py-4">Breakdown (Sizes)</th>
                        <th className="px-6 py-4">Damaged</th>
                        <th className="px-6 py-4">Recorded By</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                    {eggLogs.map(log => {
                        const flockName = flocks.find(f => f.id === log.flockId)?.name || log.flockId;
                        
                        const breakdown = log.collectedItems.map(item => {
                            const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
                            return `${invItem?.name.replace('Table Eggs', '').replace(/[()]/g, '') || '?'}: ${item.quantity}`;
                        }).join(', ');

                        return (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{log.date}</div>
                                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">{log.timeOfDay}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-600">{flockName}</td>
                                <td className="px-6 py-4 font-bold text-teal-600">{log.totalGoodEggs.toLocaleString()}</td>
                                <td className="px-6 py-4 text-xs text-slate-500">{breakdown || '-'}</td>
                                <td className={`px-6 py-4 font-bold ${log.damagedCount > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                    {log.damagedCount}
                                </td>
                                <td className="px-6 py-4 text-slate-400 text-xs">{log.recordedBy}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => handleEditLog(e, log)}
                                            className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg hover:bg-teal-100 hover:text-teal-600 transition-colors"
                                            title="Edit Log"
                                        >
                                            ✎
                                        </button>
                                        <button 
                                            onClick={(e) => promptDelete(e, log.id)}
                                            className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors"
                                            title="Delete Log"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {eggLogs.length === 0 && (
                        <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">No collection logs found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Collection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                🥚 {editingId ? 'Edit Collection' : 'Record Collection'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Flock</label>
                    <select 
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      value={form.flockId}
                      onChange={e => setForm({...form, flockId: e.target.value})}
                    >
                        {layerFlocks.map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.house})</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={form.date}
                      onChange={e => setForm({...form, date: e.target.value})}
                    />
                  </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Collection Time</label>
                 <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['MORNING', 'AFTERNOON', 'EVENING'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm({...form, timeOfDay: t as any})}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.timeOfDay === t ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            {t}
                        </button>
                    ))}
                 </div>
               </div>

               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Count & Grading</h4>
                  
                  <div className="flex justify-between items-center">
                     <span className="text-sm font-bold text-slate-700 w-1/3">Large</span>
                     <input 
                        type="number" 
                        min="0"
                        placeholder="Count (Pieces)" 
                        className="flex-1 p-3 rounded-lg border border-slate-200 text-sm" 
                        value={form.countLarge} 
                        onChange={e => setForm({...form, countLarge: e.target.value})}
                     />
                  </div>

                  <div className="flex justify-between items-center">
                     <span className="text-sm font-bold text-slate-700 w-1/3">Medium</span>
                     <input 
                        type="number" 
                        min="0"
                        placeholder="Count (Pieces)" 
                        className="flex-1 p-3 rounded-lg border border-slate-200 text-sm" 
                        value={form.countMedium} 
                        onChange={e => setForm({...form, countMedium: e.target.value})}
                     />
                  </div>

                   <div className="flex justify-between items-center">
                     <span className="text-sm font-bold text-slate-700 w-1/3">Small</span>
                     <input 
                        type="number" 
                        min="0"
                        placeholder="Count (Pieces)" 
                        className="flex-1 p-3 rounded-lg border border-slate-200 text-sm" 
                        value={form.countSmall} 
                        onChange={e => setForm({...form, countSmall: e.target.value})}
                     />
                  </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-red-500 uppercase mb-1">Damaged / Cracked</label>
                 <input 
                   type="number" 
                   min="0"
                   className="w-full p-3 rounded-xl border border-red-100 focus:ring-2 focus:ring-red-500 outline-none"
                   placeholder="0"
                   value={form.damaged}
                   onChange={e => setForm({...form, damaged: e.target.value})}
                 />
               </div>

               <button 
                 type="submit" 
                 className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all mt-2"
               >
                 {editingId ? 'Update Log' : 'Save Collection Log'}
               </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Log?</h3>
            <p className="text-slate-500 mb-6">Are you sure? This will remove the collection record and <strong>deduct</strong> the collected amount from inventory.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg">Delete & Revert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionManagement;