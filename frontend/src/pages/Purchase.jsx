import { useEffect, useState } from 'react';
import { fetchPurchases, createPurchase, deletePurchase, fetchParties, fetchArticles } from '../lib/services';
import { downloadCSV, fmtNum, fmtRs, today, daysAgo } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, Textarea, PageHeader, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { ClickableRow, rowAction, RecordDialog } from '../components/RecordDialog';
import { Trash2, Plus, Download, Printer } from 'lucide-react';

const BLANK = { supplier_id: '', article_id: '', size: '', color: '', quantity: '', rate: '', notes: '', purchase_date: today() };

export default function Purchase() {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetchPurchases(from, to).then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    fetchParties('suppliers').then(setSuppliers).catch(() => {});
    fetchArticles().then(setArticles).catch(() => {});
  }, [from, to]);

  const total = (Number(form.quantity) || 0) * (Number(form.rate) || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) { setError('Supplier is required'); return; }
    setError('');
    try {
      const supplier = suppliers.find((s) => s.id === form.supplier_id);
      const article = articles.find((a) => a.id === form.article_id);
      await createPurchase({
        supplier_id: form.supplier_id,
        supplier_name: supplier?.name || '',
        article_id: form.article_id || null,
        article_name: article?.name || form.article_name || '',
        size: form.size,
        color: form.color,
        quantity: Number(form.quantity),
        rate: Number(form.rate),
        notes: form.notes,
        purchase_date: form.purchase_date,
      });
      setCreating(false);
      setForm(BLANK);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm('Move this purchase to the recycle bin?')) return;
    await deletePurchase(row.id);
    load();
  };

  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      <PageHeader
        label="Production"
        title="Purchase"
        description="Record purchases from suppliers — stock increases and supplier ledger updates automatically."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('purchases.csv',
              ['Date', 'Supplier', 'Item', 'Quantity', 'Rate', 'Amount'],
              rows.map((r) => [r.date, r.supplier?.name, r.item, r.quantity, r.unit_price, r.amount]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button onClick={() => setCreating(true)}><Plus size={15} /> New purchase</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Purchases" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Total value" value={fmtRs(totalAmount)} accent="teal" />
        <StatCard label="Suppliers" value={fmtNum(new Set(rows.map((r) => r.supplier_id)).size)} accent="ink" />
        <StatCard label="Avg per purchase" value={fmtRs(totalAmount / (rows.length || 1))} accent="copper" />
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(30)); setTo(today()); }} />

      <Card title="Purchase register">
        {rows.length === 0 ? <Empty>No purchases in this range.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Supplier</th><th>Item</th><th>Size</th><th>Color</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <ClickableRow key={r.id} onOpen={() => setDetail(r)}>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td className="font-semibold">{r.supplier?.name || '—'}</td>
                    <td>{r.item}</td>
                    <td className="text-mutedfg">{r.size || '—'}</td>
                    <td className="text-mutedfg">{r.color || '—'}</td>
                    <td className="num text-right">{fmtNum(r.quantity)}</td>
                    <td className="num text-right">{fmtRs(r.unit_price)}</td>
                    <td className="num text-right font-bold">{fmtRs(r.amount)}</td>
                    <td><IconButton onClick={rowAction(() => remove(r))}><Trash2 size={14} /></IconButton></td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <Dialog title="New purchase" onClose={() => setCreating(false)} wide>
          <form onSubmit={submit} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supplier *" className="col-span-2">
                <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} required>
                  <option value="">Select…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Article" className="col-span-2">
                <Select value={form.article_id} onChange={(e) => setForm({ ...form, article_id: e.target.value })}>
                  <option value="">—</option>
                  {articles.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </Select>
              </Field>
              <Field label="Size"><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 42" /></Field>
              <Field label="Color"><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="e.g. Black" /></Field>
              <Field label="Quantity *"><Input type="number" min="1" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></Field>
              <Field label="Rate (Rs) *"><Input type="number" min="0" step="any" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required /></Field>
              <Field label="Purchase date"><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
              <Field label="Total (auto)"><Input readOnly value={fmtRs(total)} className="font-bold" /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit">Save purchase</Button>
            </div>
          </form>
        </Dialog>
      )}

      {detail && (
        <RecordDialog
          title={detail.item}
          subtitle={`${detail.supplier?.name || ''} · ${detail.date}`}
          onClose={() => setDetail(null)}
          fields={[
            ['Supplier', detail.supplier?.name || '—'],
            ['Size', detail.size || '—'],
            ['Color', detail.color || '—'],
            ['Quantity', fmtNum(detail.quantity)],
            ['Rate', fmtRs(detail.unit_price)],
            ['Amount', fmtRs(detail.amount)],
            ['Notes', detail.notes || '—'],
            ['Date', detail.date],
          ]}
        />
      )}
    </div>
  );
}
