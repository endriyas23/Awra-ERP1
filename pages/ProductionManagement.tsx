
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import StatCard from '../components/StatCard';
import { EggCollectionLog } from '../types';
import { useInventory } from '../context/InventoryContext';

const ProductionManagement: React.FC = () => {
  const { items: inventoryItems, adjustStock, eggLogs, logEggCollection, flocks, consumptionRecords } = useInventory();
  
  // States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY'>('OVERVIEW');

  // Form State
  const [form, setForm] = useState({
    flockId: '',
    date: new Date().toISOString().split('T')[0],
    timeOfDay: 'MORNING' as 'MORNING' | 'AFTERNOON' | 'EVENING',
    traysLarge: '',
    looseLarge: '',
    traysMedium: '',
    looseMedium: '',
    traysSmall: '',
    looseSmall: '',
    damaged: '',
  });

  // Filters
  const layerFlocks = flocks.filter(f => f.type === 'LAYER' && f.status === 'ACTIVE');
  const produceItems = inventoryItems.filter(i => i.category === 'PRODUCE' && i.name.includes('Eggs'));

  // --- KPI Calculations ---
  const today = new Date().toISOString().split('T')[0];
  const todaysLogs = eggLogs.filter(l => l.date === today);
  
  const totalEggsToday = todaysLogs.reduce((acc, l) => acc + l.totalGoodEggs, 0);
  const damagedToday = todaysLogs.reduce((acc, l) => acc + l.damagedCount, 0);
  
  // Active Layer Population
  const totalLayers = layerFlocks.reduce((acc, f) => acc + f.currentCount, 0);
  const layingPercentage = totalLayers > 0 ? ((totalEggsToday / totalLayers) * 100).toFixed(1) : '0.0';

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
  // Approximation: Using current active count. For strict accuracy, daily population logs would be summed.
  const birdDays = totalLayers * 7;
  const eggsPerBird = birdDays > 0 ? (sumEggs7d / birdDays).toFixed(2) : '---';

  // Calculate Estimated Revenue Value of Production (Today)
  const estimatedValue = todaysLogs.reduce((total, log) => {
      let logValue = 0;
      log.collectedItems.forEach(item => {
          const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
          if (invItem && invItem.pricePerUnit) {
              logValue += item.quantity * invItem.pricePerUnit;
          }
      });
      return total + logValue;
  }, 0);

  // Chart Data Preparation (Last 7 Days)
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayLogs = eggLogs.filter(l => l.date === dateStr);
        const total = dayLogs.reduce((acc, l) => acc + l.totalGoodEggs, 0);
        const damaged = dayLogs.reduce((acc, l) => acc + l.damagedCount, 0);
        const rate = totalLayers > 0 ? (total / totalLayers) * 100 : 0;
        
        data.push({
            date: dateStr.slice(5), // MM-DD
            production: Math.round(rate), // %
            total,
            damaged,
            standard: 95 // Mock standard
        });
    }
    return data;
  }, [eggLogs, totalLayers]);

  // --- Handlers ---

  const handleOpenModal = () => {
    setForm({
        flockId: layerFlocks[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        timeOfDay: 'MORNING',
        traysLarge: '', looseLarge: '',
        traysMedium: '', looseMedium: '',
        traysSmall: '', looseSmall: '',
        damaged: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.flockId) return;

    // Helper to calc qty from trays + loose
    const calcQty = (trays: string, loose: string) => (parseInt(trays || '0') * 30) + parseInt(loose || '0');

    const qtyLarge = calcQty(form.traysLarge, form.looseLarge);
    const qtyMedium = calcQty(form.traysMedium, form.looseMedium);
    const qtySmall = calcQty(form.traysSmall, form.looseSmall);
    const qtyDamaged = parseInt(form.damaged || '0');
    const totalGood = qtyLarge + qtyMedium + qtySmall;

    if (totalGood === 0 && qtyDamaged === 0) return;

    // Identify Inventory IDs for sizes (In a real app, these ID links would be robust)
    const itemLarge = produceItems.find(i => i.name.includes('Large'));
    const itemMedium = produceItems.find(i => i.name.includes('Medium'));
    const itemSmall = produceItems.find(i => i.name.includes('Small'));

    const collectedItems = [];
    if (qtyLarge > 0 && itemLarge) {
        collectedItems.push({ inventoryItemId: itemLarge.id, quantity: qtyLarge });
        adjustStock(itemLarge.id, qtyLarge); // Add to inventory
    }
    if (qtyMedium > 0 && itemMedium) {
        collectedItems.push({ inventoryItemId: itemMedium.id, quantity: qtyMedium });
        adjustStock(itemMedium.id, qtyMedium); // Add to inventory
    }
    if (qtySmall > 0 && itemSmall) {
        collectedItems.push({ inventoryItemId: itemSmall.id, quantity: qtySmall });
        adjustStock(itemSmall.id, qtySmall); // Add to inventory
    }

    const newLog: EggCollectionLog = {
        id: `EL-${Date.now()}`,
        date: form.date,
        flockId: form.flockId,
        timeOfDay: form.timeOfDay,
        collectedItems,
        damagedCount: qtyDamaged,
        totalGoodEggs: totalGood,
        recordedBy: 'Current User' // Mock
    };

    logEggCollection(newLog);
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
            label="Est. Market Value" 
            value={`$${estimatedValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
            icon="💵" 
            color="bg-teal-500" 
        />
        <StatCard 
            label="Laying Rate (Today)" 
            value={`${layingPercentage}%`} 
            icon="📈" 
            color="bg-emerald-500" 
            trend={{value: 0, positive: true}}
        />
        {/* New Metric: Eggs Per Bird */}
        <StatCard 
            label="Eggs/Bird (7-Day Avg)" 
            value={eggsPerBird} 
            icon="🐔" 
            color="bg-blue-500" 
        />
        {/* New Metric: FCR */}
        <StatCard 
            label="FCR (7-Day Avg)" 
            value={fcr} 
            icon="⚖️" 
            color={parseFloat(fcr) > 2.2 ? "bg-red-500" : "bg-indigo-500"} 
        />
      </div>

      {/* Charts & Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Main Chart: Production Curve */}
         <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Laying Performance (Last 7 Days)</h3>
            <div className="h-72">
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

         {/* Side Chart: Quality Breakdown */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Quality Control</h3>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                         <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                         <Bar dataKey="total" name="Good Eggs" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                         <Bar dataKey="damaged" name="Damaged" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
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
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                    {eggLogs.map(log => {
                        const flockName = flocks.find(f => f.id === log.flockId)?.name || log.flockId;
                        
                        // Create breakdown string
                        const breakdown = log.collectedItems.map(item => {
                            const invItem = inventoryItems.find(i => i.id === item.inventoryItemId);
                            return `${invItem?.name.replace('Table Eggs', '').replace(/[()]/g, '')}: ${item.quantity}`;
                        }).join(', ');

                        return (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
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
                            </tr>
                        );
                    })}
                    {eggLogs.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No collection logs found.</td></tr>
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
                🥚 Record Egg Collection
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

               {/* Grading Section */}
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Count & Grading</h4>
                  
                  {/* Large Eggs */}
                  <div className="grid grid-cols-6 gap-2 items-center">
                     <span className="col-span-2 text-sm font-bold text-slate-700">Large</span>
                     <div className="col-span-2">
                        <input type="number" placeholder="Trays (30)" className="w-full p-2 rounded-lg border border-slate-200 text-sm" 
                            value={form.traysLarge} onChange={e => setForm({...form, traysLarge: e.target.value})}
                        />
                     </div>
                     <div className="col-span-2">
                        <input type="number" placeholder="Loose" className="w-full p-2 rounded-lg border border-slate-200 text-sm" 
                            value={form.looseLarge} onChange={e => setForm({...form, looseLarge: e.target.value})}
                        />
                     </div>
                  </div>

                  {/* Medium Eggs */}
                  <div className="grid grid-cols-6 gap-2 items-center">
                     <span className="col-span-2 text-sm font-bold text-slate-700">Medium</span>
                     <div className="col-span-2">
                        <input type="number" placeholder="Trays (30)" className="w-full p-2 rounded-lg border border-slate-200 text-sm" 
                            value={form.traysMedium} onChange={e => setForm({...form, traysMedium: e.target.value})}
                        />
                     </div>
                     <div className="col-span-2">
                        <input type="number" placeholder="Loose" className="w-full p-2 rounded-lg border border-slate-200 text-sm" 
                             value={form.looseMedium} onChange={e => setForm({...form, looseMedium: e.target.value})}
                        />
                     </div>
                  </div>

                   {/* Small Eggs */}
                   <div className="grid grid-cols-6 gap-2 items-center">
                     <span className="col-span-2 text-sm font-bold text-slate-700">Small</span>
                     <div className="col-span-2">
                        <input type="number" placeholder="Trays (30)" className="w-full p-2 rounded-lg border border-slate-200 text-sm" 
                            value={form.traysSmall} onChange={e => setForm({...form, traysSmall: e.target.value})}
                        />
                     </div>
                     <div className="col-span-2">
                        <input type="number" placeholder="Loose" className="w-full p-2 rounded-lg border border-slate-200 text-sm" 
                             value={form.looseSmall} onChange={e => setForm({...form, looseSmall: e.target.value})}
                        />
                     </div>
                  </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-red-500 uppercase mb-1">Damaged / Cracked</label>
                 <input 
                   type="number" 
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
                 Save Collection Log
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionManagement;
