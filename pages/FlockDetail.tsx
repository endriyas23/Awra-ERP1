
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PERFORMANCE_DATA, FEED_SCHEDULE_DATA } from '../constants';
import { DailyLog } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useInventory } from '../context/InventoryContext';

const calculateAgeInDays = (startDate: string, initialAge: number, targetDate?: string) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = targetDate ? new Date(targetDate) : new Date();
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays) + initialAge;
};

const FlockDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Context Integration
  const { 
      items: inventoryItems, 
      adjustStock, 
      logConsumption, 
      eggLogs,
      flocks,
      healthRecords: allHealthRecords
  } = useInventory();

  const flock = flocks.find(f => f.id === id);
  const healthRecords = useMemo(() => allHealthRecords.filter(r => r.flockId === id), [allHealthRecords, id]);
  
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [newLog, setNewLog] = useState({
    mortality: '',
    feed: '',
    feedType: '',
    water: '',
    weight: '',
    notes: ''
  });

  const currentAge = useMemo(() => {
    if (!flock) return 0;
    return calculateAgeInDays(flock.startDate, flock.initialAge || 0);
  }, [flock]);

  // Determine active health issue
  const activeIssue = useMemo(() => {
    const sorted = [...healthRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0];
    
    if (!latest) return null;
    
    const isCriticalType = ['OUTBREAK', 'TREATMENT', 'MEDICATION', 'DIAGNOSIS', 'ISOLATION'].includes(latest.type);
    const isResolved = latest.status === 'RESOLVED' || latest.status === 'COMPLETED';
    
    if (isCriticalType && !isResolved) {
        return latest;
    }
    return null;
  }, [healthRecords]);

  // Determine current feed recommendation
  const feedRecommendation = useMemo(() => {
    if (!flock) return null;
    const schedule = FEED_SCHEDULE_DATA[flock.type === 'LAYER' ? 'LAYER' : 'BROILER'];
    
    // Find phase
    for (const phase of schedule) {
        // Check substages for specific match
        const match = phase.subStages.find(sub => currentAge >= sub.min && currentAge <= sub.max);
        if (match) {
            return {
                phase: phase.phase,
                feedSearchTerm: phase.feedSearchTerm,
                intake: match.rate,
                label: match.label,
                bg: phase.bg,
                color: phase.color
            };
        }
    }
    return null;
  }, [flock, currentAge]);

  // Calculate total recommended feed in KG for the whole flock
  const recommendedFeedTotal = useMemo(() => {
      if (!feedRecommendation || !flock) return null;
      // Extract numbers from string like "110-150 g"
      const matches = feedRecommendation.intake.match(/(\d+)/g);
      if (!matches) return null;
      
      const min = parseInt(matches[0]);
      const max = matches.length > 1 ? parseInt(matches[1]) : min;
      const avg = (min + max) / 2;
      
      // Calculate total kg for flock
      const totalKg = (avg * flock.currentCount) / 1000;
      return Math.round(totalKg);
  }, [feedRecommendation, flock]);

  // Filter inventory for this specific flock type using LIVE context data
  const availableFeedItems = useMemo(() => {
    if (!flock) return [];
    return inventoryItems.filter(item => {
        if (item.category !== 'FEED') return false;
        if (flock.type === 'BROILER') {
          return ['Starter Feed', 'Grower Feed', 'Finisher Feed'].includes(item.name);
        }
        if (flock.type === 'LAYER') {
           return [
            'Chick Starter Feed', 
            'Pullet Grower Feed', 
            'Pre-Layer Feed', 
            'Layer Phase 1 Feed', 
            'Layer Phase 2 Feed',
            'Rearing Feed' // Added Rearing Feed match
          ].includes(item.name);
        }
        return true;
    });
  }, [flock, inventoryItems]);

  // Find the exact inventory item that matches the recommendation
  const suggestedInventoryItem = useMemo(() => {
      if (!feedRecommendation || availableFeedItems.length === 0) return null;
      return availableFeedItems.find(item => 
          item.name.toLowerCase().includes(feedRecommendation.feedSearchTerm.toLowerCase())
      );
  }, [feedRecommendation, availableFeedItems]);

  // --- Production Data Logic for Layers ---
  const productionData = useMemo(() => {
    if (!flock || flock.type !== 'LAYER') return [];
    
    // Group logs by date for chart
    const logsForFlock = eggLogs.filter(l => l.flockId === flock.id);
    const grouped = new Map<string, number>();
    
    logsForFlock.forEach(l => {
        grouped.set(l.date, (grouped.get(l.date) || 0) + l.totalGoodEggs);
    });

    const chartData = Array.from(grouped.entries()).map(([date, count]) => ({
        date,
        count,
        percentage: flock.currentCount > 0 ? (count / flock.currentCount) * 100 : 0
    })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // If empty, add dummy recent data for visualization
    if (chartData.length === 0) return [];
    
    return chartData;
  }, [eggLogs, flock]);

  if (!flock) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-2xl font-bold text-slate-400">Flock not found</h2>
        <button onClick={() => navigate('/flock')} className="mt-4 text-teal-600 font-bold underline">Back to List</button>
      </div>
    );
  }

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Inventory Deduction & Consumption Logging
    const feedQtyKg = parseFloat(newLog.feed) || 0;
    if (newLog.feedType && feedQtyKg > 0) {
        const item = availableFeedItems.find(i => i.id === newLog.feedType);
        if (item) {
            // 1. Deduct from Stock
            // Convert kg to bags if necessary (Assumption: 1 bag = 50kg)
            const deductionAmount = item.unit.toLowerCase().includes('bag') ? feedQtyKg / 50 : feedQtyKg;
            adjustStock(item.id, -deductionAmount);

            // 2. Log Consumption for Feed Module
            const pricePerBag = item.pricePerUnit || 0;
            const estimatedCost = (feedQtyKg / 50) * pricePerBag; // Assuming 50kg bags for cost calc
            
            logConsumption({
                id: `C-${Date.now()}`,
                flockId: flock.id,
                feedItemId: item.id,
                quantity: feedQtyKg,
                date: new Date().toISOString().split('T')[0],
                cost: estimatedCost
            });
        }
    }

    const log: DailyLog = {
      id: `L-${Date.now()}`,
      flockId: flock.id,
      date: new Date().toISOString().split('T')[0],
      mortality: 0, // Mortality logging disabled in this view, moved to Health Module
      feedConsumed: feedQtyKg,
      waterConsumed: parseFloat(newLog.water) || 0,
      averageWeight: parseFloat(newLog.weight) || undefined,
      notes: newLog.notes ? `${newLog.notes} (Feed: ${availableFeedItems.find(i=>i.id===newLog.feedType)?.name || 'N/A'})` : undefined
    };
    setDailyLogs([log, ...dailyLogs]);
    
    setIsLogModalOpen(false);
    setNewLog({ mortality: '', feed: '', feedType: '', water: '', weight: '', notes: '' });
  };

  const selectedFeedItem = availableFeedItems.find(i => i.id === newLog.feedType);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/flock')}
          className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          ←
        </button>
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{flock.name}</h2>
          <div className="flex gap-4 text-sm text-slate-500 mt-1">
            <span>{flock.breed}</span>
            <span>•</span>
            <span>{flock.house}</span>
            <span>•</span>
            <span className="font-semibold text-teal-600">ID: {flock.id}</span>
          </div>
        </div>
      </div>

      {activeIssue && (
        <div className={`p-4 rounded-2xl border ${
            activeIssue.type === 'OUTBREAK' ? 'bg-red-50 border-red-200' : 
            activeIssue.type === 'ISOLATION' ? 'bg-orange-50 border-orange-200' :
            'bg-amber-50 border-amber-200'} flex flex-col md:flex-row items-start gap-4 shadow-sm animate-in slide-in-from-top-2`}>
            <div className={`p-3 rounded-full flex-shrink-0 ${
                activeIssue.type === 'OUTBREAK' ? 'bg-red-100 text-red-600' : 
                activeIssue.type === 'ISOLATION' ? 'bg-orange-100 text-orange-600' :
                'bg-amber-100 text-amber-600'} text-2xl`}>
                {activeIssue.type === 'OUTBREAK' ? '☣️' : activeIssue.type === 'ISOLATION' ? '🚧' : '💊'}
            </div>
            <div className="flex-1 w-full">
                <div className="flex justify-between items-start">
                    <h4 className={`font-bold text-lg ${
                        activeIssue.type === 'OUTBREAK' ? 'text-red-800' : 
                        activeIssue.type === 'ISOLATION' ? 'text-orange-800' :
                        'text-amber-800'}`}>
                        Active Health Alert: {activeIssue.diagnosis}
                    </h4>
                    <span className="text-xs font-bold uppercase tracking-wider bg-white/50 px-2 py-1 rounded">
                        {activeIssue.status}
                    </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    {activeIssue.medication && (
                        <div className="bg-white/60 p-3 rounded-xl border border-white/50">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Recommended Medication</span>
                            <span className="font-bold text-slate-800 flex items-center gap-2">
                                <span>💊</span> {activeIssue.medication}
                            </span>
                        </div>
                    )}
                    <div className="bg-white/60 p-3 rounded-xl border border-white/50">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Action Plan / Details</span>
                        <p className="text-sm text-slate-700 leading-snug">{activeIssue.details || "Monitor flock closely and isolate sick birds if necessary."}</p>
                    </div>
                </div>
                
                <div className="mt-3 flex gap-3">
                     <button onClick={() => navigate('/health')} className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-sm ${
                        activeIssue.type === 'OUTBREAK' ? 'bg-red-600 text-white hover:bg-red-700' : 
                        activeIssue.type === 'ISOLATION' ? 'bg-orange-600 text-white hover:bg-orange-700' :
                        'bg-amber-600 text-white hover:bg-amber-700'}`}>
                        Manage Health Record
                     </button>
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-8">
          {/* Main Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Current Population</p>
              <h3 className="text-2xl font-bold mt-1">{flock.currentCount.toLocaleString()}</h3>
              <p className="text-xs text-slate-400 mt-1">Starting: {flock.initialCount.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Flock Age</p>
              <h3 className="text-2xl font-bold mt-1">{currentAge} Days</h3>
              <p className="text-xs text-slate-400 mt-1">Placement: {new Date(flock.startDate).toLocaleDateString()} (at {flock.initialAge}d)</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Survival Rate</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">
                {((flock.currentCount / flock.initialCount) * 100).toFixed(1)}%
              </h3>
              <p className="text-xs text-slate-400 mt-1">Cumulative mortality: {flock.initialCount - flock.currentCount}</p>
            </div>
          </div>

          {/* Charts - CONDITIONAL Based on Type */}
          {flock.type === 'BROILER' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4">Growth Curve (kg)</h4>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={PERFORMANCE_DATA}>
                        <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorWeight)" />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4">Daily FCR</h4>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={PERFORMANCE_DATA}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis domain={[1.2, 1.8]} axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                        <Line type="stepAfter" dataKey="fcr" stroke="#0d9488" strokeWidth={3} dot={{r: 4}} />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
                </div>
            </div>
          ) : (
            // LAYER Specific Charts
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h4 className="font-bold text-slate-800">Laying Performance</h4>
                    <p className="text-xs text-slate-500">Percentage of flock laying per day</p>
                 </div>
                 {productionData.length > 0 && (
                    <div className="text-right">
                       <span className="text-2xl font-bold text-amber-500">
                           {productionData[productionData.length - 1].percentage.toFixed(1)}%
                       </span>
                       <span className="text-xs text-slate-400 block uppercase font-bold">Latest Rate</span>
                    </div>
                 )}
               </div>
               <div className="h-64">
                 {productionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={productionData}>
                            <defs>
                                <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(val) => val.slice(5)} />
                            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 10}} unit="%" />
                            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Area type="monotone" dataKey="percentage" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                        </AreaChart>
                    </ResponsiveContainer>
                 ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p>No production data recorded yet.</p>
                    </div>
                 )}
               </div>
            </div>
          )}

          {/* Daily Logs History */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
              <h4 className="font-bold text-slate-800">Daily Performance Logs</h4>
              <button 
                onClick={() => setIsLogModalOpen(true)}
                className="text-teal-600 text-sm font-bold hover:underline"
              >
                + Add Daily Log
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-bold">Date</th>
                    <th className="px-6 py-3 font-bold">Age (Day)</th>
                    <th className="px-6 py-3 font-bold">Mortality</th>
                    <th className="px-6 py-3 font-bold">Feed (kg)</th>
                    <th className="px-6 py-3 font-bold">Water (L)</th>
                    <th className="px-6 py-3 font-bold">Avg. Weight (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {dailyLogs.length > 0 ? dailyLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">{log.date}</td>
                      <td className="px-6 py-4 font-bold text-teal-600">Day {calculateAgeInDays(flock.startDate, flock.initialAge || 0, log.date)}</td>
                      <td className={`px-6 py-4 font-bold ${log.mortality > 0 ? 'text-red-500' : 'text-slate-400'}`}>{log.mortality}</td>
                      <td className="px-6 py-4">{log.feedConsumed}</td>
                      <td className="px-6 py-4">{log.waterConsumed}</td>
                      <td className="px-6 py-4 font-medium">{log.averageWeight || '-'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">No daily logs recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Health Records */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
              <h4 className="font-bold text-slate-800">Recent Health History</h4>
              <button onClick={() => navigate('/health')} className="text-teal-600 text-sm font-bold hover:underline">New Report</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 font-bold">Date</th>
                    <th className="px-6 py-3 font-bold">Diagnosis</th>
                    <th className="px-6 py-3 font-bold">Mortality</th>
                    <th className="px-6 py-3 font-bold">Status</th>
                    <th className="px-6 py-3 font-bold">Vet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {healthRecords.length > 0 ? healthRecords.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">{record.date}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{record.diagnosis}</td>
                      <td className="px-6 py-4 text-red-500 font-bold">{record.mortality}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          record.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{record.veterinarian}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">No recorded health issues for this flock.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
            <h4 className="font-bold mb-4">Quick Actions</h4>
            <div className="space-y-3">
              <button 
                onClick={() => setIsLogModalOpen(true)}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 rounded-xl font-bold transition-all"
              >
                Add Daily Log
              </button>
              {flock.type === 'LAYER' && (
                 <button 
                    onClick={() => navigate('/production')}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                 >
                    <span>🥚</span> Log Egg Collection
                 </button>
              )}
              <button onClick={() => navigate('/feed')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all">Manage Feed Inventory</button>
              <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all">Move Flock</button>
            </div>
          </div>

          {/* New Nutritional Targets Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full translate-x-8 -translate-y-8 z-0"></div>
             <div className="relative z-10">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    🌾 Nutritional Targets
                </h4>
                {feedRecommendation ? (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-xl ${feedRecommendation.bg} border border-slate-100`}>
                            <p className="text-xs font-bold uppercase text-slate-500 mb-1">Current Phase</p>
                            <p className={`font-bold text-lg ${feedRecommendation.color}`}>{feedRecommendation.phase}</p>
                            <p className="text-xs text-slate-500 mt-1">{feedRecommendation.label}</p>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Daily Intake Target</span>
                                <span className="text-xl font-bold text-slate-800">{feedRecommendation.intake}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-teal-500 h-full w-[70%]"></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">
                                * Based on {flock.type === 'BROILER' ? 'Cobb 500' : 'Hy-Line Brown'} standards for Day {currentAge}.
                            </p>
                            {recommendedFeedTotal && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Est. Daily Total</span>
                                    <span className="text-lg font-bold text-slate-800">{recommendedFeedTotal} kg</span>
                                </div>
                            )}
                            
                            {/* Inventory Availability Check */}
                            <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Recommended Product</span>
                                <p className="text-sm font-bold text-teal-700">{suggestedInventoryItem ? suggestedInventoryItem.name : `Match for "${feedRecommendation.feedSearchTerm}" not found`}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-slate-400 text-sm">
                        No specific feed data for this age ({currentAge} days).
                    </div>
                )}
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
             <h4 className="font-bold text-slate-800 mb-4">Bio-Security Status</h4>
             <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-sm font-medium">House Sanitation: OK</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-sm font-medium">Water Quality: OK</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-sm font-medium">Litter Condition: WET</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Daily Log Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">New Daily Log</h3>
              <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddLog} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Avg Weight (kg)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="1.25"
                    value={newLog.weight}
                    onChange={e => setNewLog({...newLog, weight: e.target.value})}
                  />
                </div>
                {/* Mortality input removed */}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feed Type</label>
                <select 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                  value={newLog.feedType}
                  onChange={e => setNewLog({...newLog, feedType: e.target.value})}
                >
                  <option value="">Select Ration...</option>
                  {availableFeedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.quantity} {item.unit} avail)
                    </option>
                  ))}
                </select>
                {selectedFeedItem && (
                    <p className="text-[10px] text-slate-500 mt-1 text-right">
                        Available Stock: <b>{selectedFeedItem.quantity} {selectedFeedItem.unit}</b>
                    </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex flex-col mb-1 gap-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Feed Quantity (kg)</label>
                      {recommendedFeedTotal && recommendedFeedTotal > 0 && suggestedInventoryItem && (
                          <button
                            type="button"
                            onClick={() => setNewLog({
                                ...newLog, 
                                feed: recommendedFeedTotal.toString(),
                                feedType: suggestedInventoryItem.id
                            })}
                            className="text-[10px] bg-teal-50 text-teal-600 px-2 py-1 rounded text-left hover:bg-teal-100 font-bold border border-teal-100 transition-colors"
                            title="Apply Recommended Amount and Type"
                          >
                             ✨ Auto-Apply: {suggestedInventoryItem.name.split('Feed')[0]} ({recommendedFeedTotal}kg)
                          </button>
                      )}
                  </div>
                  <input 
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="450"
                    value={newLog.feed}
                    onChange={e => setNewLog({...newLog, feed: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Water (L)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="1200"
                    value={newLog.water}
                    onChange={e => setNewLog({...newLog, water: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observations</label>
                <textarea 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none h-24 resize-none"
                  placeholder="Any unusual behavior..."
                  value={newLog.notes}
                  onChange={e => setNewLog({...newLog, notes: e.target.value})}
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all">
                  Submit Today's Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlockDetail;
