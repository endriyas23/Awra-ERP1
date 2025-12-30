
import React, { useState, useMemo } from 'react';
import { FEED_SCHEDULE_DATA } from '../constants';
import { InventoryItem, FeedConsumption } from '../types';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';
import { 
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const COLORS = ['#0f766e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

const FeedManagement: React.FC = () => {
  const { items, adjustStock, consumptionRecords, addTransaction, flocks } = useInventory();
  const inventory = items.filter(item => item.category === 'FEED');
  
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeSchedule, setActiveSchedule] = useState<'LAYER' | 'BROILER'>('BROILER');

  const totalStock = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockCount = inventory.filter(item => item.quantity < item.minThreshold).length;

  const handleRestock = (quantity: number, pricePerUnit: number) => {
    if (selectedItem) {
        // 1. Update Inventory Stock
        adjustStock(selectedItem.id, quantity);
        
        // 2. Log Financial Expense
        const totalCost = quantity * pricePerUnit;
        if (totalCost > 0) {
            addTransaction({
                id: `EXP-FEED-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                description: `Feed Restock: ${selectedItem.name} (${quantity} ${selectedItem.unit})`,
                amount: totalCost,
                type: 'EXPENSE',
                category: 'FEED',
                status: 'COMPLETED',
                referenceId: selectedItem.id
            });
        }

        setIsRestockModalOpen(false);
    }
  };

  const currentSchedule = FEED_SCHEDULE_DATA[activeSchedule];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Feed & Nutrition</h2>
          <p className="text-slate-500 mt-1">Manage rations, inventory, and conversion efficiency.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsReportOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <span>📊</span> Consumption Report
          </button>
          <button 
            onClick={() => { setSelectedItem(null); setIsRestockModalOpen(true); }}
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-all"
          >
            + Add Feed Stock
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Feed in Stock" value={`${totalStock} Bags`} icon="🌾" color="bg-teal-500" />
        <StatCard label="Daily Avg. Consumption" value="--- kg" trend={{ value: 0, positive: false }} icon="🍽️" color="bg-amber-500" />
        <StatCard label="Low Stock Alerts" value={lowStockCount} icon="⚠️" color={lowStockCount > 0 ? "bg-red-500" : "bg-emerald-500"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Feed Inventory List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Silo & Warehouse Inventory</h3>
              <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">Live Updates</span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {inventory.map(item => {
                const stockPercentage = Math.min(100, (item.quantity / (item.minThreshold * 3)) * 100);
                const isLow = item.quantity < item.minThreshold;

                return (
                  <div key={item.id} className="p-5 rounded-2xl border border-slate-50 bg-slate-50/50 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800">{item.name}</h4>
                        <p className="text-xs text-slate-400 uppercase font-bold mt-0.5">{item.id}</p>
                      </div>
                      <button 
                        onClick={() => { setSelectedItem(item); setIsRestockModalOpen(true); }}
                        className="text-teal-600 hover:text-teal-700 font-bold text-sm"
                      >
                        Restock
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Current Stock</span>
                        <span className={`font-bold ${isLow ? 'text-red-500' : 'text-slate-800'}`}>
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${isLow ? 'bg-red-500' : 'bg-teal-500'}`}
                          style={{ width: `${stockPercentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-tighter text-slate-400">
                        <span>Empty</span>
                        <span>Min: {item.minThreshold}</span>
                        <span>Refill suggested</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {inventory.length === 0 && (
                  <div className="col-span-2 text-center text-slate-400 italic py-10">No feed items in inventory. Add stock to begin.</div>
              )}
            </div>
          </div>

          {/* Recent Consumption Logs */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-50">
              <h3 className="font-bold text-slate-800">Recent Consumption Entries</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Flock</th>
                    <th className="px-6 py-4">Feed Type</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {consumptionRecords.map(log => {
                    const feedItem = inventory.find(i => i.id === log.feedItemId);
                    const pricePerUnit = feedItem?.pricePerUnit || 0;
                    
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-600">{log.date}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {flocks.find(f => f.id === log.flockId)?.name || log.flockId}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {feedItem?.name || log.feedItemId}
                        </td>
                        <td className="px-6 py-4 font-bold text-teal-600">{log.quantity} kg</td>
                        <td className="px-6 py-4 text-slate-800 font-semibold">
                          ${log.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-slate-400 block font-normal">
                             (@ ${pricePerUnit.toFixed(2)}/unit)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {consumptionRecords.length === 0 && (
                     <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">No consumption records found.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Nutritional Standards Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-bold text-lg flex items-center gap-2">
                <span>🔬</span> Ration Standards
              </h4>
              <button className="text-[10px] font-bold text-teal-400 uppercase tracking-widest hover:underline">Edit Benchmarks</button>
            </div>
            
            <div className="space-y-6">
              {/* Meat/Broiler Track */}
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-3 border-b border-slate-800 pb-1">Broiler / Meat Track</p>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-teal-400">Starter</span>
                      <span className="text-[9px] text-slate-400 uppercase font-bold">0-10 Days</span>
                    </div>
                    <div className="flex gap-4 text-[10px] text-slate-400">
                      <span>Protein: <b className="text-white">23%</b></span>
                      <span>ME: <b className="text-white">3025 kcal</b></span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-teal-400">Grower</span>
                      <span className="text-[9px] text-slate-400 uppercase font-bold">11-24 Days</span>
                    </div>
                    <div className="flex gap-4 text-[10px] text-slate-400">
                      <span>Protein: <b className="text-white">21%</b></span>
                      <span>ME: <b className="text-white">3150 kcal</b></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-bold transition-all shadow-sm">
              Optimize Formulations
            </button>
          </div>

          {/* Feed Consumption Schedule Widget */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h4 className="font-bold text-slate-800">Feed Schedule</h4>
                  <p className="text-xs text-slate-400">Consumption Rate by Age</p>
               </div>
               <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">g/bird/day</span>
            </div>
            
            {/* Toggle Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                <button 
                    onClick={() => setActiveSchedule('BROILER')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeSchedule === 'BROILER' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Broiler
                </button>
                <button 
                    onClick={() => setActiveSchedule('LAYER')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeSchedule === 'LAYER' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Layer
                </button>
            </div>

            {/* Broiler Specific Stats Header */}
            {activeSchedule === 'BROILER' && (
                <div className="mb-4 flex gap-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <div className="flex-1 text-center border-r border-slate-200">
                        <span className="block font-bold text-slate-700">1.6</span>
                        <span>Target FCR</span>
                    </div>
                    <div className="flex-1 text-center">
                        <span className="block font-bold text-slate-700">42 Days</span>
                        <span>Cycle Time</span>
                    </div>
                </div>
            )}

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {currentSchedule.map((section, idx) => (
                    <div key={idx} className="relative animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className={`sticky top-0 z-10 py-2 flex flex-col ${section.bg} mb-2 rounded-lg px-3 border border-slate-100`}>
                           <div className="flex justify-between items-center w-full">
                               <span className={`text-xs font-bold uppercase tracking-wider ${section.color}`}>{section.phase}</span>
                               <span className="text-[9px] font-bold text-slate-500">{section.rangeLabel}</span>
                           </div>
                           <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                               <span>Recommended:</span>
                               <span className="font-bold text-slate-600">{section.feedSearchTerm}</span>
                           </div>
                        </div>
                        <div className="space-y-1.5 px-2">
                            {section.subStages.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm group hover:bg-slate-50 rounded px-1 transition-colors">
                                    <span className="text-slate-600 text-xs font-medium">{item.label}</span>
                                    <span className="font-bold text-slate-800 text-xs">{item.rate}</span>
                                </div>
                            ))}
                        </div>
                        {idx !== currentSchedule.length - 1 && <div className="border-b border-slate-50 my-3"></div>}
                    </div>
                ))}
            </div>
          </div>

        </div>
      </div>

      {/* Restock Modal */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
              <h3 className="text-xl font-bold text-slate-800">Restock Feed Inventory</h3>
              <button onClick={() => setIsRestockModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <RestockForm 
              inventory={inventory} 
              onConfirm={handleRestock} 
              onCancel={() => setIsRestockModalOpen(false)} 
              preSelectedItem={selectedItem}
            />
          </div>
        </div>
      )}

      {/* Consumption Report Modal */}
      {isReportOpen && (
        <ConsumptionReportModal 
            onClose={() => setIsReportOpen(false)} 
            records={consumptionRecords}
            inventory={inventory}
            flocks={flocks}
        />
      )}
    </div>
  );
};

// Extracted Restock Form
const RestockForm: React.FC<{
    inventory: InventoryItem[];
    onConfirm: (qty: number, price: number) => void;
    onCancel: () => void;
    preSelectedItem: InventoryItem | null;
}> = ({ inventory, onConfirm, onCancel, preSelectedItem }) => {
    const [selectedId, setSelectedId] = useState(preSelectedItem?.id || (inventory[0]?.id || ''));
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState(preSelectedItem?.pricePerUnit?.toString() || '');

    // Update price if selected item changes
    React.useEffect(() => {
        if(selectedId && !preSelectedItem) {
             const item = inventory.find(i => i.id === selectedId);
             if(item) setPrice(item.pricePerUnit?.toString() || '');
        }
    }, [selectedId, inventory, preSelectedItem]);

    const handleSubmit = () => {
        if (!selectedId || !quantity) return;
        onConfirm(Number(quantity), Number(price));
    };

    return (
        <div className="p-6 space-y-4">
               <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feed Type</label>
                <select 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    disabled={!!preSelectedItem}
                >
                  <option value="">-- Select --</option>
                  {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity (Bags)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" 
                    placeholder="50"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price per Bag</label>
                  <input 
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" 
                    placeholder="24.50"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 flex justify-between items-center">
                 <span>Total Expense:</span>
                 <span className="text-lg font-bold text-slate-800">
                    ${((Number(quantity) || 0) * (Number(price) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                 </span>
              </div>

              <button 
                onClick={handleSubmit}
                className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-teal-700 transition-all"
              >
                Confirm & Sync Financials
              </button>
            </div>
    )
}

// Internal Component for Report Modal
const ConsumptionReportModal: React.FC<{
    onClose: () => void;
    records: FeedConsumption[];
    inventory: InventoryItem[];
    flocks: any[];
}> = ({ onClose, records, inventory, flocks }) => {
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    const [startDate, setStartDate] = useState(monthAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today);

    const filteredRecords = useMemo(() => {
        return records.filter(r => r.date >= startDate && r.date <= endDate);
    }, [records, startDate, endDate]);

    // Analytics
    const totalConsumed = filteredRecords.reduce((acc, r) => acc + r.quantity, 0);
    const totalCost = filteredRecords.reduce((acc, r) => acc + r.cost, 0);
    
    const daysDiff = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)));
    const dailyAvg = totalConsumed / daysDiff;

    // Charts Data
    const trendData = useMemo(() => {
        const grouped: Record<string, number> = {};
        filteredRecords.forEach(r => {
            const d = r.date.slice(5); // MM-DD
            grouped[d] = (grouped[d] || 0) + r.quantity;
        });
        return Object.keys(grouped).sort().map(d => ({ date: d, quantity: grouped[d] }));
    }, [filteredRecords]);

    const distributionData = useMemo(() => {
        const grouped: Record<string, number> = {};
        filteredRecords.forEach(r => {
            const item = inventory.find(i => i.id === r.feedItemId);
            const name = item ? item.name : 'Unknown';
            grouped[name] = (grouped[name] || 0) + r.quantity;
        });
        return Object.keys(grouped).map(name => ({ name, value: grouped[name] }));
    }, [filteredRecords, inventory]);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Feed Consumption Analysis</h3>
                        <p className="text-sm text-slate-500">Detailed breakdown of feed usage and costs.</p>
                    </div>
                    <div className="flex gap-2 items-center bg-white p-1 rounded-xl border border-slate-200">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 text-sm text-slate-600 outline-none bg-transparent" />
                        <span className="text-slate-400">→</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 text-sm text-slate-600 outline-none bg-transparent" />
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100">✕</button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-5 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800">
                            <p className="text-xs font-bold uppercase opacity-70">Total Consumed</p>
                            <p className="text-2xl font-bold mt-1">{totalConsumed.toLocaleString()} <span className="text-sm font-normal">kg</span></p>
                        </div>
                        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800">
                            <p className="text-xs font-bold uppercase opacity-70">Total Cost</p>
                            <p className="text-2xl font-bold mt-1">${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})} </p>
                        </div>
                        <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800">
                            <p className="text-xs font-bold uppercase opacity-70">Daily Average</p>
                            <p className="text-2xl font-bold mt-1">{dailyAvg.toFixed(1)} <span className="text-sm font-normal">kg/day</span></p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-80">
                            <h4 className="text-sm font-bold text-slate-700 mb-4">Daily Usage Trend</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0f766e" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                                    <Area type="monotone" dataKey="quantity" stroke="#0f766e" strokeWidth={2} fillOpacity={1} fill="url(#colorUsage)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-80 flex flex-col">
                            <h4 className="text-sm font-bold text-slate-700 mb-4">Consumption by Feed Type</h4>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={distributionData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {distributionData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend wrapperStyle={{fontSize: '11px'}} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Flock ID</th>
                                    <th className="px-6 py-4">Feed Type</th>
                                    <th className="px-6 py-4 text-right">Quantity (kg)</th>
                                    <th className="px-6 py-4 text-right">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredRecords.map(log => {
                                    const feedName = inventory.find(i => i.id === log.feedItemId)?.name || log.feedItemId;
                                    const flockName = flocks.find(f => f.id === log.flockId)?.name || log.flockId;
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 text-slate-600 font-mono">{log.date}</td>
                                            <td className="px-6 py-3 font-bold text-slate-700">{flockName}</td>
                                            <td className="px-6 py-3 text-slate-600">{feedName}</td>
                                            <td className="px-6 py-3 text-right font-bold text-teal-600">{log.quantity}</td>
                                            <td className="px-6 py-3 text-right text-slate-600">${log.cost.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                                {filteredRecords.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                                            No records found for this period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeedManagement;
