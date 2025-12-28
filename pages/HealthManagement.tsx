
import React, { useState } from 'react';
import { getDiagnosticDiagnosis } from '../services/geminiService';
import { HealthRecord, HealthRecordType, Flock } from '../types';
import { useInventory } from '../context/InventoryContext';

const HEALTH_TYPES: HealthRecordType[] = [
  'CHECKUP', 'VACCINATION', 'MEDICATION', 'TREATMENT', 
  'OUTBREAK', 'MORTALITY', 'RECOVERY', 'ISOLATION'
];

const VACCINATION_PROTOCOLS = {
  LAYER: [
    { day: 1, name: "Marex", method: "Injection (Hatchery)" },
    { day: 7, name: "New Castle – HB1", method: "Eye Drop / Spray" },
    { day: 14, name: "Gumboro (Intermediate)", method: "Drinking Water" }, // Day 14-17
    { day: 21, name: "New Castle Lasota", method: "Drinking Water" }, // Day 21-24
    { day: 28, name: "Gumboro (Booster)", method: "Drinking Water" }, // Day 27-28
    { day: 42, name: "Fowl Pox", method: "Wing Web Stab" }, // Day 42-56
    { day: 90, name: "Fowl Typhoid", method: "Injection" }, // Day 90-92
  ],
  BROILER: [
    { day: 1, name: "Marex", method: "Injection (Hatchery)" },
    { day: 3, name: "Eye Drop (ND+IB)", method: "Eye Drop" },
    { day: 10, name: "New Castle + Clone 30 + 1V", method: "Drinking Water" },
    { day: 32, name: "New Castle + Clone 30 + 1V", method: "Drinking Water" },
  ]
};

const HealthManagement: React.FC = () => {
  // Context
  const { 
    items: inventoryItems, 
    adjustStock,
    flocks,
    healthRecords,
    addHealthRecord,
    updateHealthRecord,
    deleteHealthRecord
  } = useInventory();
  
  const medicineInventory = inventoryItems.filter(i => i.category === 'MEDICINE');

  // State for AI Diagnosis
  const [symptoms, setSymptoms] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [errorAI, setErrorAI] = useState<string | null>(null);

  // State for Health Records
  // Using context state `healthRecords` directly in render
  const [activeTab, setActiveTab] = useState<HealthRecordType | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('TABLE');
  
  // State for Modal (Create/Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<HealthRecordType>('CHECKUP');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // State for Delete Confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // State for Schedule Generation
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleFlockId, setScheduleFlockId] = useState('');
  const [scheduleTab, setScheduleTab] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualSchedule, setManualSchedule] = useState({
    flockId: '',
    date: '',
    vaccine: '',
    method: ''
  });

  const [newRecord, setNewRecord] = useState<Partial<HealthRecord>>({
    flockId: '',
    date: new Date().toISOString().split('T')[0],
    diagnosis: '',
    details: '',
    medication: '',
    mortality: 0,
    cost: 0,
    veterinarian: 'Dr. Ama', // Default
    status: 'COMPLETED'
  });

  // State for linked inventory in form
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [consumedQuantity, setConsumedQuantity] = useState<number>(0);

  // --- AI Logic ---
  const handleDiagnose = async () => {
    if (!symptoms.trim()) return;
    setLoadingAI(true);
    setErrorAI(null);
    try {
      const result = await getDiagnosticDiagnosis(symptoms);
      setDiagnosisResult(result);
    } catch (err) {
      setErrorAI("Failed to generate AI diagnosis. Please try again.");
    } finally {
      setLoadingAI(false);
    }
  };

  const saveAIDiagnosis = () => {
    if (!diagnosisResult) return;
    const record: HealthRecord = {
      id: `H${Date.now()}`,
      flockId: 'Unknown', // User would need to assign
      type: 'OUTBREAK',
      date: new Date().toISOString().split('T')[0],
      diagnosis: diagnosisResult.diagnosis,
      details: diagnosisResult.biosecurity_measures.join(', '),
      symptoms: [symptoms],
      medication: diagnosisResult.recommended_medication,
      mortality: 0,
      status: diagnosisResult.urgency === 'HIGH' ? 'PENDING' : 'RESOLVED',
      veterinarian: 'AI Assistant'
    };
    addHealthRecord(record);
    setDiagnosisResult(null);
    setSymptoms('');
    alert("AI Diagnosis saved to records!");
  };

  // --- Schedule Logic ---
  const handleGenerateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const flock = flocks.find(f => f.id === scheduleFlockId);
    if (!flock) return;

    // Determine Protocol
    const protocolType = flock.type === 'LAYER' ? 'LAYER' : 'BROILER';
    const baseProtocol = VACCINATION_PROTOCOLS[protocolType];
    let scheduleItems = [...baseProtocol];

    // Add Recurring for Layers (Every 2 months after Day 92)
    // Generating up to 72 weeks (approx 504 days)
    if (protocolType === 'LAYER') {
        let currentDay = 92 + 60; // Start 2 months after Day 92
        while (currentDay <= 510) {
            scheduleItems.push({
                day: currentDay,
                name: "New Castle (Recurring Booster)",
                method: "Drinking Water"
            });
            currentDay += 60;
        }
    }

    scheduleItems.forEach((vax, index) => {
        const date = new Date(flock.startDate);
        date.setDate(date.getDate() + vax.day);
        
        const record: HealthRecord = {
            id: `SCH-${flock.id}-${index}-${Date.now()}`,
            flockId: flock.id,
            type: 'VACCINATION',
            date: date.toISOString().split('T')[0],
            diagnosis: vax.name,
            details: `Standard Protocol - Day ${vax.day} (${vax.method})`,
            medication: vax.name,
            mortality: 0,
            status: 'SCHEDULED',
            veterinarian: 'Pending',
            nextScheduledDate: ''
        };
        addHealthRecord(record);
    });

    setScheduleModalOpen(false);
    setScheduleFlockId('');
    setActiveTab('VACCINATION');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSchedule.flockId || !manualSchedule.date || !manualSchedule.vaccine) return;
    
    const record: HealthRecord = {
      id: `SCH-MAN-${Date.now()}`,
      flockId: manualSchedule.flockId,
      type: 'VACCINATION',
      date: manualSchedule.date,
      diagnosis: manualSchedule.vaccine,
      details: manualSchedule.method || 'Manual Schedule',
      medication: manualSchedule.vaccine,
      mortality: 0,
      status: 'SCHEDULED',
      veterinarian: 'Pending',
      nextScheduledDate: ''
    };

    addHealthRecord(record);
    setScheduleModalOpen(false);
    setManualSchedule({ flockId: '', date: '', vaccine: '', method: '' });
    setActiveTab('VACCINATION');
  };

  const upcomingVaccinations = healthRecords
    .filter(r => r.type === 'VACCINATION' && (r.status === 'SCHEDULED' || r.status === 'PENDING'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // --- CRUD Logic ---

  const resetForm = (type: HealthRecordType) => {
    setEditingId(null);
    setModalType(type);
    setNewRecord({
      flockId: flocks[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      diagnosis: '',
      details: '',
      medication: '',
      mortality: 0,
      cost: 0,
      veterinarian: 'Dr. Ama',
      status: 'COMPLETED',
      batchNumber: '',
      nextScheduledDate: ''
    });
    setSelectedInventoryId('');
    setConsumedQuantity(0);
  };

  const handleOpenCreate = (type: HealthRecordType) => {
    resetForm(type);
    setIsModalOpen(true);
  };

  const handleEdit = (record: HealthRecord) => {
    setEditingId(record.id);
    setModalType(record.type);
    setNewRecord({
      ...record
    });
    setSelectedInventoryId('');
    setConsumedQuantity(0);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setRecordToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      deleteHealthRecord(recordToDelete);
      setDeleteModalOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleInventorySelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedInventoryId(id);
    
    // Auto-fill medication name if an item is selected
    if (id) {
        const item = medicineInventory.find(i => i.id === id);
        if (item) {
            setNewRecord(prev => ({ 
                ...prev, 
                medication: item.name,
                diagnosis: modalType === 'VACCINATION' ? item.name : prev.diagnosis 
            }));
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Process Stock Deduction
    if (selectedInventoryId && consumedQuantity > 0 && !editingId) {
        adjustStock(selectedInventoryId, -consumedQuantity);
    }

    if (editingId) {
      // Update Existing
      updateHealthRecord(editingId, {
        type: modalType,
        flockId: newRecord.flockId!,
        date: newRecord.date!,
        diagnosis: newRecord.diagnosis || getDefaultTitle(modalType),
        details: newRecord.details,
        medication: newRecord.medication,
        mortality: newRecord.mortality || 0,
        cost: newRecord.cost,
        veterinarian: newRecord.veterinarian!,
        status: newRecord.status as any,
        batchNumber: newRecord.batchNumber,
        nextScheduledDate: newRecord.nextScheduledDate
      });
    } else {
      // Create New
      const record: HealthRecord = {
        id: `H${Date.now()}`,
        type: modalType,
        flockId: newRecord.flockId!,
        date: newRecord.date!,
        diagnosis: newRecord.diagnosis || getDefaultTitle(modalType),
        details: newRecord.details,
        medication: newRecord.medication,
        mortality: newRecord.mortality || 0,
        cost: newRecord.cost,
        veterinarian: newRecord.veterinarian!,
        status: newRecord.status as any,
        batchNumber: newRecord.batchNumber,
        nextScheduledDate: newRecord.nextScheduledDate
      };
      addHealthRecord(record);
    }
    
    setIsModalOpen(false);
  };

  const getDefaultTitle = (type: HealthRecordType) => {
    switch (type) {
      case 'CHECKUP': return 'Routine Health Inspection';
      case 'MORTALITY': return 'Mortality Log';
      case 'VACCINATION': return 'Scheduled Vaccination';
      case 'ISOLATION': return 'Sick Isolation Record';
      default: return 'Health Record';
    }
  };

  // --- Filtering ---
  const filteredRecords = activeTab === 'ALL' 
    ? healthRecords 
    : healthRecords.filter(r => r.type === activeTab);

  const getTypeColor = (type: HealthRecordType) => {
    switch (type) {
      case 'VACCINATION': return 'bg-blue-100 text-blue-700';
      case 'MEDICATION': return 'bg-purple-100 text-purple-700';
      case 'TREATMENT': return 'bg-amber-100 text-amber-700';
      case 'MORTALITY': return 'bg-red-100 text-red-700';
      case 'OUTBREAK': return 'bg-red-50 text-red-600 border border-red-200';
      case 'CHECKUP': return 'bg-emerald-100 text-emerald-700';
      case 'RECOVERY': return 'bg-teal-100 text-teal-700';
      case 'ISOLATION': return 'bg-orange-100 text-orange-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeIcon = (type: HealthRecordType) => {
    switch (type) {
      case 'VACCINATION': return '💉';
      case 'MEDICATION': return '💊';
      case 'TREATMENT': return '🩹';
      case 'MORTALITY': return '💀';
      case 'OUTBREAK': return '☣️';
      case 'CHECKUP': return '📋';
      case 'RECOVERY': return '💪';
      case 'ISOLATION': return '🚧';
      default: return '🩺';
    }
  };

  // Helper for UI feedback on stock
  const selectedItemData = medicineInventory.find(i => i.id === selectedInventoryId);
  const isStockInsufficient = selectedItemData && consumedQuantity > selectedItemData.quantity;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Health & Biosecurity</h2>
          <p className="text-slate-500 mt-1">Manage vaccinations, treatments, and disease control.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* View Toggles */}
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 mr-2">
             <button 
               onClick={() => setViewMode('TABLE')}
               className={`p-2 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
               title="List View"
             >
               ☰
             </button>
             <button 
               onClick={() => setViewMode('GRID')}
               className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
               title="Grid View"
             >
               ⸬
             </button>
          </div>

          <button onClick={() => setScheduleModalOpen(true)} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2">
            <span>📅</span> Schedule
          </button>
          <button onClick={() => handleOpenCreate('VACCINATION')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2">
            <span>💉</span> Vaccinate
          </button>
          <button onClick={() => handleOpenCreate('MORTALITY')} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2">
            <span>💀</span> Report Death
          </button>
           <button onClick={() => handleOpenCreate('CHECKUP')} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2">
            <span>+</span> Record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. AI Diagnostic Section */}
        <div className="lg:col-span-2 bg-gradient-to-br from-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between">
           <div className="flex justify-between items-start">
              <div className="mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">🤖 AI Vet Assistant</h3>
                <p className="text-teal-200 text-sm mt-1">Describe symptoms to get an instant preliminary diagnosis and biosecurity protocols.</p>
              </div>
           </div>
           
           {!diagnosisResult ? (
             <div className="flex gap-4">
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Birds in House 2 are sneezing, gasping, and have a 5% drop in water consumption..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl p-3 text-white placeholder-teal-200/50 focus:outline-none focus:ring-2 focus:ring-teal-400 h-24 resize-none"
                />
                <button
                   onClick={handleDiagnose}
                   disabled={loadingAI || !symptoms.trim()}
                   className={`px-6 rounded-xl font-bold transition-all ${loadingAI ? 'bg-slate-700' : 'bg-teal-500 hover:bg-teal-400 text-teal-950'}`}
                >
                  {loadingAI ? 'Analyzing...' : 'Diagnose'}
                </button>
             </div>
           ) : (
              <div className="bg-white/10 rounded-xl p-4 border border-white/20 animate-in slide-in-from-bottom-2">
                 <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">Potential Diagnosis</span>
                      <h4 className="text-xl font-bold">{diagnosisResult.diagnosis}</h4>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setDiagnosisResult(null)} className="text-xs font-bold text-white/50 hover:text-white bg-white/10 px-3 py-1.5 rounded-lg">Dismiss</button>
                      <button onClick={saveAIDiagnosis} className="text-xs font-bold text-teal-950 bg-teal-400 hover:bg-teal-300 px-3 py-1.5 rounded-lg">Save Record</button>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-teal-300 block mb-1">Recommended Action</span>
                      <p className="text-white/90">{diagnosisResult.recommended_medication}</p>
                    </div>
                    <div>
                      <span className="text-xs text-teal-300 block mb-1">Biosecurity</span>
                      <ul className="list-disc list-inside text-white/90">
                        {diagnosisResult.biosecurity_measures?.slice(0, 2).map((m:string, i:number) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                 </div>
              </div>
           )}
           {errorAI && <p className="text-red-300 text-sm mt-2">⚠️ {errorAI}</p>}
        </div>

        {/* 3. Upcoming Schedule Widget */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">📅 Schedule <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{upcomingVaccinations.length}</span></h3>
              <button 
                onClick={() => setScheduleModalOpen(true)}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 underline"
              >
                Manage
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[220px] pr-1">
              {upcomingVaccinations.length > 0 ? (
                upcomingVaccinations.map(vac => {
                   const date = new Date(vac.date);
                   const today = new Date();
                   const daysDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 3600 * 24));
                   const urgencyColor = daysDiff <= 1 ? 'bg-red-50 border-red-100' : daysDiff <= 3 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100';
                   const flockName = flocks.find(f => f.id === vac.flockId)?.name || vac.flockId;
                   
                   return (
                     <div key={vac.id} className={`p-3 rounded-xl border ${urgencyColor} relative group`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-slate-700 text-sm">{vac.diagnosis}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${daysDiff <= 1 ? 'bg-red-200 text-red-800' : 'bg-slate-200 text-slate-600'}`}>
                            {daysDiff === 0 ? 'TODAY' : daysDiff < 0 ? 'OVERDUE' : `In ${daysDiff}d`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-500">
                          <span>{flockName}</span>
                          <span>{vac.date}</span>
                        </div>
                        
                        <div className="absolute inset-0 bg-white/90 hidden group-hover:flex items-center justify-center gap-2 rounded-xl transition-all">
                           <button 
                             onClick={() => handleEdit(vac)}
                             className="px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-teal-700"
                           >
                             Execute
                           </button>
                        </div>
                     </div>
                   );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                  <span className="text-2xl mb-2">✅</span>
                  <p className="text-sm">No pending vaccinations.</p>
                  <button onClick={() => setScheduleModalOpen(true)} className="text-xs text-teal-600 font-bold mt-2">Add Schedule</button>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* 4. Health Registry Tabs */}
      <div>
         <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide">
            {['ALL', 'VACCINATION', 'MEDICATION', 'TREATMENT', 'CHECKUP', 'OUTBREAK', 'MORTALITY', 'ISOLATION', 'RECOVERY'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab 
                    ? 'bg-slate-800 text-white shadow-lg' 
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab === 'ALL' ? 'All Records' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
         </div>

         {/* 5. Records Display (Grid or Table) */}
         {viewMode === 'GRID' ? (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredRecords.map(record => {
                 const flockName = flocks.find(f => f.id === record.flockId)?.name || record.flockId;
                 return (
                   <div key={record.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all relative group">
                      <div className="flex justify-between items-start mb-3">
                         <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getTypeColor(record.type)}`}>
                            <span>{getTypeIcon(record.type)}</span> {record.type}
                         </span>
                         <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-400 font-medium">{record.date}</span>
                             <div className="hidden group-hover:flex gap-1 ml-1 animate-in fade-in duration-200">
                               <button 
                                 onClick={() => handleEdit(record)}
                                 className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-teal-100 hover:text-teal-600 transition-colors"
                                 title="Edit"
                               >
                                 ✎
                               </button>
                               <button 
                                 onClick={() => handleDeleteClick(record.id)}
                                 className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                                 title="Delete"
                               >
                                 🗑
                               </button>
                             </div>
                         </div>
                      </div>
                      
                      <h3 className="font-bold text-slate-800 mb-1">{record.diagnosis}</h3>
                      <p className="text-xs text-slate-500 mb-4 font-medium">Flock: <span className="text-slate-700">{flockName}</span></p>
                      
                      <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-50">
                         {record.details && <p className="line-clamp-2">{record.details}</p>}
                         {record.medication && <div className="flex justify-between"><span>Rx:</span> <span className="font-medium text-slate-800">{record.medication}</span></div>}
                         {record.mortality > 0 && <div className="flex justify-between text-red-600 font-bold"><span>Mortality:</span> <span>{record.mortality} birds</span></div>}
                         {record.nextScheduledDate && <div className="flex justify-between text-blue-600 font-medium"><span>Next Due:</span> <span>{record.nextScheduledDate}</span></div>}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-xs">
                         <span className="text-slate-400">Vet: {record.veterinarian}</span>
                         <span className={`font-bold ${record.status === 'COMPLETED' || record.status === 'RESOLVED' ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {record.status}
                         </span>
                      </div>
                   </div>
                 );
              })}
              {filteredRecords.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  No records found for this category.
                </div>
              )}
           </div>
         ) : (
           <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
                     <th className="px-6 py-4">Date</th>
                     <th className="px-6 py-4">Type</th>
                     <th className="px-6 py-4">Diagnosis / Event</th>
                     <th className="px-6 py-4">Flock</th>
                     <th className="px-6 py-4">Key Details</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 text-sm">
                   {filteredRecords.map(record => {
                     const flockName = flocks.find(f => f.id === record.flockId)?.name || record.flockId;
                     return (
                       <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                         <td className="px-6 py-4 font-medium text-slate-600 whitespace-nowrap">{record.date}</td>
                         <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex w-fit items-center gap-1.5 ${getTypeColor(record.type)}`}>
                              <span>{getTypeIcon(record.type)}</span> {record.type}
                            </span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="font-bold text-slate-800">{record.diagnosis}</div>
                           {record.veterinarian && <div className="text-xs text-slate-400 mt-0.5">Vet: {record.veterinarian}</div>}
                         </td>
                         <td className="px-6 py-4 text-slate-600">{flockName}</td>
                         <td className="px-6 py-4">
                            <div className="space-y-1">
                              {record.mortality > 0 && <div className="text-xs text-red-600 font-bold">Mortality: {record.mortality}</div>}
                              {record.medication && <div className="text-xs text-slate-600">Rx: {record.medication}</div>}
                              {record.batchNumber && <div className="text-xs text-slate-400">Batch: {record.batchNumber}</div>}
                              {record.cost && record.cost > 0 && <div className="text-xs text-slate-600">Cost: ${record.cost}</div>}
                            </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className={`text-xs font-bold ${record.status === 'COMPLETED' || record.status === 'RESOLVED' ? 'text-emerald-600' : 'text-amber-500'}`}>
                              {record.status}
                           </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={() => handleEdit(record)}
                               className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-teal-100 hover:text-teal-600"
                               title="Edit"
                             >
                               ✎
                             </button>
                             <button 
                               onClick={() => handleDeleteClick(record.id)}
                               className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600"
                               title="Delete"
                             >
                               🗑
                             </button>
                           </div>
                         </td>
                       </tr>
                     );
                   })}
                   {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                          No records found matching this filter.
                        </td>
                      </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
         )}
      </div>

      {/* 6. Dynamic Modal (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 {getTypeIcon(modalType)} {editingId ? 'Edit' : 'New'} Record
               </h3>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
               {/* Global Record Type Selector */}
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Record Type</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                    value={modalType}
                    onChange={(e) => setModalType(e.target.value as HealthRecordType)}
                    disabled={!!editingId} // Disable changing type when editing to prevent inconsistencies
                  >
                    {HEALTH_TYPES.map(type => (
                      <option key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')}</option>
                    ))}
                  </select>
               </div>

               {/* Common Fields */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Flock</label>
                    <select 
                      required 
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white"
                      value={newRecord.flockId}
                      onChange={e => setNewRecord({...newRecord, flockId: e.target.value})}
                    >
                      {flocks.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={newRecord.date}
                      onChange={e => setNewRecord({...newRecord, date: e.target.value})}
                    />
                  </div>
               </div>

               {/* Inventory Linking Section for Vaccination/Medication */}
               {(modalType === 'VACCINATION' || modalType === 'MEDICATION' || modalType === 'TREATMENT') && (
                   <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <label className="block text-xs font-bold text-blue-700 uppercase mb-2">
                            🔗 Link to Inventory (Deduct Stock)
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <select 
                                    className="w-full p-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    value={selectedInventoryId}
                                    onChange={handleInventorySelection}
                                >
                                    <option value="">-- Select Item --</option>
                                    {medicineInventory.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} ({item.quantity} {item.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <input 
                                    type="number"
                                    min="0"
                                    placeholder="Qty Used"
                                    className="w-full p-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    value={consumedQuantity || ''}
                                    onChange={e => setConsumedQuantity(Number(e.target.value))}
                                    disabled={!selectedInventoryId}
                                />
                            </div>
                        </div>
                        {selectedItemData && (
                            <div className="mt-2 text-xs flex justify-between items-center">
                                <span className="text-slate-500">Current Stock: <b>{selectedItemData.quantity} {selectedItemData.unit}</b></span>
                                {isStockInsufficient && (
                                    <span className="text-red-500 font-bold">⚠️ Insufficient Stock</span>
                                )}
                            </div>
                        )}
                   </div>
               )}

               {/* Dynamic Title/Diagnosis Input */}
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                     {modalType === 'MORTALITY' ? 'Cause of Death' : 
                      modalType === 'VACCINATION' ? 'Vaccine Name' : 
                      modalType === 'OUTBREAK' ? 'Disease Name' : 'Title / Diagnosis'}
                  </label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder={modalType === 'VACCINATION' ? 'e.g. Newcastle + IB' : 'e.g. Routine Checkup'}
                    value={newRecord.diagnosis}
                    onChange={e => setNewRecord({...newRecord, diagnosis: e.target.value})}
                  />
               </div>

               {/* Type Specific Fields */}
               {modalType === 'MORTALITY' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Number of Deaths</label>
                    <input 
                      type="number" 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                      value={newRecord.mortality}
                      onChange={e => setNewRecord({...newRecord, mortality: parseInt(e.target.value) || 0})}
                    />
                  </div>
               )}

               {(modalType === 'VACCINATION' || modalType === 'MEDICATION') && (
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch / Lot #</label>
                       <input 
                         type="text" 
                         className="w-full p-3 rounded-xl border border-slate-200"
                         placeholder="e.g. VAX-99-A"
                         value={newRecord.batchNumber || ''}
                         onChange={e => setNewRecord({...newRecord, batchNumber: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost ($)</label>
                       <input 
                         type="number" 
                         className="w-full p-3 rounded-xl border border-slate-200"
                         value={newRecord.cost}
                         onChange={e => setNewRecord({...newRecord, cost: parseFloat(e.target.value) || 0})}
                       />
                     </div>
                  </div>
               )}

               {(modalType === 'VACCINATION' || modalType === 'TREATMENT') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Next Scheduled Dose</label>
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={newRecord.nextScheduledDate || ''}
                      onChange={e => setNewRecord({...newRecord, nextScheduledDate: e.target.value})}
                    />
                  </div>
               )}

               {(modalType === 'MEDICATION' || modalType === 'TREATMENT' || modalType === 'OUTBREAK') && (
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medication Administered</label>
                     <input 
                       type="text" 
                       className="w-full p-3 rounded-xl border border-slate-200"
                       placeholder="e.g. Amoxicillin 10%"
                       value={newRecord.medication || ''}
                       onChange={e => setNewRecord({...newRecord, medication: e.target.value})}
                     />
                  </div>
               )}

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes / Details</label>
                 <textarea 
                   className="w-full p-3 rounded-xl border border-slate-200 h-24 resize-none"
                   placeholder="Additional observations..."
                   value={newRecord.details}
                   onChange={e => setNewRecord({...newRecord, details: e.target.value})}
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Performed By</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={newRecord.veterinarian}
                      onChange={e => setNewRecord({...newRecord, veterinarian: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={newRecord.status}
                      onChange={e => setNewRecord({...newRecord, status: e.target.value as any})}
                    >
                      <option value="COMPLETED">Completed</option>
                      <option value="PENDING">Pending</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="TREATED">Treated</option>
                    </select>
                  </div>
               </div>

               <div className="pt-4 flex gap-3">
                 <button type="submit" disabled={isStockInsufficient} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg transition-all">
                   {editingId ? 'Update Record' : 'Save Record'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}
      
      {/* ... (Delete Modal remains the same) ... */}
       {/* 7. Schedule Manager Modal */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-lg font-bold text-slate-800">Vaccination Schedule</h3>
               <button onClick={() => setScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <div className="flex border-b border-slate-100">
                <button 
                   onClick={() => setScheduleTab('AUTO')}
                   className={`flex-1 py-3 text-sm font-bold transition-colors ${scheduleTab === 'AUTO' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/20' : 'text-slate-400 hover:bg-slate-50'}`}
                >Auto-Protocol</button>
                <button 
                   onClick={() => setScheduleTab('MANUAL')}
                   className={`flex-1 py-3 text-sm font-bold transition-colors ${scheduleTab === 'MANUAL' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/20' : 'text-slate-400 hover:bg-slate-50'}`}
                >Manual Entry</button>
             </div>

             <div className="p-6">
                {scheduleTab === 'AUTO' ? (
                    <form onSubmit={handleGenerateSchedule} className="space-y-4">
                       <div>
                         <p className="text-sm text-slate-500 mb-4">
                           This will apply a standard vaccination plan (Marex, ND, Gumboro, etc.) tailored to the selected flock type (Layer/Broiler).
                         </p>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Flock</label>
                         <select 
                            required
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                            value={scheduleFlockId}
                            onChange={e => setScheduleFlockId(e.target.value)}
                         >
                           <option value="">Choose a flock...</option>
                           {flocks.map(flock => (
                             <option key={flock.id} value={flock.id}>
                               {flock.name} ({flock.type})
                             </option>
                           ))}
                         </select>
                       </div>

                       <button 
                         type="submit" 
                         disabled={!scheduleFlockId}
                         className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all"
                       >
                         Generate Plan
                       </button>
                     </form>
                ) : (
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                        <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Flock</label>
                         <select 
                            required
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                            value={manualSchedule.flockId}
                            onChange={e => setManualSchedule({...manualSchedule, flockId: e.target.value})}
                         >
                           <option value="">Choose a flock...</option>
                           {flocks.map(flock => (
                             <option key={flock.id} value={flock.id}>
                               {flock.name}
                             </option>
                           ))}
                         </select>
                       </div>
                       
                       <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Scheduled Date</label>
                         <input 
                           required
                           type="date" 
                           className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                           value={manualSchedule.date}
                           onChange={e => setManualSchedule({...manualSchedule, date: e.target.value})}
                         />
                       </div>

                       <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vaccine Name</label>
                         <input 
                           required
                           type="text" 
                           className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                           placeholder="e.g. Newcastle Disease"
                           value={manualSchedule.vaccine}
                           onChange={e => setManualSchedule({...manualSchedule, vaccine: e.target.value})}
                         />
                       </div>

                       <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method / Details</label>
                         <input 
                           type="text" 
                           className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                           placeholder="e.g. Drinking Water"
                           value={manualSchedule.method}
                           onChange={e => setManualSchedule({...manualSchedule, method: e.target.value})}
                         />
                       </div>

                       <button 
                         type="submit" 
                         className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all"
                       >
                         Add to Schedule
                       </button>
                    </form>
                )}
             </div>
          </div>
        </div>
      )}

      {/* 8. Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              🗑
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Record?</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to remove this health record? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthManagement;
