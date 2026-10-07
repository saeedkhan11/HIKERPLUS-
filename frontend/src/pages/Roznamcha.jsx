import { useEffect, useState } from 'react';
import { fetchRoznamcha, createRoznamchaEntry, supabase } from '../lib/services';
import { downloadCSV, fmtRs, fmtNum, today, daysAgo } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, Textarea, PageHeader, Badge, Empty, StatCard, DateRange } from '../components/ui';
import { Plus, Download, Printer } from 'lucide-react';

export default function Roznamcha() {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: 'cash_in', amount: '', date: today(), description: '' });
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    fetchRoznamcha(from, to).then(setRows).catch((e) => setError(e.message));
    supabase.rpc('get_cash_balance').then(({ data }) => data && setBalance(data)).catch(() => {});
  };
  useEffect(() => { load(); }, [from, to]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createRoznamchaEntry({
        type: form.type,
        amount: Number(form.amount) || 0,
        date: form.date,
        description: form.description,
        reference_type: 'manual',
      });
      setCreating(false);
      setForm({ type: 'cash_in', amount: '', date: today(), description: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const totalIn = rows.filter((r) => r.type === 'cash_in').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOut = rows.filter((r) => r.type === 'cash_out').reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      <PageHeader
        label="Accounts"
        title="Roznamcha (Cashbook)"
        description="Every cash transaction — invoice payments, supplier payments, expenses and manual entries."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('roznamcha.csv',
              ['Date', 'Type', 'Amount', 'Description'],
              rows.map((r) => [r.date, r.type, r.amount, r.description]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button onClick={() => setCreating(true)}><Plus size={15} /> New entry</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cash in" value={fmtRs(totalIn)} accent="teal" />
        <StatCard label="Cash out" value={fmtRs(totalOut)} accent="copper" />
        <StatCard label="Net flow" value={fmtRs(totalIn - totalOut)} accent="ink" />
        <StatCard label="Current balance" value={fmtRs(balance?.balance ?? (totalIn - totalOut))} accent="copper" />
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(30)); setTo(today()); }} />

      <Card title="Cashbook entries">
        {rows.length === 0 ? <Empty>No entries in this range.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Type</th><th className="text-right">Amount</th><th>Description</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td><Badge tone={r.type === 'cash_in' ? 'in' : 'out'}>{r.type === 'cash_in' ? 'Cash in' : 'Cash out'}</Badge></td>
                    <td className={`num text-right font-bold ${r.type === 'cash_in' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {r.type === 'cash_in' ? '+' : '−'}{fmtRs(r.amount)}
                    </td>
                    <td className="text-mutedfg">{r.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <Dialog title="New cashbook entry" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="cash_in">Cash in</option>
                  <option value="cash_out">Cash out</option>
                </Select>
              </Field>
              <Field label="Amount (Rs) *"><Input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit">Save entry</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
