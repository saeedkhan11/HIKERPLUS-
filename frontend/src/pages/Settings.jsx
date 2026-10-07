import { useEffect, useState } from 'react';
import { fetchSettings, saveSettings } from '../lib/services';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Field, Input, Textarea, PageHeader } from '../components/ui';
import { Save, ShieldCheck } from 'lucide-react';

export default function Settings() {
  const { profile, changePin, isAdmin } = useAuth();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [pinForm, setPinForm] = useState({ old: '', new: '', confirm: '' });
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    fetchSettings().then((s) => { setSettings(s); setForm(s || {}); }).catch((e) => setError(e.message));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const updated = await saveSettings(form);
      setSettings(updated);
      setSaved(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const submitPin = async (e) => {
    e.preventDefault();
    setPinMsg('');
    if (pinForm.new.length < 4) { setPinMsg('PIN must be at least 4 digits'); return; }
    if (pinForm.new !== pinForm.confirm) { setPinMsg('PINs do not match'); return; }
    if (!/^\d+$/.test(pinForm.new)) { setPinMsg('PIN must contain only digits'); return; }
    try {
      await changePin(pinForm.old, pinForm.new);
      setPinMsg('PIN changed successfully');
      setPinForm({ old: '', new: '', confirm: '' });
    } catch (err) { setPinMsg(err.message); }
  };

  return (
    <div>
      <PageHeader label="System" title="Settings" description="Configure your business information, invoice details and security." />

      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}
      {saved && <div className="mb-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Settings saved successfully.</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Business information">
          <form onSubmit={save} className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company name" className="col-span-2"><Input value={form.company_name || ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
              <Field label="Tagline"><Input value={form.tagline || ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
              <Field label="Currency"><Input value={form.currency || 'Rs'} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
              <Field label="Address" className="col-span-2"><Textarea value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Pairs per carton"><Input type="number" value={form.pairs_per_carton || 24} onChange={(e) => setForm({ ...form, pairs_per_carton: Number(e.target.value) })} /></Field>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" disabled={busy}><Save size={15} /> {busy ? 'Saving…' : 'Save'}</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Bank / invoice details">
            <form onSubmit={save} className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank name" className="col-span-2"><Input value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
                <Field label="Account title"><Input value={form.account_title || ''} onChange={(e) => setForm({ ...form, account_title: e.target.value })} /></Field>
                <Field label="Account no."><Input value={form.account_no || ''} onChange={(e) => setForm({ ...form, account_no: e.target.value })} /></Field>
                <Field label="IBAN" className="col-span-2"><Input value={form.iban || ''} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></Field>
                <Field label="Invoice footer note" className="col-span-2"><Textarea value={form.footer_note || ''} onChange={(e) => setForm({ ...form, footer_note: e.target.value })} /></Field>
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={busy}><Save size={15} /> Save</Button>
              </div>
            </form>
          </Card>

          <Card title="Change PIN" accent="copper">
            <form onSubmit={submitPin} className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Current PIN" className="col-span-2"><Input type="password" inputMode="numeric" value={pinForm.old} onChange={(e) => setPinForm({ ...pinForm, old: e.target.value })} required /></Field>
                <Field label="New PIN"><Input type="password" inputMode="numeric" value={pinForm.new} onChange={(e) => setPinForm({ ...pinForm, new: e.target.value })} maxLength={8} /></Field>
                <Field label="Confirm PIN"><Input type="password" inputMode="numeric" value={pinForm.confirm} onChange={(e) => setPinForm({ ...pinForm, confirm: e.target.value })} maxLength={8} /></Field>
              </div>
              {pinMsg && <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${pinMsg.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{pinMsg}</div>}
              <div className="mt-3 flex justify-end">
                <Button type="submit" variant="secondary"><ShieldCheck size={15} /> Change PIN</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
