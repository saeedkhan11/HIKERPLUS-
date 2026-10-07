import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Field } from '../components/ui';
import Logo from '../components/Logo';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Login({ notConfigured }) {
  const { session, login, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/verify-pin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await signUp(form.email, form.password, form.name);
        setError('Check your email to confirm your account, then sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo className="h-14 w-14 rounded-2xl" size={26} />
          <h1 className="text-xl font-extrabold">HIKER+ Shoes Factory</h1>
          <p className="microlabel">ERP Login</p>
        </div>
        <div className="rounded-2xl border border-borderc bg-card p-6 shadow-card">
          {notConfigured ? (
            <div className="rounded-lg bg-amber-50 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-amber-800">Supabase is not configured</p>
              <p className="mt-2 text-[12px] text-amber-700">
                Set <code className="num">VITE_SUPABASE_URL</code> and <code className="num">VITE_SUPABASE_ANON_KEY</code> in the environment to connect your database.
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              {mode === 'register' && (
                <Field label="Full name">
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Your name" />
                </Field>
              )}
              <Field label="Email or Username">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="you@factory.pk" />
              </Field>
              <Field label="Password">
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="••••••" />
              </Field>
              {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
              <Button type="submit" className="w-full justify-center" disabled={busy}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          )}
          {!notConfigured && (
            <div className="mt-4 text-center text-xs text-mutedfg">
              {mode === 'login' ? (
                <>New user? <button className="font-semibold text-teal" onClick={() => setMode('register')}>Create an account</button></>
              ) : (
                <>Already registered? <button className="font-semibold text-teal" onClick={() => setMode('login')}>Sign in</button></>
              )}
            </div>
          )}
        </div>
        {!notConfigured && (
          <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-[11px] text-mutedfg">
            No demo credentials — use your own Supabase Auth account.
          </div>
        )}
      </div>
    </div>
  );
}
