import { useEffect, useState } from 'react';
import { fetchRawStock, saveRawStock, deleteRawStock, fetchArticles, fetchParties } from '../lib/services';
import { downloadCSV, fmtRs, fmtNum, today, UNITS } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, PageHeader, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { ClickableRow, rowAction, RecordDialog } from '../components/RecordDialog';
import { Pencil, Trash2, Plus, Download, Printer } from 'lucide-react';

const BLANK = { item: '', category_slug: 'uppers', article_code: '', pack_type: '', pairs_per_pack: 0, quantity: '', unit: 'pairs', unit_price: '', date: today(), notes: '' };

export default function RawStock() {
  const [rows, setRows] = useState([]);
  const [articles, setArticles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetchRawStock().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    fetchArticles().then(setArticles).catch(() => {});
    fetchParties('suppliers').then(setSuppliers).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.quantity = Number(body.quantity) || 0;
    body.pairs_per_pack = Number(body.pairs_per_pack) || 0;
    body.unit_price = Number(body.unit_price) || 0;
    body.total_pairs = body.pairs_per_pack * body.quantity;
    body.amount = body.quantity * body.unit_price;
    try {
      if (editing.id) await saveRawStock({ ...editing, ...body });
      else await saveRawStock(body);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm('Move this stock entry to the recycle bin?')) return;
    await deleteRawStock(row.id);
    load();
  };

  const totalPairs = rows.reduce((s, r) => s + (Number(r.total_pairs) || 0), 0);
  const totalValue = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      <PageHeader
        label="Stock"
        title="Raw Stock"
        description="Track raw materials and uppers — bags convert to pairs automatically. Every entry is traceable."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('raw-stock.csv',
              ['Item', 'Category', 'Article', 'Quantity', 'Unit', 'Pairs', 'Rate', 'Amount', 'Date'],
              rows.map((r) => [r.item, r.category_slug, r.article_code, r.quantity, r.unit, r.total_pairs, r.unit_price, r.amount, r.date]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button onClick={() => setEditing({ ...BLANK })}><Plus size={15} /> Add stock</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Entries" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Total pairs" value={`${fmtNum(totalPairs)} prs`} accent="teal" />
        <StatCard label="Stock value" value={fmtRs(totalValue)} accent="ink" />
        <StatCard label="Categories" value={fmtNum(new Set(rows.map((r) => r.category_slug)).size)} accent="copper" />
      </div>

      <Card title="Raw stock register">
        {rows.length === 0 ? <Empty title="No stock yet">Add your first raw material or upper entry.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Item</th><th>Category</th><th>Article</th><th className="text-right">Qty</th><th>Unit</th><th className="text-right">Pairs</th><th className="text-right">Rate</th><th className="text-right">Amount</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <ClickableRow key={r.id} onOpen={() => setDetail(r)}>
                    <td className="font-semibold">{r.item}</td>
                    <td><span className="text-mutedfg">{r.category_slug}</span></td>
                    <td className="num text-mutedfg">{r.article_code || '—'}</td>
                    <td className="num text-right">{fmtNum(r.quantity)}</td>
                    <td className="text-mutedfg">{r.unit || r.pack_type}</td>
                    <td className="num text-right">{r.total_pairs ? fmtNum(r.total_pairs) : '—'}</td>
                    <td className="num text-right">{fmtRs(r.unit_price)}</td>
                    <td className="num text-right font-bold">{fmtRs(r.amount)}</td>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td className="whitespace-nowrap">
                      <IconButton onClick={rowAction(() => setEditing(r))}><Pencil size={14} /></IconButton>
                      <IconButton onClick={rowAction(() => remove(r))}><Trash2 size={14} /></IconButton>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <Dialog title={editing.id ? 'Edit stock entry' : 'Add stock entry'} onClose={() => setEditing(null)} wide>
          <form onSubmit={save} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Item / Material *" className="col-span-2">
                <Input name="item" defaultValue={editing.item} required autoFocus placeholder="e.g. Full-grain upper — HSF-001" />
              </Field>
              <Field label="Category">
                <Select name="category_slug" defaultValue={editing.category_slug}>
                  {['uppers', 'chemicals', 'laces', 'soles', 'packaging', 'other'].map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Article code">
                <Select name="article_code" defaultValue={editing.article_code}>
                  <option value="">—</option>
                  {articles.map((a) => <option key={a.id} value={a.code}>{a.code} — {a.name}</option>)}
                </Select>
              </Field>
              <Field label="Pack type">
                <Input name="pack_type" defaultValue={editing.pack_type} placeholder="bag, pack, kg…" />
              </Field>
              <Field label="Pairs per pack">
                <Input name="pairs_per_pack" type="number" step="any" min="0" defaultValue={editing.pairs_per_pack} placeholder="0 if not pairs" />
              </Field>
              <Field label="Quantity *"><Input name="quantity" type="number" step="any" min="0" defaultValue={editing.quantity} required /></Field>
              <Field label="Unit">
                <Select name="unit" defaultValue={editing.unit}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </Select>
              </Field>
              <Field label="Unit price (Rs)"><Input name="unit_price" type="number" step="any" min="0" defaultValue={editing.unit_price} /></Field>
              <Field label="Supplier">
                <Select name="supplier_id" defaultValue={editing.supplier_id || ''}>
                  <option value="">—</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Date"><Input name="date" type="date" defaultValue={editing.date} /></Field>
              <Field label="Notes" className="col-span-2"><Input name="notes" defaultValue={editing.notes} /></Field>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Dialog>
      )}

      {detail && (
        <RecordDialog
          title={detail.item}
          subtitle={`Added ${detail.date}`}
          onClose={() => setDetail(null)}
          fields={[
            ['Category', detail.category_slug],
            ['Article', detail.article_code || '—'],
            ['Pack type', detail.pack_type || '—'],
            ['Pairs per pack', detail.pairs_per_pack || '—'],
            ['Quantity', fmtNum(detail.quantity)],
            ['Unit', detail.unit || detail.pack_type],
            ['Total pairs', fmtNum(detail.total_pairs)],
            ['Unit price', fmtRs(detail.unit_price)],
            ['Amount', fmtRs(detail.amount)],
            ['Supplier', detail.supplier?.name || '—'],
            ['Date', detail.date],
            ['Notes', detail.notes],
          ]}
        />
      )}
    </div>
  );
}
