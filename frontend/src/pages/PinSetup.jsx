import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Field } from '../components/ui';
import Logo from '../components/Logo';

export default function PinSetup() {
  const {
    session,
    hasPin,
    pinVerified,
    setupPin,
  } = useAuth();

  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If PIN was already created and verified in this session,
  // go directly to the dashboard.
  if (hasPin && pinVerified) {
    return <Navigate to="/" replace />;
  }

  // If a PIN already exists but has not been verified,
  // go to the PIN verification screen.
  if (hasPin) {
    return <Navigate to="/verify-pin" replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4,8}$/.test(pin)) {
      setError('PIN must contain 4 to 8 digits');
      return;
    }

    if (pin !== confirm) {
      setError('PINs do not match');
      return;
    }

    setBusy(true);

    try {
      await setupPin(pin);

      // setupPin() sets pinVerified=true.
      // The component will then redirect to Dashboard.
    } catch (err) {
      setError(err?.message || 'Failed to set up PIN');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo className="h-14 w-14 rounded-2xl" size={26} />

          <h1 className="text-xl font-extrabold">
            Set up your PIN
          </h1>

          <p className="microlabel">
            Security Step · Required
          </p>
        </div>

        <div className="rounded-2xl border border-borderc bg-card p-6 shadow-card">
          <p className="mb-4 text-[12px] text-mutedfg">
            This PIN adds a second layer of security. You'll enter it after
            every login. It is stored as a secure hash — never in plain text.
          </p>

          <form onSubmit={submit}>
            <Field label="New PIN (digits only)">
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                placeholder="••••"
                maxLength={8}
                autoFocus
              />
            </Field>

            <Field label="Confirm PIN">
              <Input
                type="password"
                inputMode="numeric"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••"
                maxLength={8}
              />
            </Field>

            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full justify-center"
              disabled={busy}
            >
              {busy ? 'Setting up…' : 'Set PIN'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
