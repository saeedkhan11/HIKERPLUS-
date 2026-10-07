import { useEffect, useState } from 'react';
import { fetchReadyShoes, saveReadyShoes, deleteReadyShoes, fetchArticles } from '../lib/services';
import { downloadCSV, fmtNum, today, CARTON_SIZES } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, PageHeader, Badge, Empty, IconButton, StatCard } from '../components/ui';
import { ClickableRow, rowAction, RecordDialog } from '../components/RecordDialog';
import { Pencil, Trash2, Plus, Download, Printer } from 'lucide-react';

const BLANK = { article_id: '', carton_type: '24', pairs_per_carton: 24, cartons: '', pairs: 0, source: 'manual', date: today() };

export default function ReadyShoes() {
  const [rows, setRows] = useState([]);
  const [articles, setArticles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetchReadyShoes().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    fetchArticles().then(setArticles).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.article_id = Number(body.article_id);
    body.pairs_per_carton = Number(body.pairs_per_carton) || 0;
    body.cartons = Number(body.cartons) || 0;
    body.pairs = body.cartons * body.pairs_per_carton;
    try {
      if (editing.id) await saveReadyShoes({ ...editing, ...body });
      else await saveReadyShoes(body);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm('Move this entry to the recycle bin?')) return;
    await deleteReadyShoes(row.id);
    load();
  };

  const totalPairs = rows.reduce((s, r) => s + (Number(r.pairs) || 0), 0);
  const totalCartons = rows.reduce((s, r) => s + (Number(r.cartons) || 0), 0);

  return (
    <div>
      <PageHeader
        label="Stock"
        title="Ready Shoes"
        description="Finished shoes ready for sale — pairs are the selling quantity, cartons are the packing unit."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('ready-shoes.csv',
              ['Article', 'Carton type', 'Cartons', 'Pairs', 'Source', 'Date'],
              rows.map((r) => [r.article?.code, r.carton_type, r.cartons, r.pairs, r.source, r.date]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button onClick={() => setEditing({ ...BLANK })}><Plus size={15} /> Add ready shoes</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total pairs" value={`${fmtNum(totalPairs)} prs`} accent="copper" />
        <StatCard label="Total cartons" value={fmtNum(totalCartons)} accent="teal" />
        <StatCard label="Entries" value={fmtNum(rows.length)} accent="ink" />
        <StatCard label="Articles" value={fmtNum(new Set(rows.map((r) => r.article_id)).size)} accent="copper" />
      </div>

      <Card title="Ready shoes register">
        {rows.length === 0 ? <Empty title="No ready shoes yet">Add stock manually or produce from the Production module.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Article</th><th>Carton type</th><th className="text-right">Cartons</th><th className="text-right">Pairs</th><th>Source</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <ClickableRow key={r.id} onOpen={() => setDetail(r)}>
                    <td>
                      <div className="num font-semibold">{r.article?.code || '—'}</div>
                      <div className="text-[11px] text-mutedfg">{r.article?.name}</div>
                    </td>
                    <td className="text-mutedfg">{r.pairs_per_carton}-pair</td>
                    <td className="num text-right">{fmtNum(r.cartons)}</td>
                    <td className="num text-right font-bold">{fmtNum(r.pairs)}</td>
                    <td><Badge tone={r.source}>{r.source}</Badge></td>
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
        <Dialog title={editing.id ? 'Edit ready shoes' : 'Add ready shoes'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Article *" className="col-span-2">
                <Select name="article_id" defaultValue={editing.article_id} required>
                  <option value="">Select…</option>
                  {articles.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </Select>
              </Field>
              <Field label="Pairs per carton">
                <Select name="pairs_per_carton" defaultValue={editing.pairs_per_carton}>
                  {CARTON_SIZES.map((n) => <option key={n} value={n}>{n}-pair carton</option>)}
                </Select>
              </Field>
              <Field label="Cartons *"><Input name="cartons" type="number" step="any" min="0" defaultValue={editing.cartons} required /></Field>
              <Field label="Date"><Input name="date" type="date" defaultValue={editing.date} /></Field>
              <Field label="Source">
                <Select name="source" defaultValue={editing.source}>
                  <option value="manual">manual</option>
                  <option value="production">production</option>
                </Select>
              </Field>
            </div>
            <p className="mb-1 text-[11px] text-mutedfg">Pairs = cartons × pairs per carton (calculated automatically).</p>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Dialog>
      )}

      {detail && (
        <RecordDialog
          title={`${detail.article?.code || ''} ${detail.article?.name || ''}`}
          subtitle={`Added ${detail.date}`}
          onClose={() => setDetail(null)}
          fields={[
            ['Carton type', `${detail.pairs_per_carton}-pair`],
            ['Cartons', fmtNum(detail.cartons)],
            ['Pairs', fmtNum(detail.pairs)],
            ['Source', detail.source],
            ['Date', detail.date],
          ]}
        />
      )}
    </div>
  );
}
