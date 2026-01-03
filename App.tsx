
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
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
import SettingsManagement from './pages/SettingsManagement';
import CalendarManagement from './pages/CalendarManagement';
import Profile from './pages/Profile';
import Login from './pages/Login';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Toast from './components/Toast';

// Header Component
const AppHeader: React.FC = () => {
  const { items, healthRecords, flocks } = useInventory();
  const { user } = useAuth();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const navigate = useNavigate();

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Search Logic
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();

    const matchedFlocks = flocks.filter(f => 
      f.name.toLowerCase().includes(lowerQuery) || 
      f.id.toLowerCase().includes(lowerQuery)
    ).map(f => ({ 
        type: 'FLOCK', 
        id: f.id, 
        label: f.name, 
        detail: `Batch • ${f.type} • ${f.currentCount} birds`, 
        path: `/flock/${f.id}` 
    }));

    const matchedItems = items.filter(i => 
      i.name.toLowerCase().includes(lowerQuery) || 
      i.category.toLowerCase().includes(lowerQuery)
    ).map(i => ({ 
        type: 'INVENTORY', 
        id: i.id, 
        label: i.name, 
        detail: `Stock: ${i.quantity} ${i.unit}`, 
        path: '/inventory' 
    }));

    const matchedHealth = healthRecords.filter(h => 
      h.diagnosis.toLowerCase().includes(lowerQuery) || 
      h.type.toLowerCase().includes(lowerQuery)
    ).map(h => ({ 
        type: 'HEALTH', 
        id: h.id, 
        label: h.diagnosis, 
        detail: `${h.date} • ${h.status}`, 
        path: '/health' 
    }));

    return [...matchedFlocks, ...matchedItems, ...matchedHealth].slice(0, 8);
  }, [searchQuery, flocks, items, healthRecords]);

  const handleResultClick = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  // --- Alert Logic ---
  const lowStockItems = items.filter(i => i.quantity < i.minThreshold);
  const activeHealthIssues = healthRecords.filter(h => h.status !== 'RESOLVED' && h.status !== 'COMPLETED');
  const activeFlocks = flocks.filter(f => f.status === 'ACTIVE');
  
  const totalAlerts = lowStockItems.length + activeHealthIssues.length;
  const userInitials = user?.email?.substring(0, 2).toUpperCase() || 'JD';

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
          {/* Global Search Bar */}
          <div className="hidden md:block relative z-50">
            <div className={`flex items-center bg-slate-50 px-4 py-2 rounded-xl gap-2 border transition-all ${isSearchFocused ? 'border-teal-500 ring-2 ring-teal-500/20 bg-white' : 'border-slate-100'}`}>
              <span className="text-slate-400">🔍</span>
              <input 
                type="text" 
                placeholder="Search flocks, inventory..." 
                className="bg-transparent border-none outline-none text-sm w-64 text-slate-600 placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              />
              {searchQuery && (
                  <button onClick={() => {setSearchQuery(''); setIsSearchFocused(false);}} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {isSearchFocused && searchQuery && (
                <div className="absolute top-12 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {searchResults.length > 0 ? (
                        <div className="py-2 max-h-96 overflow-y-auto">
                            {searchResults.map((result) => (
                                <div 
                                    key={`${result.type}-${result.id}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent input blur from hiding this before click executes
                                        handleResultClick(result.path);
                                    }}
                                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3"
                                >
                                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                                        result.type === 'FLOCK' ? 'bg-teal-100 text-teal-700' :
                                        result.type === 'INVENTORY' ? 'bg-amber-100 text-amber-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {result.type === 'FLOCK' ? '🐣' : result.type === 'INVENTORY' ? '📦' : '🩺'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{result.label}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{result.detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-slate-400 text-sm italic">
                            No results found.
                        </div>
                    )}
                </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
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
                               <div key={item.id} onClick={() => {navigate('/inventory'); setIsAlertOpen(false);}} className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex gap-3 items-start">
                                  <span className="text-lg">⚠️</span>
                                  <div>
                                     <p className="text-xs font-bold text-slate-700">Low Stock: {item.name}</p>
                                     <p className="text-[10px] text-slate-500">Only {item.quantity} {item.unit} remaining.</p>
                                  </div>
                               </div>
                             ))}
                             {activeHealthIssues.map(issue => (
                               <div key={issue.id} onClick={() => {navigate('/health'); setIsAlertOpen(false);}} className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex gap-3 items-start">
                                  <span className="text-lg">🩺</span>
                                  <div>
                                     <p className="text-xs font-bold text-slate-700">Health Alert: {issue.diagnosis}</p>
                                     <p className="text-[10px] text-slate-500">{issue.status} • Flock {issue.flockId}</p>
                                  </div>
                               </div>
                             ))}
                           </>
                        )}
                     </div>
                  </div>
                </>
              )}
            </div>
            
            <div 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold cursor-pointer hover:ring-4 hover:ring-slate-100 transition-all"
              title="View Profile"
            >
              {userInitials}
            </div>
          </div>
        </div>
    </header>
  );
};

const ProtectedLayout: React.FC = () => {
  const { loading, isPending } = useAuth();
  const { notifications, removeNotification } = useNotification();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <InventoryProvider>
        <div className="flex bg-slate-50 min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 min-h-screen flex flex-col relative">
            {!isOnline && (
                <div className="bg-amber-600 text-white text-xs font-bold text-center py-2 sticky top-0 z-[60] shadow-md animate-in slide-in-from-top-1">
                    📡 You are currently offline. Changes are saved locally and will sync when connection is restored.
                </div>
            )}
            <AppHeader />
            
            {/* Toast Container */}
            <div className="fixed top-24 right-8 z-50 flex flex-col gap-2 pointer-events-none">
              {notifications.map(n => (
                <div key={n.id} className="pointer-events-auto">
                  <Toast notification={n} onClose={removeNotification} />
                </div>
              ))}
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </main>
        </div>
    </InventoryProvider>
  );
};

// Route Guard Wrapper
const AppRoutes = () => {
  const { session, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<ProtectedLayout />}>
        {/* Unrestricted Access to All Routes */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/calendar" element={<CalendarManagement />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/flock" element={<FlockManagement />} />
        <Route path="/flock/:id" element={<FlockDetail />} />
        <Route path="/health" element={<HealthManagement />} />
        <Route path="/feed" element={<FeedManagement />} />
        <Route path="/inventory" element={<InventoryManagement />} />
        <Route path="/production" element={<ProductionManagement />} />
        <Route path="/sales" element={<SalesManagement />} />
        <Route path="/finance" element={<FinanceManagement />} />
        <Route path="/hr" element={<HRManagement />} />
        <Route path="/settings" element={<SettingsManagement />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <NotificationProvider>
           <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
