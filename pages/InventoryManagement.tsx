
import React, { useState } from 'react';
import { InventoryItem } from '../types';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';

type InventoryAction = 'RESTOCK' | 'CONSUME' | 'ADJUST';

const InventoryManagement: React.FC = () => {
  const { items, addItem, updateItem, deleteItem, adjustStock, addTransaction } = useInventory();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FEED' | 'MEDICINE' | 'EQUIPMENT' | 'BIRDS' | 'PRODUCE' | 'MEAT' | 'BYPRODUCT'>('ALL');

  // Modal States
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Form States
  const [itemForm, setItemForm] = useState<any>({
    name: '', category: 'FEED', quantity: 0, unit: 'units', minThreshold: 10, pricePerUnit: 0, vatRate: '15', whtRate: '2'
  });
  
  const [stockForm, setStockForm] = useState({
    action: 'RESTOCK' as InventoryAction,
    quantity: 0,
    cost: '',
    notes: ''
  });

  // --- Access Control Logic ---
  // RBAC removed: All authenticated users have full access
  const isReadOnly = false;

  // --- Calculations ---
  const totalValue = items.reduce((sum, item) => sum + (item.quantity * (item.pricePerUnit || 0)), 0);
  const lowStockItems = items.filter(i => i.quantity <= i.minThreshold);
  const lowStockCount = lowStockItems.length;
  const totalSKUs = items.length;

  const filteredItems = items.filter(item => {
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // --- Handlers ---

  const handleOpenItemModal = (item?: InventoryItem) => {
    if (isReadOnly) return;
    
    // Load defaults from settings if available
    let defaultVat = '15';
    let defaultWht = '2';
    const saved = localStorage.getItem('awra_settings');
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.financials) {
            defaultVat = parsed.financials.defaultVatRate?.toString() || '15';
            defaultWht = parsed.financials.defaultWhtRate?.toString() || '2';
        }
    }

    if (item) {
      setSelectedItem(item);
      setItemForm({ ...item, vatRate: '0', whtRate: '0' }); // Reset tax rates for edit mode as they apply to transaction
    } else {
      setSelectedItem(null);
      setItemForm({ name: '', category: 'FEED', quantity: 0, unit: 'units', minThreshold: 10, pricePerUnit: 0, vatRate: defaultVat, whtRate: defaultWht });
    }
    setIsItemModalOpen(true);
  };

  const handleOpenStockModal = (item: InventoryItem) => {
    if (isReadOnly) return;
    setSelectedItem(item);
    setStockForm({ action: 'RESTOCK', quantity: 0, cost: '', notes: '' });
    setIsStockModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    // Destructure to separate item data from transaction data
    const { vatRate, whtRate, ...formDataRaw } = itemForm;

    if (selectedItem) {
      // Update: Strip ID to prevent PK conflicts
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...cleanUpdates } = formDataRaw;
      updateItem(selectedItem.id, cleanUpdates);
    } else {
      // Duplicate Check
      const exists = items.some(i => i.name.toLowerCase() === formDataRaw.name.toLowerCase());
      if (exists) {
          alert('An item with this name already exists.');
          return;
      }

      // Create
      const newItemId = `I${Date.now()}`;
      const newItem: InventoryItem = {
        id: newItemId,
        lastRestocked: new Date().toISOString().split('T')[0],
        ...formDataRaw as InventoryItem
      };
      addItem(newItem);

      // Create transaction for initial stock cost
      const qty = Number(formDataRaw.quantity) || 0;
      const price = Number(formDataRaw.pricePerUnit) || 0;
      const vRate = parseFloat(vatRate) || 0;
      const wRate = parseFloat(whtRate) || 0;
      
      if (qty > 0 && price > 0 && !['PRODUCE', 'MEAT', 'BYPRODUCT'].includes(formDataRaw.category)) {
          const baseCost = qty * price;
          const vatAmount = baseCost * (vRate / 100);
          const whtAmount = baseCost * (wRate / 100);
          const totalCost = baseCost + vatAmount - whtAmount;

          addTransaction({
              id: `EXP-INIT-${newItemId}`,
              date: new Date().toISOString().split('T')[0],
              description: `Initial Inventory Purchase: ${formDataRaw.name} (${qty} ${formDataRaw.unit})`,
              amount: totalCost,
              vatAmount: vatAmount > 0 ? vatAmount : undefined,
              withholdingAmount: whtAmount > 0 ? whtAmount : undefined,
              type: 'EXPENSE',
              category: formDataRaw.category === 'FEED' ? 'FEED' : formDataRaw.category === 'MEDICINE' ? 'MEDICINE' : 'MAINTENANCE',
              status: 'COMPLETED',
              referenceId: newItemId
          });
      }
    }
    setIsItemModalOpen(false);
  };

  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || isReadOnly) return;

    const qty = Number(stockForm.quantity);
    if (qty <= 0) return;

    let adjustment = 0;
    if (stockForm.action === 'RESTOCK') adjustment = qty;
    else if (stockForm.action === 'CONSUME') adjustment = -qty;
    else if (stockForm.action === 'ADJUST') {
        adjustment = qty - selectedItem.quantity;
    }

    adjustStock(selectedItem.id, adjustment);

    if (stockForm.action === 'RESTOCK' && stockForm.cost) {
       const cost = parseFloat(stockForm.cost);
       if (cost > 0) {
           addTransaction({
               id: `EXP-INV-${Date.now()}`,
               date: new Date().toISOString().split('T')[0],
               description: `Inventory Restock: ${selectedItem.name} (${qty} ${selectedItem.unit})`,
               amount: cost,
               type: 'EXPENSE',
               category: selectedItem.category === 'FEED' ? 'FEED' : selectedItem.category === 'MEDICINE' ? 'MEDICINE' : 'MAINTENANCE',
               status: 'COMPLETED',
               referenceId: selectedItem.id
           });
       }
    }

    setIsStockModalOpen(false);
  };

  const promptDelete = (id: string) => {
    if (isReadOnly) return;
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Inventory Management</h2>
          <p className="text-slate-500 mt-1">Track assets, feed, medicine, and equipment across the farm.</p>
        </div>
        {!isReadOnly && (
          <button 
            onClick={() => handleOpenItemModal()}
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2"
          >
            <span>+</span> Add New Item
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            label="Total Inventory Value" 
            value={`$${totalValue.toLocaleString()}`} 
            icon="💰" 
            color="bg-emerald-500" 
        />
        <StatCard 
            label="Low Stock Alerts" 
            value={lowStockCount} 
            icon="⚠️" 
            color={lowStockCount > 0 ? "bg-red-500" : "bg-slate-500"} 
        />
        <StatCard 
            label="Total SKUs" 
            value={totalSKUs} 
            icon="📦" 
            color="bg-blue-500" 
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
             {['ALL', 'FEED', 'MEDICINE', 'EQUIPMENT', 'BIRDS', 'PRODUCE', 'MEAT', 'BYPRODUCT'].map(cat => (
               <button
                 key={cat}
                 onClick={() => setCategoryFilter(cat as any)}
                 className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${categoryFilter === cat ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 {cat}
               </button>
             ))}
          </div>

          <div className="relative w-full lg:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Item Details</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 w-1/4">Stock Level</th>
                <th className="px-6 py-4">Unit Price</th>
                <th className="px-6 py-4">Total Value</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredItems.map(item => {
                const stockPercent = item.minThreshold > 0 ? Math.min(100, (item.quantity / (item.minThreshold * 4)) * 100) : 100;
                const isLow = item.quantity <= item.minThreshold;
                const value = item.quantity * (item.pricePerUnit || 0);
                const isBag = item.unit.toLowerCase().includes('bag');
                const kgValue = isBag ? item.quantity * 50 : null;

                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors group ${
                        isLow 
                        ? 'bg-red-50/30 border-l-4 border-l-red-500' 
                        : 'hover:bg-slate-50/80 border-l-4 border-transparent'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{item.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                        item.category === 'FEED' ? 'bg-amber-100 text-amber-700' :
                        item.category === 'MEDICINE' ? 'bg-red-100 text-red-700' :
                        item.category === 'EQUIPMENT' ? 'bg-blue-100 text-blue-700' :
                        item.category === 'PRODUCE' ? 'bg-emerald-100 text-emerald-700' :
                        item.category === 'MEAT' ? 'bg-pink-100 text-pink-700' :
                        item.category === 'BYPRODUCT' ? 'bg-gray-100 text-gray-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-between items-start text-xs mb-1.5">
                        <div className="flex flex-col">
                            <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                              {item.quantity.toLocaleString()} <span className="text-slate-400 font-normal">{item.unit}</span>
                            </span>
                            {kgValue !== null && (
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                    ≈ {kgValue.toLocaleString()} kg
                                </span>
                            )}
                        </div>
                        {isLow && <span className="text-red-500 font-bold text-[10px] bg-white border border-red-200 px-1.5 py-0.5 rounded">LOW</span>}
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                           className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-teal-500'}`}
                           style={{ width: `${stockPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-1">Min Threshold: {item.minThreshold}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      ${item.pricePerUnit?.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                       {!isReadOnly && (
                         <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenStockModal(item)}
                              className="p-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 font-bold text-xs"
                              title="Adjust Stock"
                            >
                              Adjust
                            </button>
                            <button 
                              onClick={() => handleOpenItemModal(item)}
                              className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"
                              title="Edit Details"
                            >
                              ✎
                            </button>
                            <button 
                              onClick={() => promptDelete(item.id)}
                              className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-red-100 hover:text-red-600"
                              title="Delete"
                            >
                              🗑
                            </button>
                         </div>
                       )}
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    No items found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isItemModalOpen && !isReadOnly && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">{selectedItem ? 'Edit Item' : 'Add New Inventory Item'}</h3>
              <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                      value={itemForm.name}
                      onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                      value={itemForm.category}
                      onChange={e => setItemForm({ ...itemForm, category: e.target.value as any })}
                    >
                      <option value="FEED">Feed</option>
                      <option value="MEDICINE">Medicine</option>
                      <option value="EQUIPMENT">Equipment</option>
                      <option value="BIRDS">Birds</option>
                      <option value="PRODUCE">Produce (Eggs)</option>
                      <option value="MEAT">Meat</option>
                      <option value="BYPRODUCT">Byproduct</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Type</label>
                    <input 
                      type="text" 
                      list="unitOptions"
                      className="w-full p-3 rounded-xl border border-slate-200"
                      placeholder="bags, vials, kg..."
                      value={itemForm.unit}
                      onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                    />
                    <datalist id="unitOptions">
                      <option value="bags" />
                      <option value="kg" />
                      <option value="liters" />
                      <option value="vials" />
                      <option value="pieces" />
                      <option value="bottles" />
                      <option value="cartons" />
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Stock</label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={itemForm.quantity}
                      onChange={e => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Threshold</label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={itemForm.minThreshold}
                      onChange={e => setItemForm({ ...itemForm, minThreshold: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price Per Unit ($)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="w-full p-3 rounded-xl border border-slate-200"
                      value={itemForm.pricePerUnit}
                      onChange={e => setItemForm({ ...itemForm, pricePerUnit: Number(e.target.value) })}
                    />
                  </div>
              </div>
              <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg mt-2 hover:bg-slate-700 transition-all">
                {selectedItem ? 'Update Item' : 'Create Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isStockModalOpen && selectedItem && !isReadOnly && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <h3 className="text-lg font-bold text-slate-800">Adjust Stock</h3>
                 <p className="text-xs text-slate-400">{selectedItem.name}</p>
               </div>
               <button onClick={() => setIsStockModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             <form onSubmit={handleStockAdjustment} className="p-6 space-y-4">
               <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                 {(['RESTOCK', 'CONSUME', 'ADJUST'] as const).map(action => (
                   <button
                     key={action}
                     type="button"
                     onClick={() => setStockForm({ ...stockForm, action })}
                     className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${stockForm.action === action 
                       ? (action === 'RESTOCK' ? 'bg-teal-500 text-white' : action === 'CONSUME' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white') 
                       : 'text-slate-500 hover:bg-slate-200'}`}
                   >
                     {action}
                   </button>
                 ))}
               </div>

               <div className="text-center py-2">
                 <p className="text-xs text-slate-400 uppercase font-bold">Current Stock</p>
                 <p className="text-2xl font-bold text-slate-800">
                    {selectedItem.quantity} <span className="text-sm font-normal text-slate-400">{selectedItem.unit}</span>
                 </p>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                   {stockForm.action === 'RESTOCK' ? 'Quantity to Add' : stockForm.action === 'CONSUME' ? 'Quantity to Remove' : 'New Total Quantity'}
                 </label>
                 <input 
                    autoFocus
                    required
                    type="number"
                    min="1"
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none text-center text-lg font-bold"
                    value={stockForm.quantity}
                    onChange={e => setStockForm({ ...stockForm, quantity: Number(e.target.value) })}
                 />
               </div>

               {stockForm.action === 'RESTOCK' && (
                 <div>
                    <label className="block text-xs font-bold text-emerald-600 uppercase mb-1">Total Net Expense (Optional)</label>
                    <input 
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full p-3 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={stockForm.cost}
                        onChange={e => setStockForm({ ...stockForm, cost: e.target.value })}
                    />
                 </div>
               )}

               <button 
                 type="submit" 
                 className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                   stockForm.action === 'RESTOCK' ? 'bg-teal-600 hover:bg-teal-700' : 
                   stockForm.action === 'CONSUME' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-800 hover:bg-slate-900'
                 }`}
               >
                 Confirm Adjustment
               </button>
             </form>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Item?</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to permanently remove this item from inventory?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
