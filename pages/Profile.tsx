
import React, { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { supabase } from '../lib/supabaseClient';

const Profile: React.FC = () => {
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  
  const [user, setUser] = useState({
    id: '',
    name: '',
    email: '',
    role: 'Farm Manager',
    phone: '',
    bio: '',
    avatar: 'JD'
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata || {};
        const fullName = meta.full_name || '';
        setUser({
          id: user.id,
          name: fullName,
          email: user.email || '',
          role: meta.role || 'Farm Manager',
          phone: meta.phone || '',
          bio: meta.bio || '',
          avatar: fullName ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) : 'ME'
        });
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Update Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: user.name,
          phone: user.phone,
          bio: user.bio,
          role: user.role
        }
      });

      if (authError) throw authError;

      // 2. Sync with Public Profiles Table (Critical for HR/RBAC)
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ 
          full_name: user.name 
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // Update local avatar
      setUser(prev => ({
        ...prev,
        avatar: prev.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
      }));

      addNotification('SUCCESS', 'Profile Saved', 'Your personal details have been updated in the system.');
    } catch (error: any) {
      addNotification('ERROR', 'Update Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
        addNotification('ERROR', 'Password Mismatch', 'New password and confirmation do not match.');
        return;
    }
    
    setLoadingPass(true);
    try {
        const { error } = await supabase.auth.updateUser({ password: passwords.new });
        if (error) throw error;
        
        setPasswords({ current: '', new: '', confirm: '' });
        addNotification('SUCCESS', 'Password Changed', 'Your security credentials have been updated.');
    } catch (error: any) {
        addNotification('ERROR', 'Error', error.message);
    } finally {
        setLoadingPass(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900">My Profile</h2>
        <p className="text-slate-500 mt-1">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: ID Card */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center text-4xl font-bold text-slate-400 mb-4 border-4 border-slate-50 shadow-inner">
                    {user.avatar}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{user.name || 'User'}</h3>
                <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-2">
                    {user.role}
                </span>
                <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                    {user.bio || 'No bio added yet.'}
                </p>
                <div className="mt-6 w-full pt-6 border-t border-slate-50 flex justify-between text-xs text-slate-400">
                    <span>Email</span>
                    <span className="font-bold text-slate-600 truncate max-w-[150px]">{user.email}</span>
                </div>
            </div>

            {/* Quick Stats or Status */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl">
                <h4 className="font-bold mb-4">Account Status</h4>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Security Level</span>
                        <span className="text-emerald-400 font-bold">Standard</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Authenticated</span>
                        <span className="text-emerald-400 font-bold">Yes</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Provider</span>
                        <span className="text-white">Email/Pass</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* Personal Details */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span>👤</span> Personal Information
                </h4>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                            <input 
                                type="text" 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                value={user.name}
                                onChange={e => setUser({...user, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                            <input 
                                type="tel" 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                value={user.phone}
                                onChange={e => setUser({...user, phone: e.target.value})}
                                placeholder="+123..."
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                            <input 
                                type="email" 
                                disabled
                                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                                value={user.email}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Job Role</label>
                            <input 
                                type="text" 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                value={user.role}
                                onChange={e => setUser({...user, role: e.target.value})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bio</label>
                        <textarea 
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none h-24 resize-none"
                            value={user.bio}
                            onChange={e => setUser({...user, bio: e.target.value})}
                            placeholder="Tell us about your role on the farm..."
                        />
                    </div>
                    <div className="flex justify-end pt-2">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>

            {/* Security */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span>🔒</span> Security & Password
                </h4>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm New Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button 
                            type="submit" 
                            disabled={loadingPass}
                            className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                             {loadingPass && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            Update Password
                        </button>
                    </div>
                </form>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
