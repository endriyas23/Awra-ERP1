import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flock, FeedConsumption, DailyLog, EggCollectionLog, HealthRecord } from '../types';
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
    addHealthRecord,
    addDailyLog,
    addItem
  } = useInventory();
  
  // CRUD Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1); // 1: Identity, 2: Logistics, 3: Financials
  
  // Daily Log Modal State
  const [isDailyLogModalOpen, setIsDailyLogModalOpen] = useState(false);
  const [activeFlockForLog, setActiveFlockForLog] = useState<Flock | null>(null);
  const [dailyLogForm, setDailyLogForm] = useState({
    mortality: '',
    causeOfDeath: '',
    water: '',
    weight: '',
    notes: '',
    feedItemId: '',
    feedQuantity: ''
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

  // Default Tax Rates
  const [defaultRates, setDefaultRates] = useState({ vat: '15' });

  useEffect(() => {
      const saved = localStorage.getItem('awra_settings');
      if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.financials) {
              setDefaultRates({
                  vat: parsed.financials.defaultVatRate?.toString() || '15'
              });
          }
      }
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    breed: '',
    house: '',
    initialCount: '',
    placementDate: new Date().toISOString().split('T')[0],
    initialAge: '0', 
    type: 'BROILER' as 'BROILER' | 'LAYER',
    status: 'ACTIVE' as 'ACTIVE' | 'DEPLETED' | 'QUARANTINE',
    pricePerBird: '',
    costOfBirds: '', // Base Cost
    costVatRate: '15', // Default VAT Rate %
    paymentStatus: 'COMPLETED' as 'COMPLETED' | 'PENDING', // Payment Status for Financials
  });

  // Handlers for bidirectional calculation
  const handlePricePerBirdChange = (value: string) => {
      const price = parseFloat(value);
      const count = parseFloat(formData.initialCount) || 0;
      
      let newTotal = formData.costOfBirds;
      if (!isNaN(price) && count > 0) {
          newTotal = (price * count).toFixed(2);
      }
      
      setFormData(prev => ({ ...prev, pricePerBird: value, costOfBirds: newTotal }));
  };

  const handleTotalCostChange = (value: string) => {
      const total = parseFloat(value);
      const count = parseFloat(formData.initialCount) || 0;
      
      let newPrice = formData.pricePerBird;
      if (!isNaN(total) && count > 0) {
          newPrice = (total / count).toFixed(2);
      }
      
      setFormData(prev => ({ ...prev, costOfBirds: value, pricePerBird: newPrice }));
  };

  // Quick Action State
  const [activeFlock, setActiveFlock] = useState<Flock | null>(null);
  const [actionType, setActionType] = useState<'HEALTH' | null>(null);
  const [quickForm, setQuickForm] = useState({ value1: '', value2: '', notes: '' });

  const navigate = useNavigate();

  // Filter for Feed Items
  const feedItems = inventoryItems.filter(item => item.category === 'FEED');

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
      pricePerBird: '',
      costOfBirds: '',
      costVatRate: defaultRates.vat,
      paymentStatus: 'COMPLETED',
    });
    setEditingId(null);
    setCurrentStep(1);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, flock: Flock) => {
    e.stopPropagation();
    setEditingId(flock.id);
    setCurrentStep(1);
    setFormData({
      name: flock.name,
      breed: flock.breed,
      house: flock.house,
      initialCount: flock.initialCount.toString(),
      placementDate: flock.startDate,
      initialAge: flock.initialAge.toString(),
      type: flock.type,
      status: flock.status,
      pricePerBird: flock.costPerBird ? flock.costPerBird.toString() : '',
      costOfBirds: flock.totalAcquisitionCost ? flock.totalAcquisitionCost.toString() : '',
      costVatRate: flock.acquisitionVatRate ? flock.acquisitionVatRate.toString() : defaultRates.vat,
      paymentStatus: 'COMPLETED', // Status not stored on flock, default for edit UI
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

    const baseCost = parseFloat(formData.costOfBirds) || 0;
    const unitCost = parseFloat(formData.pricePerBird) || (count > 0 ? baseCost / count : 0);
    const vatRate = parseFloat(formData.costVatRate) || 0;

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
        status: formData.status,
        costPerBird: unitCost,
        totalAcquisitionCost: baseCost,
        acquisitionVatRate: vatRate,
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
        sickCount: 0,
        costPerBird: unitCost,
        totalAcquisitionCost: baseCost,
        acquisitionVatRate: vatRate,
      };
      addFlock(flock);

      // Link to Financials: Log Bird Purchase Expense
      const vatAmount = baseCost * (vatRate / 100);
      const netPayable = baseCost + vatAmount;

      if (baseCost > 0) {
          addTransaction({
              id: `EXP-BIRDS-${Date.now()}`,
              date: formData.placementDate,
              description: `Livestock Purchase: ${formData.name} (${count} birds @ $${unitCost.toFixed(2)})`,
              amount: netPayable,
              vatAmount: vatAmount > 0 ? vatAmount : undefined,
              type: 'EXPENSE',
              category: 'LIVESTOCK',
              status: formData.paymentStatus, // 'COMPLETED' or 'PENDING'
              referenceId: newFlockId
          });
      }
    }

    setIsModalOpen(false);
    resetForm();
  };

  // Step Validation Logic
  const canGoNext = useMemo(() => {
    if (currentStep === 1) {
        return formData.name && formData.breed && formData.house;
    }
    if (currentStep === 2) {
        return formData.initialCount && formData.placementDate;
    }
    return true;
  }, [currentStep, formData]);

  const calculateFinancials = () => {
      const base = parseFloat(formData.costOfBirds) || 0;
      const vat = base * ((parseFloat(formData.costVatRate) || 0) / 100);
      const total = base + vat;
      return { vat, total };
  };

  const isLastStep = editingId ? currentStep === 2 : currentStep === 3;

  // --- Daily Log Modal Logic ---

  const openDailyLogModal = (e: React.MouseEvent, flock: Flock) => {
    e.stopPropagation();
    setActiveFlockForLog(flock);
    setDailyLogForm({
      mortality: '',
      causeOfDeath: '',
      water: '',
      weight: '',
      notes: '',
      feedItemId: '',
      feedQuantity: ''
    });
    setIsDailyLogModalOpen(true);
  };

  const handleSaveDailyLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlockForLog) return;

    let messages = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Mortality Logic (Critical Side-Effect)
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
            date: today,
            type: 'MORTALITY',
            diagnosis: dailyLogForm.causeOfDeath || 'Unspecified',
            mortality: mortalityNum,
            status: 'COMPLETED',
            veterinarian: 'Farm Staff',
            details: dailyLogForm.notes ? `Daily Log Note: ${dailyLogForm.notes}` : undefined
        });
        messages.push(`Recorded ${mortalityNum} mortality.`);
    }

    // 2. Feed Consumption Logic (Inventory Side-Effect)
    const feedQtyKg = parseFloat(dailyLogForm.feedQuantity) || 0;
    if (feedQtyKg > 0 && dailyLogForm.feedItemId) {
        const item = feedItems.find(i => i.id === dailyLogForm.feedItemId);
        if (item) {
            const isBag = item.unit.toLowerCase().includes('bag');
            // Conversion: If inventory is in bags, assume 1 Bag = 50kg.
            const deductionAmount = isBag ? feedQtyKg / 50 : feedQtyKg;

            if (deductionAmount > item.quantity) {
                alert(`Insufficient stock for ${item.name}. Available: ${item.quantity} ${item.unit} (approx ${(item.quantity * (isBag ? 50 : 1)).toFixed(1)} kg)`);
                return;
            }
            
            adjustStock(item.id, -deductionAmount);
            
            const consumptionRecord: FeedConsumption = {
                id: `FC-${Date.now()}`,
                flockId: activeFlockForLog.id,
                feedItemId: item.id,
                quantity: feedQtyKg,
                date: today,
                cost: (item.pricePerUnit || 0) * deductionAmount
            };
            logConsumption(consumptionRecord);
            messages.push(`Logged ${feedQtyKg}kg of ${item.name}.`);
        }
    }

    // 3. Persist Daily Log (Water, Weight, Notes)
    const dailyLogEntry: DailyLog = {
        id: `DL-${Date.now()}`,
        flockId: activeFlockForLog.id,
        date: today,
        mortality: mortalityNum,
        feedConsumed: feedQtyKg,
        waterConsumed: parseFloat(dailyLogForm.water) || 0,
        averageWeight: parseFloat(dailyLogForm.weight) || undefined,
        notes: dailyLogForm.notes
    };
    addDailyLog(dailyLogEntry);
    messages.push('Saved Daily Performance Log.');

    alert(`Daily Log saved for ${activeFlockForLog.name}!\n${messages.join('\n')}`);
    setIsDailyLogModalOpen(false);
    setActiveFlockForLog(null);
  };

  // --- Quick Action Handlers ---

  const openQuickAction = (flock: Flock, type: 'HEALTH') => {
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

    if (actionType === 'HEALTH') {
        // Simple health note logic
        addHealthRecord({
            id: `H-QUICK-${Date.now()}`,
            flockId: activeFlock.id,
            date: new Date().toISOString().split('T')[0],
            type: 'CHECKUP',
            diagnosis: 'Observation',
            details: quickForm.notes,
            mortality: 0,
            status: 'COMPLETED',
            veterinarian: 'Staff'
        });
        alert("Health observation recorded.");
    }
    
    closeQuickAction();
  };

  const handleSubmitEggAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFlock) return;

    const trays = parseInt(eggForm.trays || '0');
    const loose = parseInt(eggForm.loose || '0');
    const damaged = parseInt(eggForm.damaged || '0');
    const totalGood = (trays * 30) + loose;

    if (totalGood === 0 && damaged === 0) return;

    let itemGeneric = inventoryItems.find(i => i.category === 'PRODUCE' && i.name.includes('Large'));
    let itemId = itemGeneric?.id;
    let wasCreated = false;

    // Ensure inventory item exists for the log to attach to
    if (!itemGeneric) {
        const newItem = {
            id: `PROD-EGG-LARGE-${Date.now()}`,
            name: `Table Eggs (Large)`,
            category: 'PRODUCE' as const,
            quantity: totalGood, // Initialize with quantity
            unit: 'Pieces',
            minThreshold: 100,
            lastRestocked: new Date().toISOString().split('T')[0],
            pricePerUnit: 0.30
        };
        await addItem(newItem);
        itemId = newItem.id;
        wasCreated = true;
    }

    const collectedItems = [];
    
    if (itemId && totalGood > 0) {
        collectedItems.push({ inventoryItemId: itemId, quantity: totalGood });
        // Only adjust if we didn't just create it with the total quantity
        if (!wasCreated) {
            adjustStock(itemId, totalGood);
        }
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
                
                {/* Action Buttons */}
                <div className="mt-6 space-y-3 relative z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/flock/${flock.id}`); }}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-bold transition-colors border border-slate-200"
                  >
                    View Full Details
                  </button>

                  <div className="flex gap-2 justify-between">
                      <button 
                        onClick={(e) => openDailyLogModal(e, flock)} 
                        className="flex-1 flex items-center justify-center p-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-all border border-indigo-100"
                        title="Daily Log"
                      >
                        <span className="text-lg">📝</span>
                      </button>
                      
                      {flock.type === 'LAYER' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEggAction(flock); }} 
                            className="flex-1 flex items-center justify-center p-2 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-all border border-amber-100"
                            title="Collect Eggs"
                          >
                            <span className="text-lg">🥚</span>
                          </button>
                      )}
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); openQuarantineAction(flock); }} 
                        className="flex-1 flex items-center justify-center p-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 transition-all border border-orange-100"
                        title="Quarantine"
                      >
                        <span className="text-lg">🚑</span>
                      </button>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); openQuickAction(flock, 'HEALTH'); }} 
                        className="flex-1 flex items-center justify-center p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all border border-red-100"
                        title="Health Issue"
                      >
                        <span className="text-lg">🩺</span>
                      </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
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
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-50 font-bold text-sm transition-colors flex items-center gap-2"
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

      {/* CRUD Modal (Create/Edit) - Multi-Step Wizard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header & Stepper */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Flock Details' : 'Register New Flock'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                {/* Stepper Visualization */}
                <div className="flex items-center justify-between px-4 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10 px-8"></div>
                    {[1, 2, 3].map((step) => {
                        const isActive = currentStep >= step;
                        const isCurrent = currentStep === step;
                        const label = step === 1 ? 'Identity' : step === 2 ? 'Logistics' : 'Financials';
                        
                        // Hide Step 3 if editing (simplified view for editing)
                        if (editingId && step === 3) return null;

                        return (
                            <div key={step} className="flex flex-col items-center gap-1 bg-white px-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isActive ? 'bg-teal-600 text-white scale-110' : 'bg-slate-100 text-slate-400'}`}>
                                    {isActive ? '✓' : step}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-teal-700' : 'text-slate-400'}`}>{label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <form onSubmit={handleSaveFlock} className="flex flex-col h-[400px]">
              <div className="p-6 flex-1 overflow-y-auto">
                  {/* Step 1: Identity */}
                  {currentStep === 1 && (
                      <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
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
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                            <div className="flex gap-2">
                                {['BROILER', 'LAYER'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setFormData({...formData, type: t as any})}
                                        className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${formData.type === t ? 'bg-teal-50 border-teal-500 text-teal-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
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
                      </div>
                  )}

                  {/* Step 2: Logistics */}
                  {currentStep === 2 && (
                      <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Population</label>
                            <input 
                                required
                                type="number" 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none text-lg font-bold"
                                placeholder="5000"
                                value={formData.initialCount}
                                onChange={e => setFormData({...formData, initialCount: e.target.value})}
                                disabled={!!editingId} 
                            />
                            {editingId && <p className="text-[10px] text-amber-600 mt-1">Initial count cannot be changed after creation.</p>}
                          </div>
                          
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

                          {editingId && (
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Status</label>
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
                          )}
                      </div>
                  )}

                  {/* Step 3: Financials (Create Only) - WHT REMOVED & PAYMENT STATUS ADDED */}
                  {currentStep === 3 && !editingId && (
                      <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                          <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 border border-blue-100 mb-4">
                              <p><strong>Note:</strong> This will automatically create an expense transaction for livestock purchase.</p>
                          </div>
                          
                          <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price Per Bird ($)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                    placeholder="0.00"
                                    value={formData.pricePerBird}
                                    onChange={e => handlePricePerBirdChange(e.target.value)}
                                />
                          </div>

                          <div>
                                <label className="block text-xs font-bold text-emerald-600 uppercase mb-1">Base Cost of Birds</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                    <input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    className="w-full p-3 pl-8 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold text-slate-700"
                                    placeholder="0.00"
                                    value={formData.costOfBirds}
                                    onChange={e => handleTotalCostChange(e.target.value)}
                                    />
                                </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">VAT Rate (%)</label>
                                <input 
                                type="number" 
                                min="0"
                                step="0.1"
                                className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                                placeholder="15"
                                value={formData.costVatRate}
                                onChange={e => setFormData({...formData, costVatRate: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Status</label>
                                <select 
                                    className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                                    value={formData.paymentStatus}
                                    onChange={e => setFormData({...formData, paymentStatus: e.target.value as any})}
                                >
                                    <option value="COMPLETED">Paid (Cash/Bank)</option>
                                    <option value="PENDING">Credit (Pay Later)</option>
                                </select>
                            </div>
                          </div>

                          {/* Live Calculation Preview */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 mt-2">
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>Base:</span>
                                    <span>${(parseFloat(formData.costOfBirds) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>+ VAT:</span>
                                    <span>${calculateFinancials().vat.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-200 pt-2 mt-1">
                                    <span>Net Payable:</span>
                                    <span>${calculateFinancials().total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                          </div>
                      </div>
                  )}
              </div>

              {/* Wizard Footer - FIXED BUTTON VISIBILITY */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  {currentStep > 1 ? (
                      <button 
                        type="button" 
                        onClick={() => setCurrentStep(curr => curr - 1)}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        Back
                      </button>
                  ) : (
                      <div></div> // Spacer
                  )}

                  {isLastStep ? (
                      <button 
                        type="submit" 
                        className="px-8 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2"
                      >
                        {editingId ? 'Save Updates' : 'Finish & Create'}
                      </button>
                  ) : (
                      <button 
                        type="button" 
                        onClick={() => {
                            if (canGoNext) setCurrentStep(curr => curr + 1);
                            else alert("Please fill in all required fields before proceeding.");
                        }}
                        className={`px-8 py-2.5 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${canGoNext ? 'bg-slate-800 hover:bg-slate-900 shadow-lg' : 'bg-slate-300 cursor-not-allowed'}`}
                      >
                        Next <span>→</span>
                      </button>
                  )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Log Modal */}
      {isDailyLogModalOpen && activeFlockForLog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlockForLog.name}</span>
                 <h3 className="text-xl font-bold text-slate-800">Daily Entry</h3>
               </div>
               <button onClick={() => setIsDailyLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <form onSubmit={handleSaveDailyLog} className="p-6 space-y-4">
               {/* Vitals */}
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
                  </div>
               </div>

               {parseInt(dailyLogForm.mortality) > 0 && (
                   <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cause of Death</label>
                       <input 
                         type="text" 
                         className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                         placeholder="e.g. Sudden death"
                         value={dailyLogForm.causeOfDeath}
                         onChange={e => setDailyLogForm({...dailyLogForm, causeOfDeath: e.target.value})}
                       />
                   </div>
               )}

               {/* Feed & Water Section */}
               <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
                   <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Consumption</h4>
                   
                   <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feed Type</label>
                        <select 
                            className="w-full p-3 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-white"
                            value={dailyLogForm.feedItemId}
                            onChange={e => setDailyLogForm({...dailyLogForm, feedItemId: e.target.value})}
                        >
                            <option value="">-- Select Feed --</option>
                            {feedItems.map(item => (
                                <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>
                            ))}
                        </select>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Feed Used (kg)</label>
                            <input 
                                type="number" 
                                step="0.1"
                                min="0"
                                className="w-full p-3 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none"
                                placeholder="0.0"
                                value={dailyLogForm.feedQuantity}
                                onChange={e => setDailyLogForm({...dailyLogForm, feedQuantity: e.target.value})}
                                disabled={!dailyLogForm.feedItemId}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Water (L)</label>
                            <input 
                                type="number" 
                                className="w-full p-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="0"
                                value={dailyLogForm.water}
                                onChange={e => setDailyLogForm({...dailyLogForm, water: e.target.value})}
                            />
                        </div>
                   </div>
                   {dailyLogForm.feedItemId && (
                       <div className="text-xs text-right text-amber-700">
                           {(() => {
                               const item = feedItems.find(i => i.id === dailyLogForm.feedItemId);
                               if (item?.unit.toLowerCase().includes('bag')) {
                                   return `1 Bag = 50kg. Available: ${item.quantity} Bags (${item.quantity * 50} kg)`;
                               }
                               return `Available: ${item?.quantity} ${item?.unit}`;
                           })()}
                       </div>
                   )}
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

               <div className="pt-2">
                   <button 
                     type="submit" 
                     className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all"
                   >
                     Save Daily Log
                   </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* Quick Action Modal (Health) */}
      {activeFlock && actionType && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlock.name}</span>
                 <h3 className="text-lg font-bold text-slate-800">
                   Report Health Issue
                 </h3>
               </div>
               <button onClick={closeQuickAction} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">✕</button>
             </div>
             
             <form onSubmit={handleSubmitQuickAction} className="p-6 space-y-4">
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
                 className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
               >
                 Confirm Report
               </button>
             </form>
          </div>
        </div>
      )}

      {/* Quick Action Modal (Egg) */}
      {isEggModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
               <div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlock?.name}</span>
                 <h3 className="text-lg font-bold text-slate-800">
                   Quick Egg Log
                 </h3>
               </div>
               <button onClick={closeQuickAction} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">✕</button>
             </div>
             
             <form onSubmit={handleSubmitEggAction} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trays (30pcs)</label>
                    <input 
                      type="number"
                      min="0"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      value={eggForm.trays}
                      onChange={e => setEggForm({...eggForm, trays: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loose Eggs</label>
                    <input 
                      type="number"
                      min="0"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                      value={eggForm.loose}
                      onChange={e => setEggForm({...eggForm, loose: e.target.value})}
                      placeholder="0"
                    />
                  </div>
               </div>
               
               <div>
                 <label className="block text-xs font-bold text-red-500 uppercase mb-1">Damaged</label>
                 <input 
                   type="number"
                   min="0"
                   className="w-full p-3 rounded-xl border border-red-100 focus:ring-2 focus:ring-red-500 outline-none"
                   value={eggForm.damaged}
                   onChange={e => setEggForm({...eggForm, damaged: e.target.value})}
                   placeholder="0"
                 />
               </div>

               <div className="pt-2">
                   <div className="flex justify-between text-xs text-slate-500 mb-2 px-1">
                       <span>Total Good Eggs:</span>
                       <span className="font-bold text-amber-600">{(parseInt(eggForm.trays || '0') * 30) + parseInt(eggForm.loose || '0')}</span>
                   </div>
                   <button 
                     type="submit"
                     className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                   >
                     Confirm Collection
                   </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* Quick Action Modal (Quarantine) */}
      {isQuarantineModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
               <div>
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{activeFlock?.name}</span>
                 <h3 className="text-lg font-bold text-red-800">
                   Quarantine Action
                 </h3>
               </div>
               <button onClick={closeQuickAction} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">✕</button>
             </div>
             
             <form onSubmit={handleSubmitQuarantine} className="p-6 space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Number of Birds</label>
                 <input 
                   autoFocus
                   required
                   type="number"
                   min="1"
                   className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none text-lg font-bold"
                   value={quarantineForm.count}
                   onChange={e => setQuarantineForm({...quarantineForm, count: e.target.value})}
                   placeholder="0"
                 />
               </div>
               
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Diagnosis</label>
                 <input 
                   type="text"
                   className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                   value={quarantineForm.reason}
                   onChange={e => setQuarantineForm({...quarantineForm, reason: e.target.value})}
                   placeholder="e.g. Coughing"
                 />
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Additional Notes</label>
                 <textarea 
                   className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none h-20 resize-none"
                   value={quarantineForm.notes}
                   onChange={e => setQuarantineForm({...quarantineForm, notes: e.target.value})}
                   placeholder="Details..."
                 />
               </div>

               <button 
                 type="submit"
                 className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all bg-red-600 hover:bg-red-700 shadow-red-500/20"
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
            <p className="text-slate-500 mb-6">
              Are you sure you want to permanently delete this flock? All associated health records, feed logs, and production data will be removed.
            </p>
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

      {/* Bulk Action Confirmation Modal */}
      {bulkActionModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl ${bulkActionType === 'QUARANTINE' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                {bulkActionType === 'QUARANTINE' ? '⚠️' : '🔒'}
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                {bulkActionType === 'QUARANTINE' ? 'Quarantine Selected?' : 'Deplete Selected?'}
              </h3>
              <p className="text-slate-500 mt-2 text-sm">
                You are about to update {selectedFlockIds.length} flocks to <strong>{bulkActionType}</strong> status.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setBulkActionModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmBulkAction}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/20 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlockManagement;