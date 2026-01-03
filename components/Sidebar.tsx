
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  const userProfile = {
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
    role: role || 'Authenticated',
    avatar: (user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()
  };

  // Define Access Permissions
  const getAllowedRoutes = (userRole: UserRole | null): string[] => {
    switch (userRole) {
      case UserRole.ADMIN:
      case UserRole.MANAGER:
        return ['ALL']; // Access everything
      case UserRole.ACCOUNTANT:
        return ['', 'inventory', 'sales', 'finance', 'hr', 'settings', 'calendar'];
      case UserRole.VETERINARIAN:
        return ['', 'flock', 'health', 'feed', 'inventory', 'calendar'];
      case UserRole.FARM_WORKER:
        return ['', 'flock', 'feed', 'inventory', 'production', 'calendar'];
      default:
        return ['']; // Dashboard only or limited
    }
  };

  // Access all items
  const getMenuItems = () => {
    const allItems = [
      { id: '', label: 'Dashboard', icon: '📊' },
      { id: 'calendar', label: 'Farm Calendar', icon: '📅' },
      { id: 'flock', label: 'Flock Management', icon: '🐣' },
      { id: 'feed', label: 'Feed & Nutrition', icon: '🌾' },
      { id: 'health', label: 'Health & AI Diagnosis', icon: '🩺' },
      { id: 'inventory', label: 'Inventory', icon: '📦' },
      { id: 'production', label: 'Production', icon: '🥚' },
      { id: 'sales', label: 'Sales & Orders', icon: '💰' },
      { id: 'finance', label: 'Financials', icon: '📉' },
      { id: 'hr', label: 'HR & Teams', icon: '👥' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    const allowed = getAllowedRoutes(role);
    if (allowed.includes('ALL')) return allItems;

    return allItems.filter(item => allowed.includes(item.id));
  };

  const menuItems = getMenuItems();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center font-bold text-white text-xl">A</div>
        <h1 className="text-xl font-bold text-white tracking-tight">AWRA ERP</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.id}
            to={`/${item.id}`}
            end={item.id === ''}
            className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              isActive 
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
          <div 
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 cursor-pointer group flex-1 overflow-hidden"
            title="View Profile"
          >
            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center group-hover:ring-2 group-hover:ring-teal-500 transition-all">
              <span className="text-sm font-bold text-white">{userProfile.avatar}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate group-hover:text-teal-400 transition-colors">{userProfile.name}</p>
              <p className="text-xs text-slate-400 truncate uppercase tracking-widest">{userProfile.role}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="text-slate-400 hover:text-red-400 hover:bg-slate-700 p-2 rounded-lg transition-all"
            title="Sign Out"
          >
            ↪️
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
