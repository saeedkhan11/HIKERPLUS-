import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    setProfileLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('loadProfile error:', error);
        setProfile(null);
        return null;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', userId);

      if (membershipError) {
        console.error(
          'workspace_members error:',
          membershipError
        );
      }

      const profileWithMembership = {
        ...(data || {}),
        workspace_members: membership || [],
      };

      setProfile(profileWithMembership);
      return profileWithMembership;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const initialize = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);

        if (mounted) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!mounted) return;

        setSession(currentSession);
        setPinVerified(false);

        if (currentSession) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw error;
    }

    if (data.session) {
      setSession(data.session);
      setPinVerified(false);

      await loadProfile(data.user.id);

      supabase
        .rpc('log_action', {
          p_action: 'login',
          p_table: '',
          p_record_id: null,
          p_details: null,
        })
        .catch(() => {});
    }

    return data;
  };

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  };

  const signOut = async () => {
    try {
      await supabase.rpc('log_action', {
        p_action: 'logout',
        p_table: '',
        p_record_id: null,
        p_details: null,
      });
    } catch {}

    await supabase.auth.signOut();

    setSession(null);
    setProfile(null);
    setPinVerified(false);
  };

  const verifyPin = async (pin) => {
    if (!session?.user?.id) {
      throw new Error('No active session');
    }

    const { data, error } = await supabase.rpc('verify_pin', {
      p_pin: pin,
    });

    if (error) {
      console.error('verify_pin error:', error);
      throw error;
    }

    if (data === true) {
      setPinVerified(true);
      return true;
    }

    return false;
  };

  const setupPin = async (pin) => {
    if (!session?.user?.id) {
      throw new Error('No active session');
    }

    const { data, error } = await supabase.rpc('setup_pin', {
      p_pin: pin,
    });

    if (error) {
      console.error('setup_pin error:', error);
      throw error;
    }

    if (data !== true) {
      throw new Error('PIN setup was not completed');
    }

    setProfile((currentProfile) => {
      if (!currentProfile) {
        return currentProfile;
      }

      return {
        ...currentProfile,
        pin_enabled: true,
      };
    });

    setPinVerified(true);

    await loadProfile(session.user.id);
  };

  const changePin = async (oldPin, newPin) => {
    if (!session?.user?.id) {
      throw new Error('No active session');
    }

    const { data, error } = await supabase.rpc('change_pin', {
      p_old_pin: oldPin,
      p_new_pin: newPin,
    });

    if (error) {
      console.error('change_pin error:', error);
      throw error;
    }

    if (data !== true) {
      throw new Error('PIN change was not completed');
    }

    return true;
  };

  const hasPin = Boolean(profile?.pin_enabled);

  const isAdmin =
    profile?.workspace_members?.[0]?.role === 'admin';

  const authLoading = loading || profileLoading;

  return (
    <AuthCtx.Provider
      value={{
        session,
        profile,
        loading: authLoading,
        pinVerified,
        isSupabaseConfigured,
        login,
        signUp,
        signOut,
        verifyPin,
        setupPin,
        changePin,
        hasPin,
        isAdmin,
        reloadProfile: () =>
          loadProfile(session?.user?.id),
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
