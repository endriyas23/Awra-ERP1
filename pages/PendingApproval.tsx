
import React from 'react';
import { useAuth } from '../context/AuthContext';

const PendingApproval: React.FC = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center border border-slate-100">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
          ⏳
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Pending Approval</h2>
        <p className="text-slate-500 mb-6 leading-relaxed">
          Hello <strong>{user?.email}</strong>,<br/>
          Your registration was successful, but your account requires administrator approval before you can access the Awra ERP system.
        </p>
        
        <div className="bg-slate-50 p-4 rounded-xl text-left text-sm text-slate-600 mb-8 border border-slate-200">
          <p className="font-bold mb-1">What happens next?</p>
          <ul className="list-disc list-inside space-y-1">
            <li>An admin will review your request.</li>
            <li>You will be assigned a role (e.g., Manager, Vet).</li>
            <li>Check back later or contact your supervisor.</li>
          </ul>
        </div>

        <button 
          onClick={signOut}
          className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default PendingApproval;
