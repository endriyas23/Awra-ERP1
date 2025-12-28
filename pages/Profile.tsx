
import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';

const Profile: React.FC = () => {
  const { addNotification } = useNotification();
  
  const [user, setUser] = useState({
    name: 'John Doe',
    email: 'john.doe@awrafarms.com',
    role: 'Administrator',
    phone: '+233 54 123 4567',
    bio: 'Senior Farm Manager with 10 years of experience in poultry production and agribusiness.',
    avatar: 'JD'
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    addNotification('SUCCESS', 'Profile Updated', 'Your personal details have been saved.');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
        addNotification('ERROR', 'Password Mismatch', 'New password and confirmation do not match.');
        return;
    }
    setPasswords({ current: '', new: '', confirm: '' });
    addNotification('SUCCESS', 'Password Changed', 'Your security credentials have been updated.');
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
                <h3 className="text-xl font-bold text-slate-800">{user.name}</h3>
                <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-2">
                    {user.role}
                </span>
                <p className="text-slate-500 text-sm mt-4 leading-relaxed">
                    {user.bio}
                </p>
                <div className="mt-6 w-full pt-6 border-t border-slate-50 flex justify-between text-xs text-slate-400">
                    <span>Member since</span>
                    <span className="font-bold text-slate-600">Jan 2023</span>
                </div>
            </div>

            {/* Quick Stats or Status */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl">
                <h4 className="font-bold mb-4">Account Status</h4>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Security Level</span>
                        <span className="text-emerald-400 font-bold">High</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Last Login</span>
                        <span>Just now</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">2FA Enabled</span>
                        <span className="text-emerald-400">Yes</span>
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
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                        <input 
                            type="email" 
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                            value={user.email}
                            onChange={e => setUser({...user, email: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bio</label>
                        <textarea 
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none h-24 resize-none"
                            value={user.bio}
                            onChange={e => setUser({...user, bio: e.target.value})}
                        />
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all">
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
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Password</label>
                        <input 
                            type="password" 
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                            value={passwords.current}
                            onChange={e => setPasswords({...passwords, current: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
                            <input 
                                type="password" 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm New Password</label>
                            <input 
                                type="password" 
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none"
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all">
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
