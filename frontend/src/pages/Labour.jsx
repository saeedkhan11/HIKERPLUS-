import { useEffect, useState } from 'react';
import { fetchLabour, saveLabour, deleteLabour, fetchLabourPayments, createLabourPayment, fetchLabourBalance } from '../lib/services';
import { downloadCSV, fmtRs, fmtNum, today, daysAgo } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, Textarea, PageHeader, Badge, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { Pencil, Trash2, Plus, Download, Printer, Wallet, History } from 'lucide-react';

const BLANK = { name: '', phone: '', address: '', labour_type: '', rate: '', notes: '', is_active: true };

export default function Labour() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetchLabour().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.rate = Number(body.rate) || 0;
    body.is_active = body.is_active !== 'false';
    setError('');
    try {
      if (editing.id) await saveLabour({ ...editing, ...body });
      else await saveLabour(body);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm(`Move "${row.name}" to the recycle bin?`)) return;
    await deleteLabour(row.id);
    load();
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.amount = Number(body.amount) || 0;
    setError('');
    try {
      await createLabourPayment({
        labour_id: payForm.labour.id,
        amount: body.amount,
        payment_type: body.payment_type,
        date: body.date || today(),
        description: body.description || '',
      });
      setPayForm(null);
      if (ledger?.party?.id === payForm.labour.id) showLedger(payForm.labour);
      load();
    } catch (err) { setError(err.message); }
  };

  const showLedger = async (row) => {
    setLedger({ loading: true, party: row });
    try {
      const [balance, payments] = await Promise.all([
        fetchLabourBalance(row.id),
        fetchLabourPayments(row.id),
      ]);
      setLedger({ ...balance, payments, loading: false, party: row });
    } catch (e) {
      setLedger({ loading: false, party: row, error: e.message });
    }
  };

  const filtered = rows.filter((r) =>
    [r.name, r.phone, r.labour_type].join(' ').toLowerCase().includes(q.toLowerCase()));

  const totalRate = rows.reduce((s, r) => s + (Number(r.rate) || 0), 0);
  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <div>
      <PageHeader
        label="Accounts"
        title="Labour"
        description="Manage labour workforce — track advances, payments and balances."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('labour.csv',
              ['Name', 'Phone', 'Type', 'Rate', 'Active'],
              rows.map((r) => [r.name, r.phone, r.labour_type, r.rate, r.is_active]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button onClick={() => setEditing({ ...BLANK })}><Plus size={15} /> Add labour</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total labour" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Active" value={fmtNum(activeCount)} accent="teal" />
        <StatCard label="Daily rate total" value={fmtRs(totalRate)} accent="ink" />
        <StatCard label="Types" value={fmtNum(new Set(rows.map((r) => r.labour_type).filter(Boolean)).size)} accent="copper" />
      </div>

      <Card title="Labour register">
        <div className="mb-3 px-4 pt-3">
          <Input placeholder="Search labour…" value={q} onChange={(e) => setQ(e.target.value)} className="!w-64" />
        </div>
        {filtered.length === 0 ? <Empty>No labour records yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Phone</th><th>Type</th><th className="text-right">Rate</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.name}</td>
                    <td className="num">{r.phone || '—'}</td>
                    <td className="text-mutedfg">{r.labour_type || '—'}</td>
                    <td className="num text-right">{fmtRs(r.rate)}</td>
                    <td><Badge tone={r.is_active ? 'active' : 'inactive'}>{r.is_active ? 'active' : 'inactive'}</Badge></td>
                    <td className="whitespace-nowrap">
                      <IconButton onClick={() => setPayForm({ labour: r })} title="Payment"><Wallet size={14} /></IconButton>
                      <IconButton onClick={() => showLedger(r)} title="History"><History size={14} /></IconButton>
                      <IconButton onClick={() => setEditing(r)}><Pencil size={14} /></IconButton>
                      <IconButton onClick={() => remove(r)}><Trash2 size={14} /></IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Dialog title={editing.id ? `Edit ${editing.name}` : 'Add labour'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *" className="col-span-2"><Input name="name" defaultValue={editing.name} required autoFocus /></Field>
              <Field label="Phone"><Input name="phone" defaultValue={editing.phone} /></Field>
              <Field label="Labour type"><Input name="labour_type" defaultValue={editing.labour_type} placeholder="e.g. Stitcher, Cutter" /></Field>
              <Field label="Address" className="col-span-2"><Input name="address" defaultValue={editing.address} /></Field>
              <Field label="Daily rate (Rs)"><Input name="rate" type="number" min="0" step="any" defaultValue={editing.rate} /></Field>
              <Field label="Status">
                <Select name="is_active" defaultValue={String(editing.is_active ?? true)}>
                  <option value="true">active</option>
                  <option value="false">inactive</option>
                </Select>
              </Field>
              <Field label="Notes" className="col-span-2"><Textarea name="notes" defaultValue={editing.notes} /></Field>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Dialog>
      )}

      {payForm && (
        <Dialog title={`Payment — ${payForm.labour.name}`} onClose={() => setPayForm(null)}>
          <form onSubmit={submitPayment} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment type">
                <Select name="payment_type" defaultValue="payment">
                  <option value="payment">Payment</option>
                  <option value="advance">Advance</option>
                </Select>
              </Field>
              <Field label="Amount (Rs) *"><Input name="amount" type="number" min="0" step="any" required /></Field>
              <Field label="Date"><Input name="date" type="date" defaultValue={today()} /></Field>
              <Field label="Description" className="col-span-2"><Textarea name="description" placeholder="Work details…" /></Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPayForm(null)}>Cancel</Button>
              <Button type="submit">Record payment</Button>
            </div>
          </form>
        </Dialog>
      )}

      {ledger && (
        <Dialog title={`History — ${ledger.party?.name}`} onClose={() => setLedger(null)} wide>
          <div className="p-5">
            {ledger.loading ? <Empty>Loading…</Empty> : ledger.error ? <Empty>{ledger.error}</Empty> : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-muted p-2"><div className="microlabel">Daily rate</div><div className="num font-bold">{fmtRs(ledger.rate)}</div></div>
                  <div className="rounded-lg bg-muted p-2"><div className="microlabel">Total advance</div><div className="num font-bold text-amber-700">{fmtRs(ledger.total_advance)}</div></div>
                  <div className="rounded-lg bg-muted p-2"><div className="microlabel">Balance</div><div className={`num font-bold ${ledger.balance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtRs(ledger.balance)}</div></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-borderc">
                  <table className="tbl">
                    <thead><tr><th>Date</th><th>Description</th><th className="text-right">Advance</th><th className="text-right">Payment</th><th className="text-right">Balance</th></tr></thead>
                    <tbody>
                      {(ledger.lines || []).length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-mutedfg">No transactions yet.</td></tr>
                      ) : (ledger.lines || []).map((l, i) => (
                        <tr key={i}>
                          <td className="num text-mutedfg">{l.date}</td>
                          <td>{l.description}</td>
                          <td className="num text-right">{l.credit ? fmtRs(l.credit) : '—'}</td>
                          <td className="num text-right">{l.debit ? fmtRs(l.debit) : '—'}</td>
                          <td className="num text-right font-bold">{fmtRs(l.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
