import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchAccountingMe } from '../utils/accountingApi';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [accountingUser, setAccountingUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  async function verifyAccess(nextSession) {
    if (!nextSession?.access_token) {
      setAccountingUser(null);
      return null;
    }

    const profile = await fetchAccountingMe(nextSession.access_token);
    setAccountingUser(profile);
    setAuthError('');
    return profile;
  }

  useEffect(() => {
    let isDisposed = false;

    async function bootstrap() {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (isDisposed) {
        return;
      }

      setSession(initialSession);

      if (initialSession) {
        try {
          await verifyAccess(initialSession);
        } catch (error) {
          setAuthError(error.message || 'This account is not authorised for COSA Accounting.');
          setAccountingUser(null);
          await supabase.auth.signOut();
          setSession(null);
        }
      }

      setIsAuthLoading(false);
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isDisposed) {
        return;
      }

      setSession(nextSession);

      if (!nextSession) {
        setAccountingUser(null);
        setAuthError('');
        return;
      }

      void verifyAccess(nextSession).catch(async (error) => {
        setAuthError(error.message || 'This account is not authorised for COSA Accounting.');
        setAccountingUser(null);
        await supabase.auth.signOut();
        setSession(null);
      });
    });

    return () => {
      isDisposed = true;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    setAuthError('');
    setIsAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      await verifyAccess(data.session);
      setSession(data.session);
      return data;
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setAccountingUser(null);
    setAuthError('');
  }

  const value = useMemo(
    () => ({
      session,
      accountingUser,
      isAuthLoading,
      authError,
      isLoggedIn: Boolean(session && accountingUser),
      isOwner: accountingUser?.role === 'owner',
      canEdit: ['owner', 'accountant'].includes(accountingUser?.role),
      login,
      logout,
    }),
    [session, accountingUser, isAuthLoading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
