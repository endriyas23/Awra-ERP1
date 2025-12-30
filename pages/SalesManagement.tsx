
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';
import { SaleRecord } from '../types';

const COLORS = ['#0f766e', '#f59e0b', '#3b82f6', '#ef4444'];

const SalesManagement: React.FC = () => {
  const { items: inventoryItems, salesRecords, addSale, adjustStock, updateSaleStatus, flocks } = useInventory();
  
  // Filter sellable items (Produce and Birds)
  const sellableItems = inventoryItems.filter(i => i.category === 'PRODUCE' || i.category === 'BIRDS');

  // States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'CREDIT' | 'CANCELLED'>('ALL');
  
  // Form State
  const [form, setForm] = useState({
    customer: '',
    date: new Date().toISOString().split('T')[0],
    itemId: '',
    quantity: '',
    pricePerUnit: '',
    vatRate: '0',
    withholdingRate: '0',
    status: 'PAID' as 'PAID' | 'PENDING',
    flockId: '' // Optional Flock Link
  });

  // --- KPI Calculations ---
  const totalRevenue = salesRecords
    .filter(s => s.status === 'PAID')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const creditOutstanding = salesRecords
    .filter(s => s.status === 'PENDING')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const totalOrders = salesRecords.length;

  // Chart Data: Revenue by Month
  const revenueTrend = useMemo(() => {
    const data: Record<string, number> = {};
    const sorted = [...salesRecords].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(s => {
        if(s.status !== 'CANCELLED') {
            const d = s.date.slice(5); 
            data[d] = (data[d] || 0) + s.totalAmount;
        }
    });
    
    return Object.keys(data).map(key => ({
        date: key,
        revenue: data[key]
    }));
  }, [salesRecords]);

  // Chart Data: Product Mix
  const productMix = useMemo(() => {
     const mix: Record<string, number> = {};
     salesRecords.forEach(s => {
         if(s.status !== 'CANCELLED') {
            const name = s.item.replace('Table Eggs', 'Eggs').replace(/[()]/g, '');
            mix[name] = (mix[name] || 0) + s.totalAmount;
         }
     });
     return Object.keys(mix).map(key => ({ name: key, value: mix[key] }));
  }, [salesRecords]);

  const filteredSales = filterStatus === 'ALL' 
    ? salesRecords 
    : filterStatus === 'CREDIT' 
      ? salesRecords.filter(s => s.status === 'PENDING')
      : salesRecords.filter(s => s.status === filterStatus);

  const calculateTotals = () => {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.pricePerUnit) || 0;
      const vatPct = parseFloat(form.vatRate) || 0;
      const whtPct = parseFloat(form.withholdingRate) || 0;

      const subtotal = qty * price;
      const vatAmount = subtotal * (vatPct / 100);
      const withholdingAmount = subtotal * (whtPct / 100);
      
      const totalAmount = subtotal + vatAmount; 
      const netReceivable = totalAmount - withholdingAmount; 

      return { subtotal, vatAmount, withholdingAmount, totalAmount, netReceivable };
  };

  const totals = calculateTotals();

  // --- Handlers ---

  const handleOpenModal = () => {
    setForm({
        customer: '',
        date: new Date().toISOString().split('T')[0],
        itemId: '',
        quantity: '',
        pricePerUnit: '',
        vatRate: '0',
        withholdingRate: '0',
        status: 'PAID',
        flockId: ''
    });
    setIsModalOpen(true);
  };

  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      const item = sellableItems.find(i => i.id === id);
      setForm({
          ...form,
          itemId: id,
          pricePerUnit: item?.pricePerUnit ? item.pricePerUnit.toString() : ''
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemId || !form.quantity) return;

    const item = sellableItems.find(i => i.id === form.itemId);
    if (!item) return;

    const qty = parseFloat(form.quantity);
    if (qty > item.quantity) {
        alert(`Insufficient Stock! Only ${item.quantity} ${item.unit} available.`);
        return;
    }

    adjustStock(item.id, -qty);

    const newSale: SaleRecord = {
        id: `S-${Date.now()}`,
        date: form.date,
        customer: form.customer,
        item: item.name,
        quantity: qty,
        unitPrice: parseFloat(form.pricePerUnit),
        subtotal: totals.subtotal,
        vatRate: parseFloat(form.vatRate),
        vatAmount: totals.vatAmount,
        withholdingRate: parseFloat(form.withholdingRate),
        withholdingAmount: totals.withholdingAmount,
        totalAmount: totals.totalAmount, 
        status: form.status === 'PENDING' ? 'PENDING' : 'PAID',
        flockId: form.flockId || undefined
    };

    addSale(newSale);
    setIsModalOpen(false);
  };

  const toggleStatus = (sale: SaleRecord) => {
      if (sale.status === 'PENDING') {
          if(confirm(`Mark payment of $${sale.totalAmount} from ${sale.customer} as received?`)) {
              updateSaleStatus(sale.id, 'PAID');
          }
      } else if (sale.status === 'PAID') {
           if(confirm(`Revert transaction status to Credit/Pending?`)) {
              updateSaleStatus(sale.id, 'PENDING');
          }
      }
  };

  const cancelOrder = (sale: SaleRecord) => {
      if (sale.status === 'CANCELLED') return;
      if (confirm(`Cancel this order? This will RESTORE ${sale.quantity} items to inventory.`)) {
          updateSaleStatus(sale.id, 'CANCELLED');
          const item = inventoryItems.find(i => i.name === sale.item);
          if (item) {
              adjustStock(item.id, sale.quantity);
          }
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Sales & Orders</h2>
          <p className="text-slate-500 mt-1">Manage customer orders, track revenue, and credit sales.</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-teal-600/20 transition-all flex items-center gap-2"
        >
          <span>💰</span> New Sale
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Revenue (Cash)" value={`$${totalRevenue.toLocaleString()}`} icon="💵" color="bg-emerald-500" trend={{value: 0, positive: true}} />
        <StatCard label="Credit Outstanding" value={`$${creditOutstanding.toLocaleString()}`} icon="⏳" color="bg-amber-500" />
        <StatCard label="Total Orders" value={totalOrders} icon="📦" color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue Trend</h3>
             <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} formatter={(value) => [`$${value}`, 'Revenue']} />
                        <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                 </ResponsiveContainer>
             </div>
          </div>

           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <h3 className="text-lg font-bold text-slate-800 mb-6">Sales Mix (by Value)</h3>
             <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={productMix} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {productMix.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                 </ResponsiveContainer>
             </div>
             <div className="flex flex-wrap gap-2 justify-center mt-2">
                 {productMix.map((entry, index) => (
                     <div key={index} className="flex items-center gap-1.5 text-xs text-slate-500">
                         <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></span>
                         {entry.name}
                     </div>
                 ))}
             </div>
          </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-slate-800">Transaction History</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                 {['ALL', 'PAID', 'CREDIT', 'CANCELLED'].map(status => (
                   <button
                     key={status}
                     onClick={() => setFilterStatus(status as any)}
                     className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterStatus === status ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     {status}
                   </button>
                 ))}
            </div>
         </div>
         
         <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Item Details</th>
                        <th className="px-6 py-4">Source Flock</th>
                        <th className="px-6 py-4">Invoice Total</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                    {filteredSales.map(sale => {
                        const flockName = flocks.find(f => f.id === sale.flockId)?.name || sale.flockId || '-';
                        return (
                        <tr key={sale.id} className={`hover:bg-slate-50 transition-colors ${sale.status === 'CANCELLED' ? 'opacity-50' : ''}`}>
                            <td className="px-6 py-4 font-medium text-slate-600">{sale.date}</td>
                            <td className="px-6 py-4 font-bold text-slate-800">{sale.customer}</td>
                            <td className="px-6 py-4">
                                <div className="text-slate-800">{sale.item}</div>
                                <div className="text-xs text-slate-400">Qty: {sale.quantity}</div>
                            </td>
                            <td className="px-6 py-4 text-xs text-teal-600 font-medium">{flockName}</td>
                            <td className="px-6 py-4 font-bold text-teal-600">${sale.totalAmount.toLocaleString()}</td>
                            <td className="px-6 py-4">
                                <span 
                                    onClick={() => toggleStatus(sale)} 
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none ${
                                        sale.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 
                                        sale.status === 'PENDING' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 
                                        'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {sale.status === 'PENDING' ? 'CREDIT' : sale.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {sale.status !== 'CANCELLED' && (
                                    <button onClick={() => cancelOrder(sale)} className="text-slate-400 hover:text-red-500 font-bold text-xs" title="Cancel Order & Restore Stock">Cancel</button>
                                )}
                            </td>
                        </tr>
                    )})}
                    {filteredSales.length === 0 && (
                        <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">No transactions found.</td></tr>
                    )}
                </tbody>
             </table>
         </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">💰 New Sale Record</h3>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Name</label>
                  <input required type="text" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="e.g. FreshMart Ltd." value={form.customer} onChange={e => setForm({...form, customer: e.target.value})} />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input required type="date" className="w-full p-3 rounded-xl border border-slate-200" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Method</label>
                    <select className="w-full p-3 rounded-xl border border-slate-200" value={form.status} onChange={e => setForm({...form, status: e.target.value as any})}>
                        <option value="PAID">Cash / Instant Payment</option>
                        <option value="PENDING">Credit / Pay Later</option>
                    </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Item</label>
                     <select required className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" value={form.itemId} onChange={handleItemSelect}>
                        <option value="">-- Product --</option>
                        {sellableItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.quantity} avail)</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source Flock (Optional)</label>
                     <select className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" value={form.flockId} onChange={e => setForm({...form, flockId: e.target.value})}>
                        <option value="">-- General Stock --</option>
                        {flocks.map(flock => <option key={flock.id} value={flock.id}>{flock.name} ({flock.type})</option>)}
                     </select>
                   </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                      <input required type="number" min="1" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price Per Unit ($)</label>
                      <input required type="number" step="0.01" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0.00" value={form.pricePerUnit} onChange={e => setForm({...form, pricePerUnit: e.target.value})} />
                   </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">VAT Rate (%)</label>
                      <input type="number" min="0" step="0.1" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0" value={form.vatRate} onChange={e => setForm({...form, vatRate: e.target.value})} />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Withholding Tax (%)</label>
                      <input type="number" min="0" step="0.1" className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0" value={form.withholdingRate} onChange={e => setForm({...form, withholdingRate: e.target.value})} />
                   </div>
               </div>
               
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                   <div className="flex justify-between text-xs text-slate-500">
                       <span>Subtotal:</span>
                       <span>${totals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                   </div>
                   <div className="flex justify-between text-xs text-slate-500 border-b border-slate-200 pb-2">
                       <span>Tax Adjustments:</span>
                       <span>${(totals.vatAmount - totals.withholdingAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                   </div>
                   <div className="flex justify-between items-center pt-1">
                       <span className="text-sm font-bold text-slate-500">Invoice Total:</span>
                       <span className="text-lg font-bold text-slate-800">${totals.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                   </div>
               </div>

               <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all">Confirm Sale</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesManagement;
