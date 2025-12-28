
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import FlockManagement from './pages/FlockManagement';
import FlockDetail from './pages/FlockDetail';
import HealthManagement from './pages/HealthManagement';
import FeedManagement from './pages/FeedManagement';
import InventoryManagement from './pages/InventoryManagement';
import ProductionManagement from './pages/ProductionManagement';
import SalesManagement from './pages/SalesManagement';
import FinanceManagement from './pages/FinanceManagement';
import HRManagement from './pages/HRManagement';
import AnalyticsManagement from './pages/AnalyticsManagement';
import SettingsManagement from './pages/SettingsManagement';
import Profile from './pages/Profile';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import Toast from './components/Toast';

// Extracted Header Component to use Hooks cleanly
const AppHeader: React.FC = () => {
  const { items, healthRecords, flocks } = useInventory();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const navigate = useNavigate();

  // --- Alert Logic ---
  const lowStockItems = items.filter(i => i.quantity < i.minThreshold);
  const activeHealthIssues = healthRecords.filter(h => h.status !== 'RESOLVED' && h.status !== 'COMPLETED');
  const activeFlocks = flocks.filter(f => f.status === 'ACTIVE');
  
  const totalAlerts = lowStockItems.length + activeHealthIssues.length;

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-40 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="md:hidden text-slate-500">☰</div>
          <div className="flex flex-col">
             <h2 className="font-bold text-slate-700">Awra Control Center</h2>
             <span className="text-[10px] text-slate-400 font-medium">
               {activeFlocks.length} Active Flocks • {new Date().toLocaleDateString()}
             </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center bg-slate-50 px-4 py-2 rounded-xl gap-2 border border-slate-100 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
            <span className="text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search records..." 
              className="bg-transparent border-none outline-none text-sm w-48 text-slate-600 placeholder:text-slate-400"
            />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertOpen(!isAlertOpen)}
                className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isAlertOpen ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                🔔
                {totalAlerts > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isAlertOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAlertOpen(false)}></div>
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                     <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 text-sm">System Alerts</h4>
                        <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{totalAlerts} New</span>
                     </div>
                     <div className="max-h-[300px] overflow-y-auto">
                        {totalAlerts === 0 ? (
                           <div className="p-8 text-center text-slate-400 text-sm italic">
                             All systems operational. <br/> No active alerts.
                           </div>
                        ) : (
                           <>
                             {lowStockItems.map(item => (
                               <div key={item.id} onClick={() => { navigate('/inventory'); setIsAlertOpen(false); }} className="p-4 border-b border-slate-50 hover:bg-red-50/30 cursor-pointer transition-colors group">
                                  <div className="flex gap-3">
                                     <div className="mt-0.5 text-lg">📦</div>
                                     <div>
                                        <p className="text-xs font-bold text-slate-800 group-hover:text-red-700">Low Stock: {item.name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Only {item.quantity} {item.unit} remaining (Min: {item.minThreshold}).</p>
                                     </div>
                                  </div>
                               </div>
                             ))}
                             {activeHealthIssues.map(record => (
                               <div key={record.id} onClick={() => { navigate('/health'); setIsAlertOpen(false); }} className="p-4 border-b border-slate-50 hover:bg-amber-50/30 cursor-pointer transition-colors group">
                                  <div className="flex gap-3">
                                     <div className="mt-0.5 text-lg">🩺</div>
                                     <div>
                                        <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700">Health Issue: {record.diagnosis}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Flock {record.flockId} • Status: {record.status}</p>
                                     </div>
                                  </div>
                               </div>
                             ))}
                           </>
                        )}
                     </div>
                     <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                        <button onClick={() => { navigate('/'); setIsAlertOpen(false); }} className="text-xs font-bold text-teal-600 hover:text-teal-700">View Dashboard</button>
                     </div>
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-6 bg-slate-200"></div>
            <button 
              onClick={() => navigate('/settings')}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
            >
              ⚙️
            </button>
          </div>
        </div>
    </header>
  );
};

// Component to render active toasts
const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  return (
    <div className="fixed top-24 right-8 z-[100] flex flex-col gap-3">
      {notifications.map(n => (
        <Toast key={n.id} notification={n} onClose={removeNotification} />
      ))}
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Sidebar />
      <main className="ml-64 min-h-screen relative">
        <AppHeader />
        <ToastContainer />
        <section className="p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/flock" element={<FlockManagement />} />
              <Route path="/flock/:id" element={<FlockDetail />} />
              <Route path="/health" element={<HealthManagement />} />
              <Route path="/feed" element={<FeedManagement />} />
              <Route path="/inventory" element={<InventoryManagement />} />
              <Route path="/production" element={<ProductionManagement />} />
              <Route path="/sales" element={<SalesManagement />} />
              <Route path="/finance" element={<FinanceManagement />} />
              <Route path="/hr" element={<HRManagement />} />
              <Route path="/analytics" element={<AnalyticsManagement />} />
              <Route path="/settings" element={<SettingsManagement />} />
              <Route path="/profile" element={<Profile />} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </section>
      </main>
      
      {/* Footer / Status Bar */}
      <footer className="ml-64 bg-white border-t border-slate-100 p-4 text-xs text-slate-400 flex justify-between items-center">
        <div>&copy; 2024 Awra Agriculture ERP Systems v1.0.5-stable</div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> System Online</span>
          <span>Cloud Sync: 2m ago</span>
        </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <InventoryProvider>
        <HashRouter>
          <AppLayout />
        </HashRouter>
      </InventoryProvider>
    </NotificationProvider>
  );
};

export default App;
