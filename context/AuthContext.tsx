
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  isPending: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Added 'retries' parameter to handle race condition with DB trigger
  const fetchProfileAndRole = async (userId: string, retries = 3) => {
    try {
      // Fetch profile and joined role name
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          role_id,
          roles (
            name
          )
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch warning:', error.message);
        throw error; // Throw to trigger fallback
      }

      if (!data) {
        // Profile record does not exist yet (Trigger latency)
        if (retries > 0) {
            // Wait 500ms and try again
            setTimeout(() => fetchProfileAndRole(userId, retries - 1), 500);
            return;
        }
        // Default if still missing after retries
        setRole(UserRole.PENDING);
      } else {
        // @ts-ignore
        const roleName = data.roles?.name || 'PENDING';
        setRole(roleName as UserRole);
        // Cache role for offline access
        localStorage.setItem('awra_user_role', roleName);
      }
    } catch (err: any) {
      const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error('Auth Error or Offline:', errorMessage);
      
      // Fallback to cached role if offline/error
      const cachedRole = localStorage.getItem('awra_user_role');
      if (cachedRole) {
          setRole(cachedRole as UserRole);
      } else {
          setRole(UserRole.PENDING);
      }
    }
  };

  useEffect(() => {
    // 1. Get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(session);
        setUser(session?.user || null);
        if (session?.user) {
          fetchProfileAndRole(session.user.id);
        } else {
          setRole(null);
          localStorage.removeItem('awra_user_role');
        }
      } catch (err: any) {
        const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.warn("Session fetch error (likely offline):", errorMessage);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user || null);
      
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the email link. Redirect to profile to set new password.
        navigate('/profile');
      }

      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
            setLoading(true);
            await fetchProfileAndRole(session.user.id);
            setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
            // Background refresh
            fetchProfileAndRole(session.user.id);
        }
      } else {
        setRole(null);
        localStorage.removeItem('awra_user_role');
        if (event === 'SIGNED_OUT') {
            setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      console.warn("SignOut error", e.message || e);
    }
    setRole(null);
    setUser(null);
    setSession(null);
    localStorage.removeItem('awra_user_role');
    navigate('/');
  };

  const isPending = role === UserRole.PENDING;

  return (
    <AuthContext.Provider value={{ session, user, role, loading, isPending, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
