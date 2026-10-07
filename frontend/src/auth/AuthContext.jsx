import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pinVerified, setPinVerified] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, workspace_members(workspace_id, role)')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setProfile(data);
      return data;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        setSession(s);
        await loadProfile(s.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setPinVerified(false);
      if (s) {
        await loadProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      await loadProfile(data.user.id);
    }
    return data;
  };

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setPinVerified(false);
  };

  const verifyPin = async (pin) => {
    const { data, error } = await supabase.rpc('verify_pin', {
      p_user_id: session.user.id,
      p_pin: pin,
    });
    if (error) throw error;
    if (data) {
      setPinVerified(true);
      return true;
    }
    return false;
  };

  const setupPin = async (pin) => {
    const { error } = await supabase.rpc('setup_pin', {
      p_user_id: session.user.id,
      p_pin: pin,
    });
    if (error) throw error;
    await loadProfile(session.user.id);
  };

  const changePin = async (oldPin, newPin) => {
    const { error } = await supabase.rpc('change_pin', {
      p_user_id: session.user.id,
      p_old_pin: oldPin,
      p_new_pin: newPin,
    });
    if (error) throw error;
  };

  const hasPin = Boolean(profile?.pin_hash);

  return (
    <AuthCtx.Provider
      value={{
        session,
        profile,
        loading,
        pinVerified,
        isSupabaseConfigured,
        login,
        signUp,
        signOut,
        verifyPin,
        setupPin,
        changePin,
        hasPin,
        reloadProfile: () => loadProfile(session?.user?.id),
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
