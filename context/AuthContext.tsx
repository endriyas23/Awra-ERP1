
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { UserRole } from '../types';

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
        setRole(UserRole.PENDING);
        return;
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
      }
    } catch (err) {
      console.error('Auth Error:', err);
      setRole(UserRole.PENDING);
    }
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      if (session?.user) {
        fetchProfileAndRole(session.user.id);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        if (event === 'SIGNED_IN') {
            setLoading(true);
            await fetchProfileAndRole(session.user.id);
            setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
            // Background refresh
            fetchProfileAndRole(session.user.id);
        }
      } else {
        setRole(null);
        if (event === 'SIGNED_OUT') {
            setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setUser(null);
    setSession(null);
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
