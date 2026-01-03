
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type AuthView = 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_PASSWORD';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState<AuthView>('SIGN_IN');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (view === 'SIGN_UP') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
      } else if (view === 'SIGN_IN') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (view === 'FORGOT_PASSWORD') {
        // Construct the redirect URL to the profile page where the user can update their password
        // Use hash routing if using HashRouter
        const redirectUrl = `${window.location.origin}/#/profile`;
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Password reset link sent to your email.' });
        setLoading(false); // Stop loading here as we stay on page
        return;
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const toggleView = (newView: AuthView) => {
    setView(newView);
    setMessage(null);
    setPassword(''); // Clear password when switching views
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500 rounded-full blur-3xl opacity-20 -translate-y-10 translate-x-10"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center font-bold text-white text-3xl mx-auto mb-4 shadow-lg shadow-teal-900/50">
              A
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Awra ERP</h1>
            <p className="text-slate-400 text-sm mt-2">Poultry Farm Management System</p>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-slate-800">
              {view === 'SIGN_UP' ? 'Create Account' : view === 'FORGOT_PASSWORD' ? 'Reset Password' : 'Welcome Back'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {view === 'SIGN_UP' ? 'Register to manage your farm' : 
               view === 'FORGOT_PASSWORD' ? 'Enter your email to receive a recovery link' : 
               'Sign in to access your dashboard'}
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-sm mb-6 ${
              message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                placeholder="you@farm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            {view !== 'FORGOT_PASSWORD' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Password</label>
                  {view === 'SIGN_IN' && (
                    <button 
                      type="button" 
                      onClick={() => toggleView('FORGOT_PASSWORD')}
                      className="text-xs text-teal-600 font-bold hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  required
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {view === 'FORGOT_PASSWORD' ? 'Sending...' : 'Processing...'}
                </span>
              ) : (
                view === 'SIGN_UP' ? 'Sign Up' : view === 'FORGOT_PASSWORD' ? 'Send Recovery Link' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {view === 'FORGOT_PASSWORD' ? (
              <button 
                onClick={() => toggleView('SIGN_IN')}
                className="text-sm text-slate-500 hover:text-teal-600 font-semibold transition-colors"
              >
                ← Back to Sign In
              </button>
            ) : (
              <button 
                onClick={() => toggleView(view === 'SIGN_IN' ? 'SIGN_UP' : 'SIGN_IN')}
                className="text-sm text-slate-500 hover:text-teal-600 font-semibold transition-colors"
              >
                {view === 'SIGN_IN' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
