import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/ui';
import Logo from '../components/Logo';

export default function PinVerify() {
  const { session, hasPin, verifyPin, signOut, pinVerified } = useAuth();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPin) {
    return <Navigate to="/setup-pin" replace />;
  }

  if (pinVerified) {
    return <Navigate to="/" replace />;
  }

  const submit = async (e) => {
    e?.preventDefault();

    if (!pin || busy) return;

    setBusy(true);
    setError('');

    try {
      const ok = await verifyPin(pin);

      if (!ok) {
        setAttempts((a) => a + 1);
        setError('Incorrect PIN. Please try again.');
        setPin('');

        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    } catch (err) {
      setError(err?.message || 'PIN verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const addDigit = (digit) => {
    if (busy) return;

    setPin((current) => {
      if (current.length >= 8) return current;
      return current + digit;
    });

    setError('');
  };

  const removeDigit = () => {
    if (busy) return;

    setPin((current) => current.slice(0, -1));
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo className="h-14 w-14 rounded-2xl" size={26} />

          <h1 className="text-xl font-extrabold">
            Enter your PIN
          </h1>

          <p className="microlabel">
            Security Verification
          </p>
        </div>

        <div className="rounded-2xl border border-borderc bg-card p-6 shadow-card">
          <form onSubmit={submit}>
            <div className="mb-4 flex justify-center gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors ${
                    i < pin.length
                      ? 'bg-teal'
                      : 'border border-borderc bg-muted'
                  }`}
                />
              ))}
            </div>

            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                setError('');
              }}
              className="sr-only"
              maxLength={8}
              autoFocus
              aria-label="PIN"
            />

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addDigit(n)}
                  disabled={busy}
                  className="h-12 rounded-lg border border-borderc bg-card font-heading text-lg font-bold transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {n}
                </button>
              ))}

              <button
                type="button"
                onClick={removeDigit}
                disabled={busy || !pin}
                className="h-12 rounded-lg border border-borderc bg-card font-heading text-sm font-bold text-mutedfg transition-colors hover:bg-muted disabled:opacity-50"
              >
                ⌫
              </button>

              <button
                type="button"
                onClick={() => addDigit('0')}
                disabled={busy}
                className="h-12 rounded-lg border border-borderc bg-card font-heading text-lg font-bold transition-colors hover:bg-muted disabled:opacity-50"
              >
                0
              </button>

              <Button
                type="submit"
                disabled={busy || !pin}
                className="h-12 w-full justify-center"
              >
                {busy ? '...' : '✓'}
              </Button>
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            {attempts >= 3 && (
              <div className="mt-2 text-center text-[11px] text-amber-700">
                Multiple failed attempts. Consider signing out and trying
                again.
              </div>
            )}
          </form>

          <button
            type="button"
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
