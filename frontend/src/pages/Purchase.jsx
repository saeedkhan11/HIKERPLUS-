import { useEffect, useState } from 'react';
import { fetchPurchases, createPurchase, deletePurchase, fetchParties, fetchArticles } from '../lib/services';
import { downloadCSV, fmtNum, fmtRs, today, daysAgo, UNITS } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, PageHeader, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { ClickableRow, rowAction, RecordDialog } from '../components/RecordDialog';
import { Trash2, Plus, Download, Printer } from 'lucide-react';

const BLANK = { supplier_id: '', item: '', category_slug: 'uppers', article_code: '', pack_type: 'bag', pairs_per_pack: 100, quantity: '', unit: 'bags', unit_price: '', date: today() };

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

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createPurchase({
        p_supplier_id: Number(form.supplier_id),
        p_item: form.item,
        p_category_slug: form.category_slug,
        p_article_code: form.article_code || '',
        p_pack_type: form.pack_type,
        p_pairs_per_pack: Number(form.pairs_per_pack) || 0,
        p_quantity: Number(form.quantity) || 0,
        p_unit: form.unit,
        p_unit_price: Number(form.unit_price) || 0,
        p_date: form.date,
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
  const totalPairs = rows.reduce((s, r) => s + (Number(r.total_pairs) || 0), 0);

  return (
    <div>
      <PageHeader
        label="Production"
        title="Purchase"
        description="Record purchases from suppliers — stock increases and the supplier ledger updates automatically."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('purchases.csv',
              ['Date', 'Supplier', 'Item', 'Category', 'Quantity', 'Pairs', 'Rate', 'Amount'],
              rows.map((r) => [r.date, r.supplier?.name, r.item, r.category_slug, r.quantity, r.total_pairs, r.unit_price, r.amount]))}>
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
        <StatCard label="Total pairs" value={`${fmtNum(totalPairs)} prs`} accent="ink" />
        <StatCard label="Suppliers" value={fmtNum(new Set(rows.map((r) => r.supplier_id)).size)} accent="copper" />
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(30)); setTo(today()); }} />

      <Card title="Purchase register">
        {rows.length === 0 ? <Empty>No purchases in this range.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Supplier</th><th>Item</th><th>Category</th><th className="text-right">Qty</th><th className="text-right">Pairs</th><th className="text-right">Rate</th><th className="text-right">Amount</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <ClickableRow key={r.id} onOpen={() => setDetail(r)}>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td className="font-semibold">{r.supplier?.name || '—'}</td>
                    <td>{r.item}</td>
                    <td className="text-mutedfg">{r.category_slug}</td>
                    <td className="num text-right">{fmtNum(r.quantity)}</td>
                    <td className="num text-right">{r.total_pairs ? fmtNum(r.total_pairs) : '—'}</td>
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
              <Field label="Item / Material *" className="col-span-2">
                <Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required placeholder="e.g. Full-grain upper" />
              </Field>
              <Field label="Category">
                <Select value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })}>
                  {['uppers', 'chemicals', 'laces', 'soles', 'packaging', 'other'].map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Article code">
                <Select value={form.article_code} onChange={(e) => setForm({ ...form, article_code: e.target.value })}>
                  <option value="">—</option>
                  {articles.map((a) => <option key={a.id} value={a.code}>{a.code} — {a.name}</option>)}
                </Select>
              </Field>
              <Field label="Pack type"><Input value={form.pack_type} onChange={(e) => setForm({ ...form, pack_type: e.target.value })} placeholder="bag, kg…" /></Field>
              <Field label="Pairs per pack"><Input type="number" min="0" step="any" value={form.pairs_per_pack} onChange={(e) => setForm({ ...form, pairs_per_pack: e.target.value })} /></Field>
              <Field label="Quantity *"><Input type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></Field>
              <Field label="Unit">
                <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </Select>
              </Field>
              <Field label="Unit price (Rs)"><Input type="number" min="0" step="any" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-mutedfg">
              Total pairs: {fmtNum((Number(form.pairs_per_pack) || 0) * (Number(form.quantity) || 0))} ·
              Amount: {fmtRs((Number(form.unit_price) || 0) * (Number(form.quantity) || 0))}
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
            ['Supplier', detail.supplier?.name],
            ['Category', detail.category_slug],
            ['Article', detail.article_code || '—'],
            ['Pack type', detail.pack_type || '—'],
            ['Pairs per pack', fmtNum(detail.pairs_per_pack)],
            ['Quantity', fmtNum(detail.quantity)],
            ['Unit', detail.unit],
            ['Total pairs', fmtNum(detail.total_pairs)],
            ['Unit price', fmtRs(detail.unit_price)],
            ['Amount', fmtRs(detail.amount)],
            ['Date', detail.date],
          ]}
        />
      )}
    </div>
  );
}
