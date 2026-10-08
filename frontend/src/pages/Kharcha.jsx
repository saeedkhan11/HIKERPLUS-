import { useEffect, useState } from 'react';
import { fetchKharcha, createKharcha, deleteKharcha } from '../lib/services';
import { downloadCSV, fmtRs, fmtNum, today, daysAgo } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, Textarea, PageHeader, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { Trash2, Plus, Download, Printer } from 'lucide-react';

const CATEGORIES = ['rent', 'utilities', 'salaries', 'transport', 'maintenance', 'raw_materials', 'marketing', 'labour', 'other'];

export default function Kharcha() {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: 'other', details: '', amount: '', expense_date: today() });
  const [error, setError] = useState('');

  const load = () => fetchKharcha(from, to).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [from, to]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createKharcha({
        title: form.title,
        details: form.details,
        amount: Number(form.amount) || 0,
        expense_date: form.expense_date,
      });
      setCreating(false);
      setForm({ title: 'other', details: '', amount: '', expense_date: today() });
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm('Delete this expense?')) return;
    await deleteKharcha(row.id);
    load();
  };

  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    total: rows.filter((r) => r.category === c).reduce((s, r) => s + (Number(r.amount) || 0), 0),
  })).filter((c) => c.total > 0);

  return (
    <div>
      <PageHeader
        label="Accounts"
        title="Kharcha (Expenses)"
        description="Record factory expenses — each entry posts to the cashbook automatically."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('kharcha.csv',
              ['Date', 'Category', 'Amount', 'Description'],
              rows.map((r) => [r.date, r.category, r.amount, r.description]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button onClick={() => setCreating(true)}><Plus size={15} /> New expense</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Entries" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Total expenses" value={fmtRs(totalAmount)} accent="ink" />
        <StatCard label="Categories" value={fmtNum(byCategory.length)} accent="teal" />
        <StatCard label="Avg per entry" value={fmtRs(totalAmount / (rows.length || 1))} accent="copper" />
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(30)); setTo(today()); }} />

      {byCategory.length > 0 && (
        <Card title="By category" className="mb-4">
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            {byCategory.map((c) => (
              <div key={c.category} className="rounded-lg bg-muted p-3">
                <div className="microlabel">{c.category}</div>
                <div className="num mt-1 text-[15px] font-bold">{fmtRs(c.total)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Expense register">
        {rows.length === 0 ? <Empty>No expenses in this range.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Category</th><th className="text-right">Amount</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td className="font-semibold">{r.category}</td>
                    <td className="num text-right font-bold">{fmtRs(r.amount)}</td>
                    <td className="text-mutedfg">{r.description || '—'}</td>
                    <td><IconButton onClick={() => remove(r)}><Trash2 size={14} /></IconButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <Dialog title="New expense" onClose={() => setCreating(false)}>
          <form onSubmit={submit} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category / Title">
                <Select value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Amount (Rs) *"><Input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
              <Field label="Date"><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
              <Field label="Details" className="col-span-2"><Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit">Save expense</Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
