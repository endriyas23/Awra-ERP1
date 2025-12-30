
import React, { useState } from 'react';
import { InventoryItem } from '../types';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';

type InventoryAction = 'RESTOCK' | 'CONSUME' | 'ADJUST';

const InventoryManagement: React.FC = () => {
  const { items, addItem, updateItem, deleteItem, adjustStock, addTransaction } = useInventory();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FEED' | 'MEDICINE' | 'EQUIPMENT' | 'BIRDS'>('ALL');

  // Modal States
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Form States
  const [itemForm, setItemForm] = useState<Partial<InventoryItem>>({
    name: '', category: 'FEED', quantity: 0, unit: 'units', minThreshold: 10, pricePerUnit: 0
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
    if (item) {
      setSelectedItem(item);
      setItemForm({ ...item });
    } else {
      setSelectedItem(null);
      setItemForm({ name: '', category: 'FEED', quantity: 0, unit: 'units', minThreshold: 10, pricePerUnit: 0 });
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
    if (selectedItem) {
      // Update
      updateItem(selectedItem.id, itemForm);
    } else {
      // Create
      const newItem: InventoryItem = {
        id: `I${Date.now()}`, // Simple ID generation
        lastRestocked: new Date().toISOString().split('T')[0],
        ...itemForm as InventoryItem
      };
      addItem(newItem);
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
        // For absolute adjust, we calculate the difference
        adjustment = qty - selectedItem.quantity;
    }

    adjustStock(selectedItem.id, adjustment);

    // Link to Financial Module if Restocking
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

  const handleDelete = (id: string) => {
    if (isReadOnly) return;
    if (window.confirm("Are you sure you want to delete this item?")) {
      deleteItem(id);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
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

      {/* KPI Cards */}
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

      {/* Critical Stock Alerts - Suggestion System */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-3xl p-6 animate-in slide-in-from-top-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center text-xl shadow-sm">⚠️</div>
            <div>
              <h3 className="text-lg font-bold text-red-800">Restock Suggestions</h3>
              <p className="text-xs text-red-600 font-medium">The following items are critically low. Recommended actions:</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {lowStockItems.map(item => {
              const deficit = item.minThreshold - item.quantity;
              const suggestedRestock = Math.max(deficit * 2, item.minThreshold * 2); // Simple heuristic: restock to double the min
              
              return (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-800 text-sm line-clamp-1" title={item.name}>{item.name}</span>
                      <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Critical</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mb-2 bg-slate-50 p-2 rounded-lg">
                      <div className="text-center">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Current</span>
                        <span className="font-bold text-red-600 text-sm">{item.quantity}</span>
                      </div>
                      <div className="text-center border-l border-slate-200 pl-2">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Threshold</span>
                        <span className="font-bold text-slate-700 text-sm">{item.minThreshold}</span>
                      </div>
                      <div className="text-center border-l border-slate-200 pl-2">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Suggested</span>
                        <span className="font-bold text-emerald-600 text-sm">+{suggestedRestock}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                        setSelectedItem(item);
                        setStockForm({ 
                            action: 'RESTOCK', 
                            quantity: suggestedRestock, 
                            cost: item.pricePerUnit ? (suggestedRestock * item.pricePerUnit).toFixed(2) : '', 
                            notes: 'Auto-suggestion due to low stock' 
                        });
                        setIsStockModalOpen(true);
                    }}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-red-200 shadow-lg"
                  >
                    Order Restock
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-4">
          
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
             {['ALL', 'FEED', 'MEDICINE', 'EQUIPMENT', 'BIRDS'].map(cat => (
               <button
                 key={cat}
                 onClick={() => setCategoryFilter(cat as any)}
                 className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${categoryFilter === cat ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 {cat}
               </button>
             ))}
          </div>

          {/* Search */}
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

        {/* Table */}
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
                const stockPercent = Math.min(100, (item.quantity / (item.minThreshold * 4)) * 100);
                const isLow = item.quantity <= item.minThreshold;
                const value = item.quantity * (item.pricePerUnit || 0);

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
                        'bg-teal-100 text-teal-700'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className={`font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                          {item.quantity.toLocaleString()} <span className="text-slate-400 font-normal">{item.unit}</span>
                        </span>
                        {isLow && <span className="text-red-500 font-bold text-[10px] bg-white border border-red-200 px-1.5 rounded">LOW</span>}
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
                              onClick={() => handleDelete(item.id)}
                              className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-red-100 hover:text-red-600"
                              title="Delete"
                            >
                              🗑
                            </button>
                         </div>
                       )}
                       {isReadOnly && <span className="text-xs text-slate-400">View Only</span>}
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

      {/* --- Modals --- */}

      {/* 1. Item Modal (Create/Edit) */}
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
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Type</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-slate-200"
                      placeholder="bags, vials, units..."
                      value={itemForm.unit}
                      onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                    />
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

      {/* 2. Stock Adjustment Modal */}
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
                 <p className="text-2xl font-bold text-slate-800">{selectedItem.quantity} <span className="text-sm font-normal text-slate-400">{selectedItem.unit}</span></p>
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

               {/* Cost Input for Restocking */}
               {stockForm.action === 'RESTOCK' && (
                 <div>
                    <label className="block text-xs font-bold text-emerald-600 uppercase mb-1">Total Cost (Optional)</label>
                    <input 
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full p-3 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={stockForm.cost}
                        onChange={e => setStockForm({ ...stockForm, cost: e.target.value })}
                    />
                    <p className="text-[9px] text-slate-400 mt-1">Entering cost will log a financial expense.</p>
                 </div>
               )}

               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes / Reason</label>
                 <input 
                    type="text"
                    className="w-full p-3 rounded-xl border border-slate-200"
                    placeholder="e.g. Weekly delivery"
                    value={stockForm.notes}
                    onChange={e => setStockForm({ ...stockForm, notes: e.target.value })}
                 />
               </div>

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

    </div>
  );
};

export default InventoryManagement;
