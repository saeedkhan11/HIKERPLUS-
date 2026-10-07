import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui';
import Logo from '../components/Logo';

export default function PinVerify() {
  const { session, hasPin, verifyPin, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef(null);

  if (!hasPin) return <Navigate to="/setup-pin" replace />;
  if (!session) return <Navigate to="/login" replace />;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async (e) => {
    e?.preventDefault();
    if (!pin) return;
    setBusy(true);
    setError('');
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        setAttempts((a) => a + 1);
        setError('Incorrect PIN. Please try again.');
        setPin('');
        inputRef.current?.focus();
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
          <h1 className="text-xl font-extrabold">Enter your PIN</h1>
          <p className="microlabel">Security Verification</p>
        </div>
        <div className="rounded-2xl border border-borderc bg-card p-6 shadow-card">
          <form onSubmit={submit}>
            <div className="mb-4 flex justify-center gap-2">
              {Array.from({ length: Math.max(pin.length, 4) }).slice(0, 8).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors ${i < pin.length ? 'bg-teal' : 'bg-muted border border-borderc'}`}
                />
              ))}
            </div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="sr-only"
              maxLength={8}
              autoFocus
            />
            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9'].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPin((p) => (p.length < 8 ? p + n : p))}
                  className="h-12 rounded-lg border border-borderc bg-card font-heading text-lg font-bold transition-colors hover:bg-muted"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin((p) => p.slice(0, -1))}
                className="h-12 rounded-lg border border-borderc bg-card font-heading text-sm font-bold text-mutedfg transition-colors hover:bg-muted"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={() => setPin((p) => (p.length < 8 ? p + '0' : p))}
                className="h-12 rounded-lg border border-borderc bg-card font-heading text-lg font-bold transition-colors hover:bg-muted"
              >
                0
              </button>
              <button
                type="submit"
                disabled={busy || !pin}
                className="h-12 rounded-lg bg-teal font-heading text-sm font-bold text-white transition-colors hover:bg-teal/85 disabled:opacity-50"
              >
                ✓
              </button>
            </div>
            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
            {attempts >= 3 && (
              <div className="mt-2 text-center text-[11px] text-amber-700">
                Multiple failed attempts. Consider signing out and trying again.
              </div>
            )}
          </form>
          <button
            onClick={signOut}
            className="mt-4 w-full text-center text-[11px] font-semibold text-mutedfg hover:text-fg"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
