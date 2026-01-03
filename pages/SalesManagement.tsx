
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { useInventory } from '../context/InventoryContext';
import { SaleRecord, Customer, CustomerType, SaleStatus, InventoryItem } from '../types';

const COLORS = ['#0f766e', '#f59e0b', '#3b82f6', '#ef4444'];

const CUSTOMER_TYPES: {value: CustomerType, label: string}[] = [
    { value: 'INDIVIDUAL', label: 'Individual' },
    { value: 'RETAILER', label: 'Retailer' },
    { value: 'WHOLESALER', label: 'Wholesaler' },
    { value: 'HOTEL', label: 'Hotel / Restaurant' }
];

const SalesManagement: React.FC = () => {
  const { 
    items: inventoryItems, 
    salesRecords, 
    addSale, 
    updateSale, 
    deleteSale, 
    adjustStock, 
    flocks,
    updateFlock,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addItem, 
    updateItem 
  } = useInventory();
  
  // Filter sellable items
  const sellableItems = inventoryItems.filter(i => 
      ['PRODUCE', 'BIRDS', 'MEAT', 'BYPRODUCT'].includes(i.category)
  );

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'CUSTOMERS' | 'PRODUCTS'>('ORDERS');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<SaleStatus | 'ALL'>('ALL');
  
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Customer Detail View State
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Product Management State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
      name: '',
      category: 'PRODUCE' as 'PRODUCE' | 'BIRDS' | 'MEAT' | 'BYPRODUCT',
      unit: '',
      price: '',
      stock: ''
  });

  const [defaultRates, setDefaultRates] = useState({ vat: 15, wht: 2 });

  const [orderForm, setOrderForm] = useState({
    customerId: '',
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    itemId: '',
    quantity: '',
    pricePerUnit: '',
    vatRate: '15',
    withholdingRate: '2',
    status: 'DRAFT' as SaleStatus,
    flockId: ''
  });

  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
      name: '',
      type: 'INDIVIDUAL',
      phone: '',
      email: '',
      taxId: '',
      address: '',
      creditLimit: 0,
      status: 'ACTIVE'
  });

  useEffect(() => {
      const saved = localStorage.getItem('awra_settings');
      if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.financials) {
              setDefaultRates({
                  vat: parsed.financials.defaultVatRate || 15,
                  wht: parsed.financials.defaultWhtRate || 2
              });
          }
      }
  }, []);

  const totalRevenue = salesRecords
    .filter(s => s.status === 'PAID')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const pendingInvoices = salesRecords
    .filter(s => s.status === 'INVOICED' || s.status === 'DISPATCHED')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const draftValue = salesRecords
    .filter(s => s.status === 'DRAFT' || s.status === 'CONFIRMED')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  const revenueTrend = useMemo(() => {
    const data: Record<string, number> = {};
    const sorted = [...salesRecords].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sorted.forEach(s => {
        if(s.status !== 'CANCELLED' && s.status !== 'DRAFT') {
            const d = s.date.slice(5); 
            data[d] = (data[d] || 0) + s.totalAmount;
        }
    });
    return Object.keys(data).map(key => ({ date: key, revenue: data[key] }));
  }, [salesRecords]);

  const productMix = useMemo(() => {
     const mix: Record<string, number> = {};
     salesRecords.forEach(s => {
         if(s.status !== 'CANCELLED' && s.status !== 'DRAFT') {
            const name = s.item.replace('Table Eggs', 'Eggs').replace(/[()]/g, '');
            mix[name] = (mix[name] || 0) + s.totalAmount;
         }
     });
     return Object.keys(mix).map(key => ({ name: key, value: mix[key] }));
  }, [salesRecords]);

  const filteredOrders = filterStatus === 'ALL' 
    ? salesRecords 
    : salesRecords.filter(s => s.status === filterStatus);

  const filteredCustomers = useMemo(() => {
      return customers.filter(c => 
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
          c.phone.includes(customerSearch)
      );
  }, [customers, customerSearch]);

  const getPriceForCustomer = (itemId: string, customerId: string) => {
      const item = sellableItems.find(i => i.id === itemId);
      if (!item) return 0;
      
      const basePrice = item.pricePerUnit || 0;
      const customer = customers.find(c => c.id === customerId);
      
      if (!customer) return basePrice;

      switch (customer.type) {
          case 'WHOLESALER': return basePrice * 0.90;
          case 'RETAILER': return basePrice * 0.95;
          case 'HOTEL': return basePrice * 0.98;
          default: return basePrice;
      }
  };

  const calculateOrderTotals = () => {
      const qty = parseFloat(orderForm.quantity) || 0;
      const price = parseFloat(orderForm.pricePerUnit) || 0;
      const vatPct = parseFloat(orderForm.vatRate) || 0;
      const whtPct = parseFloat(orderForm.withholdingRate) || 0;

      const subtotal = qty * price;
      const vatAmount = subtotal * (vatPct / 100);
      const withholdingAmount = subtotal * (whtPct / 100);
      const invoiceTotal = subtotal + vatAmount; 
      
      return { subtotal, vatAmount, withholdingAmount, invoiceTotal };
  };

  const totals = calculateOrderTotals();

  // --- Handlers ---

  const handleOpenProductModal = (product?: InventoryItem) => {
      if (product) {
          setEditingProductId(product.id);
          setProductForm({
              name: product.name,
              category: product.category as any,
              unit: product.unit,
              price: product.pricePerUnit?.toString() || '',
              stock: product.quantity.toString()
          });
      } else {
          setEditingProductId(null);
          setProductForm({ name: '', category: 'PRODUCE', unit: '', price: '', stock: '' });
      }
      setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
      e.preventDefault();
      const itemData: any = {
          name: productForm.name,
          category: productForm.category,
          unit: productForm.unit,
          quantity: parseFloat(productForm.stock) || 0,
          pricePerUnit: parseFloat(productForm.price) || 0,
          minThreshold: 10, // Default for now
          lastRestocked: new Date().toISOString().split('T')[0]
      };

      if (editingProductId) {
          updateItem(editingProductId, itemData);
      } else {
          addItem({
              id: `P-${Date.now()}`,
              ...itemData
          });
      }
      setIsProductModalOpen(false);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingCustomerId) {
          updateCustomer(editingCustomerId, customerForm);
      } else {
          const newCus: Customer = {
              id: `C-${Date.now()}`,
              joinedDate: new Date().toISOString().split('T')[0],
              status: customerForm.status || 'ACTIVE',
              name: customerForm.name!,
              type: customerForm.type || 'INDIVIDUAL',
              contactPerson: customerForm.contactPerson || customerForm.name!,
              phone: customerForm.phone || '',
              email: customerForm.email,
              taxId: customerForm.taxId,
              address: customerForm.address,
              creditLimit: Number(customerForm.creditLimit) || 0
          };
          addCustomer(newCus);
      }
      setIsCustomerModalOpen(false);
  };

  const openEditCustomer = (c: Customer) => {
      setEditingCustomerId(c.id);
      setCustomerForm(c);
      setIsCustomerModalOpen(true);
  };

  const openNewCustomer = () => {
      setEditingCustomerId(null);
      setCustomerForm({ name: '', type: 'INDIVIDUAL', phone: '', email: '', taxId: '', address: '', creditLimit: 0, status: 'ACTIVE' });
      setIsCustomerModalOpen(true);
  };

  const handleDeleteCustomer = (id: string) => {
      if(confirm('Delete customer? History will remain but they will be removed from lists.')) {
          deleteCustomer(id);
      }
  };

  const handleOpenOrderModal = () => {
    setEditingOrderId(null);
    setOrderForm({
        customerId: '',
        customerName: '',
        date: new Date().toISOString().split('T')[0],
        itemId: '',
        quantity: '',
        pricePerUnit: '',
        vatRate: defaultRates.vat.toString(),
        withholdingRate: defaultRates.wht.toString(),
        status: 'DRAFT',
        flockId: ''
    });
    setIsOrderModalOpen(true);
  };

  const handleEditOrder = (e: React.MouseEvent, sale: SaleRecord) => {
    e.stopPropagation();
    setEditingOrderId(sale.id);
    const item = sellableItems.find(i => i.id === sale.itemId) || sellableItems.find(i => i.name === sale.item);
    
    setOrderForm({
        customerId: sale.customerId || '',
        customerName: sale.customer,
        date: sale.date,
        itemId: item?.id || '',
        quantity: String(sale.quantity),
        pricePerUnit: String(sale.unitPrice),
        vatRate: String(sale.vatRate || 0),
        withholdingRate: String(sale.withholdingRate || 0),
        status: sale.status,
        flockId: sale.flockId || ''
    });
    setIsOrderModalOpen(true);
  };

  const handleOrderCustomerChange = (customerId: string) => {
      const customer = customers.find(c => c.id === customerId);
      const currentItem = orderForm.itemId;
      let price = orderForm.pricePerUnit;
      if (currentItem && customer) {
          price = getPriceForCustomer(currentItem, customerId).toString();
      }
      setOrderForm({
          ...orderForm,
          customerId,
          customerName: customer ? customer.name : '',
          pricePerUnit: price
      });
  };

  const handleOrderItemChange = (itemId: string) => {
      let price = '';
      if (orderForm.customerId) {
          price = getPriceForCustomer(itemId, orderForm.customerId).toString();
      } else {
          const item = sellableItems.find(i => i.id === itemId);
          price = item?.pricePerUnit?.toString() || '';
      }
      setOrderForm({ ...orderForm, itemId, pricePerUnit: price });
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = sellableItems.find(i => i.id === orderForm.itemId);
    if (!item) return;

    const qty = parseFloat(orderForm.quantity);
    const isReservedStatus = ['CONFIRMED', 'DISPATCHED', 'INVOICED', 'PAID'].includes(orderForm.status);
    
    if (isReservedStatus) {
        // Validation: If editing, consider already reserved amount (simple check)
        if (qty > item.quantity) {
             if (!editingOrderId || (editingOrderId && qty > item.quantity)) {
                 const proceed = confirm(`Warning: Insufficient Inventory! Only ${item.quantity} ${item.unit} available. Proceeding will result in negative stock. Continue?`);
                 if (!proceed) return;
             }
        }
    }

    const saleData = {
        date: orderForm.date,
        customerId: orderForm.customerId,
        customer: orderForm.customerName || 'Walk-in Customer',
        item: item.name,
        itemId: item.id, // Store ID
        quantity: qty,
        unitPrice: parseFloat(orderForm.pricePerUnit),
        subtotal: totals.subtotal,
        vatRate: parseFloat(orderForm.vatRate),
        vatAmount: totals.vatAmount,
        withholdingRate: parseFloat(orderForm.withholdingRate),
        withholdingAmount: totals.withholdingAmount,
        totalAmount: totals.invoiceTotal,
        status: orderForm.status,
        flockId: orderForm.flockId || undefined
    };

    if (editingOrderId) {
        const oldSale = salesRecords.find(s => s.id === editingOrderId);
        if (oldSale) {
            const wasReserved = ['CONFIRMED', 'DISPATCHED', 'INVOICED', 'PAID'].includes(oldSale.status);
            
            if (wasReserved) {
                const oldItemId = oldSale.itemId || inventoryItems.find(i => i.name === oldSale.item)?.id;
                if (oldItemId) {
                    await adjustStock(oldItemId, oldSale.quantity);
                    if (oldSale.flockId && inventoryItems.find(i => i.id === oldItemId)?.category === 'BIRDS') {
                        const f = flocks.find(f => f.id === oldSale.flockId);
                        if(f) await updateFlock(f.id, { currentCount: f.currentCount + oldSale.quantity });
                    }
                }
            }

            if (isReservedStatus) {
                await adjustStock(item.id, -qty);
                if (orderForm.flockId && item.category === 'BIRDS') {
                    const f = flocks.find(f => f.id === orderForm.flockId);
                    if(f) await updateFlock(f.id, { currentCount: f.currentCount - qty });
                }
            }
        }
        updateSale(editingOrderId, saleData);
    } else {
        if (isReservedStatus) {
             await adjustStock(item.id, -qty);
             if (orderForm.flockId && item.category === 'BIRDS') {
                const f = flocks.find(f => f.id === orderForm.flockId);
                if(f) await updateFlock(f.id, { currentCount: f.currentCount - qty });
            }
        }
        addSale({ id: `S-${Date.now()}`, ...saleData });
    }

    setIsOrderModalOpen(false);
  };

  const getStatusColor = (status: SaleStatus) => {
      switch(status) {
          case 'DRAFT': return 'bg-slate-100 text-slate-500';
          case 'CONFIRMED': return 'bg-blue-100 text-blue-700';
          case 'DISPATCHED': return 'bg-purple-100 text-purple-700';
          case 'INVOICED': return 'bg-amber-100 text-amber-700';
          case 'PAID': return 'bg-emerald-100 text-emerald-700';
          case 'CANCELLED': return 'bg-red-50 text-red-500 line-through';
          default: return 'bg-slate-100';
      }
  };

  const getCustomerStatusColor = (status: string) => {
      switch(status) {
          case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'INACTIVE': return 'bg-slate-100 text-slate-500 border-slate-200';
          case 'HOLD': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'BLACKLISTED': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-slate-100';
      }
  };

  // --- Customer History Stats ---
  const customerStats = useMemo(() => {
      if (!viewingCustomer) return null;
      const history = salesRecords.filter(s => s.customerId === viewingCustomer.id && s.status !== 'CANCELLED');
      const totalSpent = history.reduce((acc, s) => acc + s.totalAmount, 0);
      const orderCount = history.length;
      const pendingOrders = history.filter(s => ['CONFIRMED', 'DISPATCHED', 'INVOICED'].includes(s.status)).length;
      const lastOrder = history.length > 0 ? history.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date : 'N/A';
      
      return { totalSpent, orderCount, pendingOrders, lastOrder, history };
  }, [viewingCustomer, salesRecords]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Sales & Orders</h2>
          <p className="text-slate-500 mt-1">Manage sales pipeline, customers, and order fulfillment.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('ORDERS')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'ORDERS' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              Sales Orders
          </button>
          <button 
            onClick={() => setActiveTab('PRODUCTS')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'PRODUCTS' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              Product Catalog
          </button>
          <button 
            onClick={() => setActiveTab('CUSTOMERS')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CUSTOMERS' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
              Customer Master
          </button>
      </div>

      {activeTab === 'ORDERS' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Completed Revenue" value={`$${totalRevenue.toLocaleString()}`} icon="💵" color="bg-emerald-500" trend={{value: 0, positive: true}} />
                <StatCard label="Pending Invoices" value={`$${pendingInvoices.toLocaleString()}`} icon="⏳" color="bg-amber-500" />
                <StatCard label="Draft Pipeline" value={`$${draftValue.toLocaleString()}`} icon="📝" color="bg-blue-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue Trend</h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                                <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Sales Mix</h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={productMix} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {productMix.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <div className="flex gap-2">
                        {['ALL', 'DRAFT', 'CONFIRMED', 'DISPATCHED', 'INVOICED', 'PAID', 'CANCELLED'].map((s: any) => (
                            <button 
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${filterStatus === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleOpenOrderModal} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20">
                        + New Order
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Order Details</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {filteredOrders.map(sale => (
                                <tr key={sale.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={(e) => handleEditOrder(e, sale)}>
                                    <td className="px-6 py-4 font-mono text-slate-500">{sale.date}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{sale.customer}</td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {sale.quantity}x {sale.item}
                                        {sale.flockId && <span className="block text-[10px] text-teal-600">Source: {sale.flockId}</span>}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-800">${sale.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(sale.status)}`}>
                                            {sale.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-teal-600 font-bold px-2">Edit</button>
                                    </td>
                                </tr>
                            ))}
                            {filteredOrders.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No orders found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* PRODUCTS TAB */}
      {activeTab === 'PRODUCTS' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800">Product Catalog</h3>
                      <p className="text-xs text-slate-500">Manage sellable items and prices.</p>
                  </div>
                  <button onClick={() => handleOpenProductModal()} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
                      + Add Product
                  </button>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                          <tr>
                              <th className="px-6 py-4">Product Name</th>
                              <th className="px-6 py-4">Category</th>
                              <th className="px-6 py-4">Stock</th>
                              <th className="px-6 py-4">Standard Price</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                          {sellableItems.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 font-bold text-slate-800">{item.name}</td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                          item.category === 'BIRDS' ? 'bg-amber-100 text-amber-700' :
                                          item.category === 'MEAT' ? 'bg-pink-100 text-pink-700' :
                                          item.category === 'BYPRODUCT' ? 'bg-gray-100 text-gray-700' :
                                          'bg-emerald-100 text-emerald-700'
                                      }`}>
                                          {item.category}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-slate-600">
                                      {item.quantity} {item.unit}
                                  </td>
                                  <td className="px-6 py-4 font-bold text-slate-800">
                                      ${item.pricePerUnit?.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ {item.unit}</span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      <button onClick={() => handleOpenProductModal(item)} className="text-teal-600 hover:text-teal-700 font-bold text-xs bg-teal-50 px-3 py-1.5 rounded-lg">
                                          Edit Price
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {sellableItems.length === 0 && (
                              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No products defined. Add one to start selling.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === 'CUSTOMERS' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search customers..." 
                        className="pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500 text-sm w-64"
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  </div>
                  <button onClick={openNewCustomer} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
                      Add Customer
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCustomers.map(customer => (
                      <div 
                        key={customer.id} 
                        className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all group relative cursor-pointer ${customer.status === 'BLACKLISTED' ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}
                        onClick={() => setViewingCustomer(customer)}
                      >
                          <div className="flex justify-between items-start mb-3">
                              <div>
                                  <h3 className="font-bold text-slate-800 text-lg">{customer.name}</h3>
                                  <div className="flex gap-2 mt-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                        customer.type === 'WHOLESALER' ? 'bg-purple-100 text-purple-700' : 
                                        customer.type === 'HOTEL' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>{customer.type}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${getCustomerStatusColor(customer.status)}`}>
                                        {customer.status}
                                    </span>
                                  </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <button onClick={(e) => { e.stopPropagation(); openEditCustomer(customer); }} className="p-1.5 bg-slate-100 rounded hover:bg-teal-50 text-slate-500 hover:text-teal-600">✎</button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }} className="p-1.5 bg-slate-100 rounded hover:bg-red-50 text-slate-500 hover:text-red-600">✕</button>
                              </div>
                          </div>
                          <div className="space-y-2 text-sm text-slate-500">
                              <p className="flex items-center gap-2"><span>👤</span> {customer.contactPerson}</p>
                              <p className="flex items-center gap-2"><span>📞</span> {customer.phone}</p>
                              {customer.email && <p className="flex items-center gap-2"><span>📧</span> {customer.email}</p>}
                              {customer.creditLimit && customer.creditLimit > 0 && (
                                  <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                      Credit Limit: <span className="text-slate-600">${customer.creditLimit.toLocaleString()}</span>
                                  </p>
                              )}
                          </div>
                      </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400 italic">No customers found. Add one to get started.</div>
                  )}
              </div>
          </div>
      )}

      {/* Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
              <h3 className="text-xl font-bold text-slate-800">{editingProductId ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label>
                <input required type="text" className="w-full p-3 rounded-xl border border-slate-200" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="e.g. Broiler Chicken (Whole)" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as any})}>
                    <option value="PRODUCE">Produce (Eggs)</option>
                    <option value="BIRDS">Live Birds</option>
                    <option value="MEAT">Processed Meat</option>
                    <option value="BYPRODUCT">Byproduct (Manure/Feathers)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
                    <input required type="text" className="w-full p-3 rounded-xl border border-slate-200" value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} placeholder="kg, tray, bird..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Standard Price ($)</label>
                    <input required type="number" step="0.01" className="w-full p-3 rounded-xl border border-slate-200" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} />
                  </div>
              </div>
              {!editingProductId && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Stock</label>
                    <input type="number" min="0" className="w-full p-3 rounded-xl border border-slate-200" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})} placeholder="0" />
                  </div>
              )}
              
              <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg transition-all">
                Save Product
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">📦 {editingOrderId ? 'Edit Order' : 'New Sales Order'}</h3>
               <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             
             <form onSubmit={handleSaveOrder} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer</label>
                       <select 
                           className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                           value={orderForm.customerId}
                           onChange={(e) => handleOrderCustomerChange(e.target.value)}
                           required
                       >
                           <option value="">-- Select --</option>
                           {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                       <input type="date" required className="w-full p-3 rounded-xl border border-slate-200" value={orderForm.date} onChange={e => setOrderForm({...orderForm, date: e.target.value})} />
                   </div>
               </div>

               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Order Details</h4>
                   <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product</label>
                            <select required className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={orderForm.itemId} onChange={e => handleOrderItemChange(e.target.value)}>
                                <option value="">-- Product --</option>
                                {sellableItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source Flock</label>
                            <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={orderForm.flockId} onChange={e => setOrderForm({...orderForm, flockId: e.target.value})}>
                                <option value="">-- Any --</option>
                                {flocks.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                            <input required type="number" min="1" className="w-full p-3 rounded-xl border border-slate-200" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm, quantity: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
                            <input required type="number" step="0.01" className="w-full p-3 rounded-xl border border-slate-200" value={orderForm.pricePerUnit} onChange={e => setOrderForm({...orderForm, pricePerUnit: e.target.value})} />
                        </div>
                   </div>
               </div>

               <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order Status</label>
                   <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
                       {['DRAFT', 'CONFIRMED', 'DISPATCHED', 'INVOICED', 'PAID'].map((s: any) => (
                           <button
                                type="button"
                                key={s}
                                onClick={() => setOrderForm({...orderForm, status: s})}
                                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap px-2 ${orderForm.status === s ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                           >
                               {s}
                           </button>
                       ))}
                   </div>
               </div>

               <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                   <div className="text-xs text-slate-500">
                       Subtotal: ${totals.subtotal.toFixed(2)} | VAT: ${totals.vatAmount.toFixed(2)}
                   </div>
                   <div className="text-xl font-bold text-teal-700">
                       ${totals.invoiceTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                   </div>
               </div>

               <button type="submit" className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all">
                   {editingOrderId ? 'Update Order' : 'Create Order'}
               </button>
             </form>
          </div>
        </div>
      )}

      {/* Customer Add/Edit Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">{editingCustomerId ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company / Name</label>
                <input required type="text" className="w-full p-3 rounded-xl border border-slate-200" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                    <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={customerForm.type} onChange={e => setCustomerForm({...customerForm, type: e.target.value as any})}>
                        {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select className="w-full p-3 rounded-xl border border-slate-200 bg-white" value={customerForm.status} onChange={e => setCustomerForm({...customerForm, status: e.target.value as any})}>
                        <option value="ACTIVE">Active</option>
                        <option value="HOLD">On Hold</option>
                        <option value="BLACKLISTED">Blacklisted</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                    <input required type="tel" className="w-full p-3 rounded-xl border border-slate-200" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Person</label>
                    <input type="text" className="w-full p-3 rounded-xl border border-slate-200" value={customerForm.contactPerson} onChange={e => setCustomerForm({...customerForm, contactPerson: e.target.value})} />
                  </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                <input type="email" className="w-full p-3 rounded-xl border border-slate-200" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tax ID / TIN</label>
                    <input type="text" className="w-full p-3 rounded-xl border border-slate-200" value={customerForm.taxId} onChange={e => setCustomerForm({...customerForm, taxId: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Credit Limit ($)</label>
                    <input type="number" min="0" className="w-full p-3 rounded-xl border border-slate-200" value={customerForm.creditLimit} onChange={e => setCustomerForm({...customerForm, creditLimit: Number(e.target.value)})} />
                  </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                <textarea className="w-full p-3 rounded-xl border border-slate-200 resize-none h-20" value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value})} />
              </div>
              
              <button type="submit" className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-lg transition-all">
                Save Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail View Modal */}
      {viewingCustomer && customerStats && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                      <div>
                          <div className="flex items-center gap-3 mb-2">
                              <h2 className="text-2xl font-bold text-slate-800">{viewingCustomer.name}</h2>
                              <span className={`text-xs px-2 py-1 rounded font-bold uppercase border ${getCustomerStatusColor(viewingCustomer.status)}`}>
                                  {viewingCustomer.status}
                              </span>
                          </div>
                          <p className="text-sm text-slate-500">
                              {viewingCustomer.type} • Joined {viewingCustomer.joinedDate}
                          </p>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => { setViewingCustomer(null); openEditCustomer(viewingCustomer); }} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50">
                              Edit Profile
                          </button>
                          <button onClick={() => setViewingCustomer(null)} className="text-slate-400 hover:text-slate-600 px-2 text-xl">✕</button>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                      {/* Stats Row */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                              <p className="text-xs font-bold text-emerald-800 uppercase">Total Spend</p>
                              <p className="text-2xl font-bold text-emerald-600 mt-1">${customerStats.totalSpent.toLocaleString()}</p>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                              <p className="text-xs font-bold text-blue-800 uppercase">Total Orders</p>
                              <p className="text-2xl font-bold text-blue-600 mt-1">{customerStats.orderCount}</p>
                          </div>
                          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                              <p className="text-xs font-bold text-amber-800 uppercase">Pending Orders</p>
                              <p className="text-2xl font-bold text-amber-600 mt-1">{customerStats.pendingOrders}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <p className="text-xs font-bold text-slate-500 uppercase">Last Order</p>
                              <p className="text-lg font-bold text-slate-700 mt-1">{customerStats.lastOrder}</p>
                          </div>
                      </div>

                      {/* Contact & Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                              <h4 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Contact Details</h4>
                              <div className="space-y-3 text-sm text-slate-600">
                                  <div className="flex justify-between"><span className="text-slate-400">Contact Person</span> <span className="font-medium">{viewingCustomer.contactPerson}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400">Phone</span> <span className="font-medium">{viewingCustomer.phone}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400">Email</span> <span className="font-medium">{viewingCustomer.email || 'N/A'}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400">Address</span> <span className="font-medium text-right max-w-[200px]">{viewingCustomer.address || 'N/A'}</span></div>
                              </div>
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Financial Info</h4>
                              <div className="space-y-3 text-sm text-slate-600">
                                  <div className="flex justify-between"><span className="text-slate-400">Tax ID / TIN</span> <span className="font-medium">{viewingCustomer.taxId || 'N/A'}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400">Credit Limit</span> <span className="font-medium">${(viewingCustomer.creditLimit || 0).toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400">Credit Used</span> <span className="font-medium text-amber-600">$0.00 (Simulated)</span></div>
                              </div>
                          </div>
                      </div>

                      {/* Sales History Table */}
                      <div>
                          <h4 className="font-bold text-slate-800 mb-3">Order History</h4>
                          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                                      <tr>
                                          <th className="px-4 py-3">Date</th>
                                          <th className="px-4 py-3">Item</th>
                                          <th className="px-4 py-3 text-right">Qty</th>
                                          <th className="px-4 py-3 text-right">Total</th>
                                          <th className="px-4 py-3 text-right">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                      {customerStats.history.map(sale => (
                                          <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="px-4 py-3 font-mono text-slate-500">{sale.date}</td>
                                              <td className="px-4 py-3 font-medium text-slate-700">{sale.item}</td>
                                              <td className="px-4 py-3 text-right">{sale.quantity}</td>
                                              <td className="px-4 py-3 text-right font-bold text-slate-700">${sale.totalAmount.toLocaleString()}</td>
                                              <td className="px-4 py-3 text-right">
                                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getStatusColor(sale.status)}`}>
                                                      {sale.status}
                                                  </span>
                                              </td>
                                          </tr>
                                      ))}
                                      {customerStats.history.length === 0 && (
                                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No previous orders found.</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default SalesManagement;
