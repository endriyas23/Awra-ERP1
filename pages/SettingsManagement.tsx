
import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useNotification } from '../context/NotificationContext';

const SettingsManagement: React.FC = () => {
  const { 
    items, consumptionRecords, eggLogs, salesRecords, 
    transactions, tasks, flocks, healthRecords 
  } = useInventory();
  const { addNotification } = useNotification();

  const [activeSection, setActiveSection] = useState<'GENERAL' | 'NOTIFICATIONS' | 'DATA'>('GENERAL');
  
  // Local State for Settings (Simulated Persistence)
  const [settings, setSettings] = useState({
    farmName: 'Green Valley Poultry Farm',
    ownerName: 'John Doe',
    currency: 'ETB',
    timezone: 'GMT+3',
    theme: 'LIGHT',
    notifications: {
        lowStock: true,
        diseaseAlerts: true,
        taskReminders: true,
        emailReports: false
    }
  });

  useEffect(() => {
    const saved = localStorage.getItem('awra_settings');
    if (saved) {
        setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('awra_settings', JSON.stringify(settings));
    addNotification('SUCCESS', 'Settings Saved', 'Configuration has been updated successfully.');
  };

  const handleExportData = () => {
    const data = {
        timestamp: new Date().toISOString(),
        version: '1.0.5',
        data: {
            flocks,
            inventory: items,
            health: healthRecords,
            sales: salesRecords,
            finance: transactions,
            production: eggLogs,
            feed: consumptionRecords,
            tasks
        }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `awra_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addNotification('INFO', 'Export Complete', 'Database backup has been downloaded.');
  };

  const handleResetData = () => {
      if (confirm('CRITICAL WARNING: This will clear all local storage settings. The actual mock data in this demo cannot be permanently deleted, but your preferences will be reset. Continue?')) {
          localStorage.removeItem('awra_settings');
          window.location.reload();
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">System Settings</h2>
          <p className="text-slate-500 mt-1">Configure your farm profile, preferences, and data management.</p>
        </div>
        <button 
          onClick={handleSave}
          className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
        >
          <span>💾</span> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Settings Sidebar */}
          <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-500 text-xs uppercase tracking-widest">
                      Configuration
                  </div>
                  <nav className="flex flex-col p-2 space-y-1">
                      <button 
                        onClick={() => setActiveSection('GENERAL')}
                        className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'GENERAL' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                          🏠 General Profile
                      </button>
                      <button 
                        onClick={() => setActiveSection('NOTIFICATIONS')}
                        className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'NOTIFICATIONS' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                          🔔 Notifications
                      </button>
                      <button 
                        onClick={() => setActiveSection('DATA')}
                        className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'DATA' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                          💾 Data & Backup
                      </button>
                  </nav>
              </div>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-3">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 min-h-[500px]">
                  
                  {activeSection === 'GENERAL' && (
                      <div className="space-y-6 max-w-2xl animate-in fade-in">
                          <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">General Farm Profile</h3>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Farm Name</label>
                                  <input 
                                    type="text" 
                                    value={settings.farmName}
                                    onChange={(e) => setSettings({...settings, farmName: e.target.value})}
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-2">Owner / Manager</label>
                                      <input 
                                        type="text" 
                                        value={settings.ownerName}
                                        onChange={(e) => setSettings({...settings, ownerName: e.target.value})}
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-2">Primary Currency</label>
                                      <select 
                                        value={settings.currency}
                                        onChange={(e) => setSettings({...settings, currency: e.target.value})}
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                      >
                                          <option value="ETB">ETB (Br)</option>
                                          <option value="USD">USD ($)</option>
                                          <option value="EUR">EUR (€)</option>
                                          <option value="GBP">GBP (£)</option>
                                          <option value="GHS">GHS (₵)</option>
                                          <option value="NGN">NGN (₦)</option>
                                          <option value="KES">KES (KSh)</option>
                                      </select>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-slate-700 mb-2">Timezone</label>
                                  <select 
                                    value={settings.timezone}
                                    onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                  >
                                      <option value="GMT+3">GMT +3:00 (Addis Ababa, Nairobi)</option>
                                      <option value="GMT+0">GMT +0:00 (London, Accra)</option>
                                      <option value="GMT+1">GMT +1:00 (Lagos, Berlin)</option>
                                      <option value="GMT-5">GMT -5:00 (New York)</option>
                                  </select>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeSection === 'NOTIFICATIONS' && (
                      <div className="space-y-6 max-w-2xl animate-in fade-in">
                          <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">Alert Preferences</h3>
                          
                          <div className="space-y-4">
                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div>
                                      <h4 className="font-bold text-slate-800">Low Stock Alerts</h4>
                                      <p className="text-xs text-slate-500">Notify when inventory drops below threshold.</p>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={settings.notifications.lowStock} onChange={(e) => setSettings({...settings, notifications: {...settings.notifications, lowStock: e.target.checked}})} className="sr-only peer" />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                  </label>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div>
                                      <h4 className="font-bold text-slate-800">Disease Outbreak Warnings</h4>
                                      <p className="text-xs text-slate-500">Critical alerts for high mortality or AI diagnosis.</p>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={settings.notifications.diseaseAlerts} onChange={(e) => setSettings({...settings, notifications: {...settings.notifications, diseaseAlerts: e.target.checked}})} className="sr-only peer" />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                  </label>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div>
                                      <h4 className="font-bold text-slate-800">Task Due Reminders</h4>
                                      <p className="text-xs text-slate-500">Daily reminders for overdue team tasks.</p>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={settings.notifications.taskReminders} onChange={(e) => setSettings({...settings, notifications: {...settings.notifications, taskReminders: e.target.checked}})} className="sr-only peer" />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                  </label>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div>
                                      <h4 className="font-bold text-slate-800">Email Reports (Weekly)</h4>
                                      <p className="text-xs text-slate-500">Send PDF summaries to registered email.</p>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" checked={settings.notifications.emailReports} onChange={(e) => setSettings({...settings, notifications: {...settings.notifications, emailReports: e.target.checked}})} className="sr-only peer" />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                  </label>
                              </div>
                          </div>
                      </div>
                  )}

                  {activeSection === 'DATA' && (
                      <div className="space-y-6 max-w-2xl animate-in fade-in">
                          <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">Data Management</h3>
                          
                          <div className="space-y-6">
                              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                                  <div className="flex items-start gap-4">
                                      <div className="text-2xl">📦</div>
                                      <div className="flex-1">
                                          <h4 className="font-bold text-blue-900">Export Database</h4>
                                          <p className="text-sm text-blue-700 mt-1">Download a full JSON backup of your current farm data, including all inventory, logs, and financial records.</p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={handleExportData}
                                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all"
                                  >
                                      Download Backup (.json)
                                  </button>
                              </div>

                              <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                                  <div className="flex items-start gap-4">
                                      <div className="text-2xl">⚠️</div>
                                      <div className="flex-1">
                                          <h4 className="font-bold text-red-900">Reset Application</h4>
                                          <p className="text-sm text-red-700 mt-1">Clear all locally saved settings and revert to the default demonstration state. This action is irreversible.</p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={handleResetData}
                                    className="mt-4 w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-xl font-bold transition-all"
                                  >
                                      Reset to Defaults
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}

              </div>
          </div>
      </div>
    </div>
  );
};

export default SettingsManagement;
