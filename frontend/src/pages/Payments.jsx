import { useEffect, useState } from 'react';
import { fetchPayments, createPayment, deletePayment, fetchParties } from '../lib/services';
import { downloadCSV, fmtRs, fmtNum, today, daysAgo } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, Textarea, PageHeader, Badge, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { Trash2, Plus, Download, Printer } from 'lucide-react';

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [parties, setParties] = useState([]);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ party_type: 'customer', party_id: '', amount: '', method: 'cash', date: today(), description: '', reference: '' });
  const [error, setError] = useState('');

  const load = () => fetchPayments(from, to).then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    fetchParties('customers').then(setParties).catch(() => {});
  }, [from, to]);

  const openCreate = (type) => {
    setForm({ party_type: type, party_id: '', amount: '', method: 'cash', date: today(), description: '', reference: '' });
    fetchParties(type === 'customer' ? 'customers' : 'suppliers').then(setParties).catch(() => {});
    setCreating(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createPayment({
        p_party_type: form.party_type,
        p_party_id: form.party_id,
        p_amount: Number(form.amount) || 0,
        p_method: form.method,
        p_date: form.date,
        p_description: form.description,
        p_reference: form.reference,
      });
      setCreating(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm('Move this payment to the recycle bin?')) return;
    await deletePayment(row.id);
    load();
  };

  const totalIn = rows.filter((r) => r.party_type === 'customer').reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOut = rows.filter((r) => r.party_type === 'supplier').reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      <PageHeader
        label="Accounts"
        title="Payments"
        description="Record customer and supplier payments — ledgers and cashbook update automatically."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('payments.csv',
              ['Date', 'Type', 'Party', 'Amount', 'Method', 'Reference'],
              rows.map((r) => [r.date, r.party_type, r.party_name, r.amount, r.method, r.reference]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button variant="secondary" size="sm" onClick={() => openCreate('supplier')}><Plus size={15} /> Supplier payment</Button>
            <Button onClick={() => openCreate('customer')}><Plus size={15} /> Customer payment</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Payments" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Received (customers)" value={fmtRs(totalIn)} accent="teal" />
        <StatCard label="Paid (suppliers)" value={fmtRs(totalOut)} accent="ink" />
        <StatCard label="Net" value={fmtRs(totalIn - totalOut)} accent="copper" />
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(30)); setTo(today()); }} />

      <Card title="Payment register">
        {rows.length === 0 ? <Empty>No payments in this range.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Type</th><th>Party</th><th className="text-right">Amount</th><th>Method</th><th>Reference</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td><Badge tone={r.party_type === 'customer' ? 'in' : 'out'}>{r.party_type}</Badge></td>
                    <td className="font-semibold">{r.party_name || '—'}</td>
                    <td className="num text-right font-bold">{fmtRs(r.amount)}</td>
                    <td className="text-mutedfg">{r.method || 'cash'}</td>
                    <td className="text-mutedfg">{r.reference || '—'}</td>
                    <td><IconButton onClick={() => remove(r)}><Trash2 size={14} /></IconButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <Dialog title={`${form.party_type === 'customer' ? 'Customer' : 'Supplier'} payment`} onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label={form.party_type === 'customer' ? 'Customer *' : 'Supplier *'} className="col-span-2">
                <Select value={form.party_id} onChange={(e) => setForm({ ...form, party_id: e.target.value })} required>
                  <option value="">Select…</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Amount (Rs) *"><Input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Method">
                <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="account">Account (bank transfer)</option>
                </Select>
              </Field>
              <Field label="Reference"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Invoice no, cheque no…" /></Field>
              <Field label="Description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit">Record payment</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
