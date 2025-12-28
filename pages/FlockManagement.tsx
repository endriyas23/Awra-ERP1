
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEED_SCHEDULE_DATA } from '../constants';
import { Flock, InventoryItem, EggCollectionLog, HealthRecord } from '../types';
import { useInventory } from '../context/InventoryContext';

const calculateCurrentAge = (startDate: string, initialAge: number) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays) + initialAge;
};

const FlockManagement: React.FC = () => {
  const { 
    adjustStock, 
    items: inventoryItems, 
    logConsumption, 
    logEggCollection, 
    addTransaction,
    flocks, 
    addFlock, 
    updateFlock, 
    deleteFlock,
    addHealthRecord
  } = useInventory();
  
  // CRUD Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Daily Log Modal State
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);
  const [activeFlockForLog, setActiveFlockForLog] = useState<Flock | null>(null);
  const [dailyLogForm, setDailyLogForm] = useState({
    mortality: '',
    causeOfDeath: '',
    feedType: '',
    feedQuantity: '',
    water: '',
    weight: '',
    notes: ''
  });

  // Egg Collection Modal State
  const [isEggModalOpen, setIsEggModalOpen] = useState(false);
  const [eggForm, setEggForm] = useState({
      trays: '',
      loose: '',
      damaged: ''
  });

  // Quarantine Modal State
  const [isQuarantineModalOpen, setIsQuarantineModalOpen] = useState(false);
  const [quarantineForm, setQuarantineForm] = useState({
      count: '',
      reason: '',
      notes: ''
  });

  // Delete Confirmation State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [flockToDelete, setFlockToDelete] = useState<string | null>(null);

  // Bulk Action State
  const [selectedFlockIds, setSelectedFlockIds] = useState<string[]>([]);
  const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'QUARANTINE' | 'DEPLETED' | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    breed: '',
    house: '',
    initialCount: '',
    placementDate: new Date().toISOString().split('T')[0],
    initialAge: '0', 
    type: 'BROILER' as 'BROILER' | 'LAYER',
    status: 'ACTIVE' as 'ACTIVE' | 'DEPLETED' | 'QUARANTINE',
    costOfBirds: '' // Added for Financial Link
  });

  // Quick Action State
  const [activeFlock, setActiveFlock] = useState<Flock | null>(null);
  const [actionType, setActionType] = useState<'FEED' | 'HEALTH' | null>(null);
  const [quickForm, setQuickForm] = useState({ value1: '', value2: '', notes: '' });

  const navigate = useNavigate();

  // Helper to filter inventory based on flock type
  const getAvailableFeed = (flock: Flock | null) => {
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
            'Rearing Feed'
          ].includes(item.name);
        }
        return true;
    });
  };

  const availableFeedItems = activeFlock ? getAvailableFeed(activeFlock) : [];
  const availableFeedItemsForLog = activeFlockForLog ? getAvailableFeed(activeFlockForLog) : [];
  const selectedFeedItemForLog = availableFeedItemsForLog.find(i => i.id === dailyLogForm.feedType);

  // --- Intelligent Feed Suggestion Logic ---
  const feedRecommendation = useMemo(() => {
    if (!activeFlockForLog) return null;
    const currentAge = calculateCurrentAge(activeFlockForLog.startDate, activeFlockForLog.initialAge || 0);
    const schedule = FEED_SCHEDULE_DATA[activeFlockForLog.type === 'LAYER' ? 'LAYER' : 'BROILER'];
    
    for (const phase of schedule) {
        const match = phase.subStages.find(sub => currentAge >= sub.min && currentAge <= sub.max);
        if (match) {
            return {
                phase: phase.phase,
                feedSearchTerm: phase.feedSearchTerm,
                intake: match.rate,
                label: match.label
            };
        }
    }
    return null;
  }, [activeFlockForLog]);

  const recommendedFeedTotal = useMemo(() => {
      if (!feedRecommendation || !activeFlockForLog) return null;
      const matches = feedRecommendation.intake.match(/(\d+)/g);
      if (!matches) return null;
      const min = parseInt(matches[0]);
      const max = matches.length > 1 ? parseInt(matches[1]) : min;
      const avg = (min + max) / 2;
      const totalKg = (avg * activeFlockForLog.currentCount) / 1000;
      return Math.round(totalKg);
  }, [feedRecommendation, activeFlockForLog]);

  const suggestedInventoryItem = useMemo(() => {
      if (!feedRecommendation || availableFeedItemsForLog.length === 0) return null;
      return availableFeedItemsForLog.find(item => 
          item.name.toLowerCase().includes(feedRecommendation.feedSearchTerm.toLowerCase())
      );
  }, [feedRecommendation, availableFeedItemsForLog]);


  // --- Bulk Action Handlers ---

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (selectedFlockIds.includes(id)) {
      setSelectedFlockIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedFlockIds(prev => [...prev, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedFlockIds.length === flocks.length) {
      setSelectedFlockIds([]);
    } else {
      setSelectedFlockIds(flocks.map(f => f.id));
    }
  };

  const initiateBulkAction = (type: 'QUARANTINE' | 'DEPLETED') => {
    setBulkActionType(type);
    setBulkActionModalOpen(true);
  };

  const confirmBulkAction = () => {
    if (!bulkActionType) return;
    
    selectedFlockIds.forEach(id => {
      updateFlock(id, { status: bulkActionType });
    });

    // Reset
    setSelectedFlockIds([]);
    setBulkActionType(null);
    setBulkActionModalOpen(false);
  };

  // --- CRUD Handlers ---

  const resetForm = () => {
    setFormData({ 
      name: '', 
      breed: '', 
      house: '', 
      initialCount: '', 
      placementDate: new Date().toISOString().split('T')[0],
      initialAge: '0',
      type: 'BROILER',
      status: 'ACTIVE',
      costOfBirds: ''
    });
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, flock: Flock) => {
    e.stopPropagation();
    setEditingId(flock.id);
    setFormData({
      name: flock.name,
      breed: flock.breed,
      house: flock.house,
      initialCount: flock.initialCount.toString(),
      placementDate: flock.startDate,
      initialAge: flock.initialAge.toString(),
      type: flock.type,
      status: flock.status,
      costOfBirds: '' // Not editable generally after creation in this view
    });
    setIsModalOpen(true);
  };

  const promptDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setFlockToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (flockToDelete) {
      deleteFlock(flockToDelete);
      setDeleteModalOpen(false);
      setFlockToDelete(null);
    }
  };

  const handleSaveFlock = (e: React.FormEvent) => {
    e.preventDefault();
    
    const initialAgeVal = parseInt(formData.initialAge) || 0;
    const currentAge = calculateCurrentAge(formData.placementDate, initialAgeVal);
    const count = parseInt(formData.initialCount) || 0;

    if (editingId) {
      // Update
      updateFlock(editingId, {
        name: formData.name,
        breed: formData.breed,
        house: formData.house,
        startDate: formData.placementDate,
        initialAge: initialAgeVal,
        ageInDays: currentAge,
        type: formData.type,
        status: formData.status
      });
    } else {
      // Create
      const newFlockId = `F00${flocks.length + 1 + Math.floor(Math.random() * 100)}`;
      const flock: Flock = {
        id: newFlockId,
        name: formData.name,
        breed: formData.breed,
        house: formData.house,
        initialCount: count,
        currentCount: count,
        startDate: formData.placementDate,
        initialAge: initialAgeVal,
        ageInDays: currentAge,
        status: 'ACTIVE',
        type: formData.type,
        sickCount: 0
      };
      addFlock(flock);

      // Link to Financials: Log Bird Purchase Expense
      const cost = parseFloat(formData.costOfBirds);
      if (cost > 0) {
          addTransaction({
              id: `EXP-BIRDS-${Date.now()}`,
              date: formData.placementDate,
              description: `Livestock Purchase: ${formData.name} (${count} birds)`,
              amount: cost,
              type: 'EXPENSE',
              category: 'LIVESTOCK',
              status: 'COMPLETED',
              referenceId: newFlockId
          });
      }
    }

    setIsModalOpen(false);
    resetForm();
  };

  // --- Daily Log Modal Logic ---

  const openDailyLogModal = (e: React.MouseEvent, flock: Flock) => {
    e.stopPropagation();
    setActiveFlockForLog(flock);
    setDailyLogForm({
      mortality: '',
      causeOfDeath: '',
      feedType: '',
      feedQuantity: '',
      water: '',
      weight: '',
      notes: ''
    });
    setIsDailyLogModalOpen(true);
  };

  const handleSaveDailyLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlockForLog) return;

    // 1. Mortality Logic
    const mortalityNum = parseInt(dailyLogForm.mortality) || 0;
    if (mortalityNum > 0) {
        if (mortalityNum > activeFlockForLog.currentCount) {
            alert(`Error: Mortality count (${mortalityNum}) cannot exceed current flock population (${activeFlockForLog.currentCount}).`);
            return;
        }

        // Update Flock Population
        updateFlock(activeFlockForLog.id, {
            currentCount: activeFlockForLog.currentCount - mortalityNum
        });

        // Add Health Record for Mortality
        addHealthRecord({
            id: `H-MORT-${Date.now()}`,
            flockId: activeFlockForLog.id,
            date: new Date().toISOString().split('T')[0],
            type: 'MORTALITY',
            diagnosis: dailyLogForm.causeOfDeath || 'Unspecified',
            mortality: mortalityNum,
            status: 'COMPLETED',
            veterinarian: 'Farm Staff',
            details: dailyLogForm.notes ? `Daily Log Note: ${dailyLogForm.notes}` : undefined
        });
    }

    // 2. Feed Logic
    const feedQtyKg = parseFloat(dailyLogForm.feedQuantity) || 0;
    const feedId = dailyLogForm.feedType;

    if (feedId && feedQtyKg > 0) {
      const item = inventoryItems.find(i => i.id === feedId);
      if (item) {
        // Handle Unit Conversion (Bags vs Kg)
        const isBag = item.unit.toLowerCase().includes('bag');
        // Assumption: A bag is 50kg. If unit is 'kg', ratio is 1.
        const conversionRatio = isBag ? 50 : 1;
        const quantityToDeduct = feedQtyKg / conversionRatio;
        
        // Deduct Stock
        adjustStock(feedId, -quantityToDeduct);

        // Log Consumption
        const price = item.pricePerUnit || 0;
        const estimatedCost = quantityToDeduct * price;

        logConsumption({
          id: `C-${Date.now()}`,
          flockId: activeFlockForLog.id,
          feedItemId: item.id,
          quantity: feedQtyKg,
          date: new Date().toISOString().split('T')[0],
          cost: estimatedCost
        });
      }
    }

    alert(`Daily Log saved for ${activeFlockForLog.name}!\n${mortalityNum > 0 ? `Population reduced by ${mortalityNum}.` : ''}\nInventory updated.`);
    setIsDailyLogModalOpen(false);
    setActiveFlockForLog(null);
  };

  // --- Quick Action Handlers ---

  const openQuickAction = (flock: Flock, type: 'FEED' | 'HEALTH') => {
    setActiveFlock(flock);
    setActionType(type);
    setQuickForm({ value1: '', value2: '', notes: '' });
  };
  
  const openEggAction = (flock: Flock) => {
    setActiveFlock(flock);
    setEggForm({ trays: '', loose: '', damaged: '' });
    setIsEggModalOpen(true);
  };

  const openQuarantineAction = (flock: Flock) => {
    setActiveFlock(flock);
    setQuarantineForm({ count: '', reason: '', notes: '' });
    setIsQuarantineModalOpen(true);
  };

  const closeQuickAction = () => {
    setActiveFlock(null);
    setActionType(null);
    setIsEggModalOpen(false);
    setIsQuarantineModalOpen(false);
  };

  const handleSubmitQuickAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlock) return;

    if (actionType === 'FEED') {
        const feedQtyKg = parseFloat(quickForm.value1) || 0;
        const feedId = quickForm.value2;

        if (feedId && feedQtyKg > 0) {
            const item = inventoryItems.find(i => i.id === feedId);
            if (item) {
                // Handle Unit Conversion Logic
                const isBag = item.unit.toLowerCase().includes('bag');
                const conversionRatio = isBag ? 50 : 1; 
                const quantityToDeduct = feedQtyKg / conversionRatio;
                
                // Deduct
                adjustStock(feedId, -quantityToDeduct);
                
                // Log Consumption
                const price = item.pricePerUnit || 0;
                const estimatedCost = quantityToDeduct * price;
                
                logConsumption({
                    id: `QC-${Date.now()}`,
                    flockId: activeFlock.id,
                    feedItemId: item.id,
                    quantity: feedQtyKg,
                    date: new Date().toISOString().split('T')[0],
                    cost: estimatedCost
                });
            }
        }
    }
    
    closeQuickAction();
  };

  const handleSubmitEggAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlock) return;

    const trays = parseInt(eggForm.trays || '0');
    const loose = parseInt(eggForm.loose || '0');
    const damaged = parseInt(eggForm.damaged || '0');
    const totalGood = (trays * 30) + loose;

    if (totalGood === 0 && damaged === 0) return;

    const itemGeneric = inventoryItems.find(i => i.category === 'PRODUCE' && i.name.includes('Large'));
    const collectedItems = [];
    
    if (itemGeneric && totalGood > 0) {
        adjustStock(itemGeneric.id, totalGood);
        collectedItems.push({ inventoryItemId: itemGeneric.id, quantity: totalGood });
    }

    const log: EggCollectionLog = {
        id: `QC-EGG-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        flockId: activeFlock.id,
        timeOfDay: 'MORNING', // Default
        collectedItems,
        damagedCount: damaged,
        totalGoodEggs: totalGood,
        recordedBy: 'Quick Action'
    };

    logEggCollection(log);
    closeQuickAction();
    alert(`Egg collection recorded for ${activeFlock.name}!\nAdded ${totalGood} eggs to inventory.`);
  };

  const handleSubmitQuarantine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlock) return;

    const count = parseInt(quarantineForm.count);
    if (!count || count <= 0) return;
    
    if (count > activeFlock.currentCount) {
      alert("Cannot quarantine more birds than currently active.");
      return;
    }

    // 1. Update Flock Counts
    updateFlock(activeFlock.id, {
      currentCount: activeFlock.currentCount - count,
      sickCount: (activeFlock.sickCount || 0) + count
    });

    // 2. Log Health Record
    const healthRecord: HealthRecord = {
      id: `H-ISO-${Date.now()}`,
      flockId: activeFlock.id,
      date: new Date().toISOString().split('T')[0],
      type: 'ISOLATION',
      diagnosis: quarantineForm.reason || 'Sick Isolation',
      details: `${quarantineForm.notes}. Isolated ${count} birds.`,
      mortality: 0,
      status: 'PENDING',
      veterinarian: 'Staff'
    };
    
    addHealthRecord(healthRecord);

    closeQuickAction();
    alert(`Isolated ${count} birds from ${activeFlock.name} to quarantine.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Flock Management</h2>
          <p className="text-slate-500">Track and manage biological production units.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={handleSelectAll}
             className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-semibold shadow-sm transition-all"
           >
             {selectedFlockIds.length === flocks.length && flocks.length > 0 ? 'Deselect All' : 'Select All'}
           </button>
           <button 
            onClick={handleOpenCreate}
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2"
          >
            <span>+</span> Add New Batch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flocks.map((flock) => {
          const displayAge = calculateCurrentAge(flock.startDate, flock.initialAge || 0);
          const isSelected = selectedFlockIds.includes(flock.id);
          
          return (
            <div 
              key={flock.id} 
              onClick={() => navigate(`/flock/${flock.id}`)}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden group transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 relative ${isSelected ? 'border-teal-500 ring-2 ring-teal-500 ring-offset-2' : 'border-slate-100 hover:border-teal-200'}`}
            >
              <div className={`h-2 w-full ${flock.type === 'BROILER' ? 'bg-amber-500' : 'bg-teal-500'}`}></div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3 items-start">
                    {/* Checkbox for Selection */}
                    <div 
                      onClick={(e) => toggleSelection(e, flock.id)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors cursor-pointer z-20 ${isSelected ? 'bg-teal-500 border-teal-500' : 'border-slate-300 hover:border-teal-400 bg-white'}`}
                    >
                      {isSelected && <span className="text-white font-bold text-sm">✓</span>}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-teal-700 transition-colors">{flock.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">{flock.id}</p>
                    </div>
                  </div>
                  
                  {/* CRUD Actions Menu */}
                  <div className="flex items-center gap-2">
                     <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        flock.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 
                        flock.status === 'DEPLETED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {flock.status}
                      </span>
                      <div className="flex gap-1 ml-1 relative z-10">
                          <button 
                            onClick={(e) => handleOpenEdit(e, flock)}
                            type="button"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                            title="Edit Flock"
                          >
                             ✎
                          </button>
                          <button 
                            onClick={(e) => promptDelete(e, flock.id)}
                            type="button"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete Flock"
                          >
                             🗑
                          </button>
                      </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Breed</span>
                    <span className="font-semibold">{flock.breed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Current Age</span>
                    <span className="font-semibold text-teal-600">{displayAge} Days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">House</span>
                    <span className="font-semibold">{flock.house}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-50">
                     <div className="flex justify-between text-xs text-slate-400 mb-1">
                       <span>Population Survival</span>
                       <span>{Math.round((flock.currentCount / flock.initialCount) * 100)}%</span>
                     </div>
                     <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                       <div 
                         className="bg-emerald-500 h-full transition-all duration-1000" 
                         style={{ width: `${(flock.currentCount / flock.initialCount) * 100}%` }}
                       ></div>
                     </div>
                     <div className="flex justify-between text-sm mt-3 font-bold">
                       <span className="text-slate-700">{flock.currentCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">birds</span></span>
                       {flock.sickCount && flock.sickCount > 0 ? (
                           <span className="text-amber-600 bg-amber-50 px-2 rounded-md text-xs flex items-center gap-1">
                               <span>⚠️</span> {flock.sickCount} Sick
                           </span>
                       ) : null}
                     </div>
                  </div>
                </div>
                
                {/* Main Action Buttons */}
                <div className="mt-6 flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/flock/${flock.id}`); }}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-100"
                  >
                    Details
                  </button>
                  <button 
                    onClick={(e) => openDailyLogModal(e, flock)}
                    className="flex-1 bg-teal-50 hover:bg-teal-100 text-teal-700 py-2 rounded-lg text-sm font-medium transition-colors border border-teal-100"
                  >
                    Daily Entry
                  </button>
                </div>

                {/* Quick Actions Row */}
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center relative z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions</span>
                    <div className="flex gap-2">
                        {flock.type === 'LAYER' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEggAction(flock); }} 
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors" 
                              title="Log Egg Collection"
                            >
                              🥚
                            </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); openQuickAction(flock, 'FEED'); }} 
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-colors" 
                          title="Log Feed"
                        >
                          🌾
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openQuarantineAction(flock); }} 
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 transition-colors" 
                          title="Quarantine Sick Birds"
                        >
                          🚑
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openQuickAction(flock, 'HEALTH'); }} 
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors" 
                          title="Health Issue"
                        >
                          🩺
                        </button>
                    </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ... (Bulk Action Modal, CRUD Modal, Delete Modal remain same) ... */}
      
      {/* Bulk Action Floating Bar */}
      {selectedFlockIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-5">
           <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
              <span className="bg-teal-500 text-teal-950 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">{selectedFlockIds.length}</span>
              <span className="font-bold text-sm">Selected</span>
           </div>
           <div className="flex items-center gap-3">
              <button 
                onClick={() => initiateBulkAction('QUARANTINE')}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-sm transition-colors flex items-center gap-2"
              >
                <span>⚠️</span> Quarantine
              </button>
              <button 
                onClick={() => initiateBulkAction('DEPLETED')}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-sm transition-colors flex items-center gap-2"
              >
                <span>🔒</span> Deplete / Close
              </button>
              <button 
                onClick={() => setSelectedFlockIds([])}
                className="px-4 py-2 rounded-xl hover:bg-slate-800 text-slate-400 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
           </div>
        </div>
      )}

      {/* CRUD Modal (Create/Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Flock Details' : 'Register New Flock'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveFlock} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Batch Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Batch-24C"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Breed</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="e.g. Cobb 500"
                    value={formData.breed}
                    onChange={e => setFormData({...formData, breed: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">House</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="e.g. House 03"
                    value={formData.house}
                    onChange={e => setFormData({...formData, house: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Count</label>
                  <input 
                    required
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="5000"
                    value={formData.initialCount}
                    onChange={e => setFormData({...formData, initialCount: e.target.value})}
                    disabled={!!editingId} // Disable editing initial count to prevent calculation errors for this simple demo
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                  >
                    <option value="BROILER">Broiler</option>
                    <option value="LAYER">Layer</option>
                  </select>
                </div>
              </div>
              
              {editingId ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select 
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                        <option value="ACTIVE">Active</option>
                        <option value="QUARANTINE">Quarantine (Full)</option>
                        <option value="DEPLETED">Depleted (Closed)</option>
                    </select>
                  </div>
              ) : (
                  <div>
                     <label className="block text-xs font-bold text-emerald-600 uppercase mb-1">Total Cost of Birds</label>
                     <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        className="w-full p-3 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="0.00"
                        value={formData.costOfBirds}
                        onChange={e => setFormData({...formData, costOfBirds: e.target.value})}
                     />
                     <p className="text-[9px] text-slate-400 mt-1">Logs a financial expense for livestock purchase.</p>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Placement Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    value={formData.placementDate}
                    onChange={e => setFormData({...formData, placementDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Age at Placement</label>
                  <input 
                    required
                    type="number" 
                    min="0"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder="0"
                    value={formData.initialAge}
                    onChange={e => setFormData({...formData, initialAge: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all">
                  {editingId ? 'Save Changes' : 'Register Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Log Modal */}
      {isDailyLogModalOpen && activeFlockForLog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlockForLog.name}</span>
                 <h3 className="text-xl font-bold text-slate-800">Daily Entry</h3>
               </div>
               <button onClick={() => setIsDailyLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <form onSubmit={handleSaveDailyLog} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Avg Weight (kg)</label>
                     <input 
                       type="number" 
                       step="0.01"
                       className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                       placeholder="1.25"
                       value={dailyLogForm.weight}
                       onChange={e => setDailyLogForm({...dailyLogForm, weight: e.target.value})}
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mortality</label>
                     <input 
                       type="number" 
                       min="0"
                       className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-red-600 font-bold"
                       placeholder="0"
                       value={dailyLogForm.mortality}
                       onChange={e => setDailyLogForm({...dailyLogForm, mortality: e.target.value})}
                     />
                     {parseInt(dailyLogForm.mortality) > 0 && activeFlockForLog && (
                         <div className="text-[10px] text-red-500 mt-1 font-medium">
                             New Count: {(activeFlockForLog.currentCount - parseInt(dailyLogForm.mortality)).toLocaleString()}
                         </div>
                     )}
                  </div>
               </div>

               {/* Cause of Death Input - Only relevant if mortality > 0 */}
               <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cause of Death</label>
                   <input 
                     type="text" 
                     className={`w-full p-3 rounded-xl border border-slate-200 outline-none transition-all ${parseInt(dailyLogForm.mortality) > 0 ? 'focus:ring-2 focus:ring-red-500' : 'bg-slate-50 text-slate-400'}`}
                     placeholder={parseInt(dailyLogForm.mortality) > 0 ? "e.g. Heat stress, Sudden death" : "N/A"}
                     value={dailyLogForm.causeOfDeath}
                     onChange={e => setDailyLogForm({...dailyLogForm, causeOfDeath: e.target.value})}
                     disabled={!dailyLogForm.mortality || parseInt(dailyLogForm.mortality) === 0}
                   />
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feed Type (Inventory)</label>
                 <select 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    value={dailyLogForm.feedType}
                    onChange={e => setDailyLogForm({...dailyLogForm, feedType: e.target.value})}
                 >
                   <option value="">Select Ration...</option>
                   {availableFeedItemsForLog.map(item => (
                     <option key={item.id} value={item.id}>
                       {item.name} ({item.quantity} {item.unit} avail)
                     </option>
                   ))}
                 </select>
                 {selectedFeedItemForLog && (
                     <p className="text-[10px] text-slate-500 mt-1 text-right">
                         In Stock: <b>{selectedFeedItemForLog.quantity} {selectedFeedItemForLog.unit}</b>
                     </p>
                 )}
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <div className="flex flex-col mb-1 gap-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Feed Qty (kg)</label>
                      {recommendedFeedTotal && recommendedFeedTotal > 0 && suggestedInventoryItem && (
                          <button
                            type="button"
                            onClick={() => setDailyLogForm({
                                ...dailyLogForm, 
                                feedQuantity: recommendedFeedTotal.toString(),
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
                     className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                     placeholder="450"
                     value={dailyLogForm.feedQuantity}
                     onChange={e => setDailyLogForm({...dailyLogForm, feedQuantity: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Water (L)</label>
                   <input 
                     type="number" 
                     className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                     placeholder="1200"
                     value={dailyLogForm.water}
                     onChange={e => setDailyLogForm({...dailyLogForm, water: e.target.value})}
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                 <textarea 
                   className="w-full p-3 rounded-xl border border-slate-200 h-20 resize-none"
                   placeholder="Any observations..."
                   value={dailyLogForm.notes}
                   onChange={e => setDailyLogForm({...dailyLogForm, notes: e.target.value})}
                 />
               </div>

               <button 
                 type="submit" 
                 className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all"
               >
                 Save Log & Update
               </button>
             </form>
          </div>
        </div>
      )}

      {/* Egg Collection Quick Action Modal */}
      {isEggModalOpen && activeFlock && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlock.name}</span>
                  <h3 className="text-lg font-bold text-slate-800">Quick Egg Collection</h3>
                </div>
                <button onClick={closeQuickAction} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">✕</button>
              </div>
              <form onSubmit={handleSubmitEggAction} className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trays (30s)</label>
                        <input 
                            type="number" 
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="0"
                            value={eggForm.trays}
                            onChange={e => setEggForm({...eggForm, trays: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loose Eggs</label>
                        <input 
                            type="number" 
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                            placeholder="0"
                            value={eggForm.loose}
                            onChange={e => setEggForm({...eggForm, loose: e.target.value})}
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-red-500 uppercase mb-1">Damaged</label>
                    <input 
                        type="number" 
                        className="w-full p-3 rounded-xl border border-red-100 focus:ring-2 focus:ring-red-500 outline-none"
                        placeholder="0"
                        value={eggForm.damaged}
                        onChange={e => setEggForm({...eggForm, damaged: e.target.value})}
                    />
                 </div>
                 <div className="text-xs text-center text-slate-400 font-medium pt-2">
                     Total Good Eggs: <span className="text-amber-600 font-bold text-sm">{((parseInt(eggForm.trays || '0') * 30) + parseInt(eggForm.loose || '0'))}</span>
                 </div>
                 <button 
                    type="submit" 
                    className="w-full py-3 rounded-xl font-bold text-white shadow-lg bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 transition-all"
                 >
                    Save Collection
                 </button>
              </form>
           </div>
         </div>
      )}

      {/* Quarantine Sick Birds Modal */}
      {isQuarantineModalOpen && activeFlock && (
         <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlock.name}</span>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">🚑 Isolate Birds</h3>
                </div>
                <button onClick={closeQuickAction} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">✕</button>
              </div>
              <form onSubmit={handleSubmitQuarantine} className="p-6 space-y-4">
                 <div>
                    <p className="text-xs text-slate-500 mb-3">Move sick birds to isolation to prevent spread. This will decrease the active healthy count.</p>
                    <label className="block text-xs font-bold text-orange-600 uppercase mb-1">Number of Sick Birds</label>
                    <input 
                        autoFocus
                        required
                        type="number" 
                        min="1"
                        max={activeFlock.currentCount}
                        className="w-full p-3 rounded-xl border border-orange-200 focus:ring-2 focus:ring-orange-500 outline-none text-lg font-bold text-orange-800"
                        placeholder="0"
                        value={quarantineForm.count}
                        onChange={e => setQuarantineForm({...quarantineForm, count: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Symptoms</label>
                    <input 
                        type="text" 
                        required
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none"
                        placeholder="e.g. Coughing, lethargic"
                        value={quarantineForm.reason}
                        onChange={e => setQuarantineForm({...quarantineForm, reason: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                    <textarea 
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none h-20 resize-none"
                        placeholder="Additional details..."
                        value={quarantineForm.notes}
                        onChange={e => setQuarantineForm({...quarantineForm, notes: e.target.value})}
                    />
                 </div>
                 <button 
                    type="submit" 
                    className="w-full py-3 rounded-xl font-bold text-white shadow-lg bg-orange-500 hover:bg-orange-600 shadow-orange-500/20 transition-all"
                 >
                    Confirm Quarantine
                 </button>
              </form>
           </div>
         </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              🗑
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Flock?</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to remove this flock? This action cannot be undone and all associated data will be archived.</p>
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
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Action Modal (Feed/Health) */}
      {activeFlock && actionType && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlock.name}</span>
                 <h3 className="text-lg font-bold text-slate-800">
                   {actionType === 'FEED' && 'Log Feed Consumption'}
                   {actionType === 'HEALTH' && 'Report Health Issue'}
                 </h3>
               </div>
               <button onClick={closeQuickAction} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">✕</button>
             </div>
             
             <form onSubmit={handleSubmitQuickAction} className="p-6 space-y-4">
               {actionType === 'FEED' && (
                 <>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Feed from Inventory</label>
                     <select 
                        required
                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                        value={quickForm.value2}
                        onChange={e => setQuickForm({...quickForm, value2: e.target.value})}
                     >
                       <option value="">Choose Feed Type...</option>
                       {availableFeedItems.map(item => (
                         <option key={item.id} value={item.id}>
                           {item.name} ({item.quantity} {item.unit} avail)
                         </option>
                       ))}
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity (kg)</label>
                     <input 
                       required
                       type="number" 
                       className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                       placeholder="0.0"
                       value={quickForm.value1}
                       onChange={e => setQuickForm({...quickForm, value1: e.target.value})}
                     />
                   </div>
                 </>
               )}

               {actionType === 'HEALTH' && (
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Symptoms / Observations</label>
                   <textarea 
                     autoFocus
                     required
                     className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                     placeholder="Describe what you see..."
                     value={quickForm.notes}
                     onChange={e => setQuickForm({...quickForm, notes: e.target.value})}
                   />
                 </div>
               )}

               <button 
                 type="submit" 
                 className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                   actionType === 'FEED' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' :
                   'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                 }`}
               >
                 Confirm {actionType === 'FEED' ? 'Entry' : 'Report'}
               </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlockManagement;
