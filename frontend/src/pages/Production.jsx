import { useEffect, useState } from 'react';
import { fetchProduction, createProduction, deleteProduction, fetchArticles, fetchSettings } from '../lib/services';
import { downloadCSV, fmtNum, fmtRs, today, daysAgo, BAG_SIZES } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, Textarea, PageHeader, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { ClickableRow, rowAction, RecordDialog } from '../components/RecordDialog';
import { Trash2, Plus, Download, Printer } from 'lucide-react';

const BLANK = { article_id: '', size: '', color: '', bags: '', pairs_per_bag: 100, notes: '', production_date: today() };

export default function Production() {
  const [rows, setRows] = useState([]);
  const [articles, setArticles] = useState([]);
  const [settings, setSettings] = useState(null);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetchProduction(from, to).then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    fetchArticles().then(setArticles).catch(() => {});
    fetchSettings().then(setSettings).catch(() => {});
  }, [from, to]);

  const bagOptions = settings?.production_bag_options
    ? settings.production_bag_options.split(',').map((s) => Number(s.trim())).filter((n) => n > 0)
    : BAG_SIZES;

  const totalPairs = (Number(form.bags) || 0) * (Number(form.pairs_per_bag) || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.article_id) { setError('Article is required'); return; }
    if (!form.bags || Number(form.bags) <= 0) { setError('Bags must be greater than 0'); return; }
    setError('');
    try {
      const article = articles.find((a) => a.id === form.article_id);
      await createProduction({
        article_id: form.article_id,
        article_name: article?.name || '',
        size: form.size,
        color: form.color,
        bags: Number(form.bags),
        pairs_per_bag: Number(form.pairs_per_bag),
        notes: form.notes,
        production_date: form.production_date,
      });
      setCreating(false);
      setForm(BLANK);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm('Move this production entry to the recycle bin?')) return;
    await deleteProduction(row.id);
    load();
  };

  const totalOutput = rows.reduce((s, r) => s + (Number(r.output_pairs) || 0), 0);
  const totalInput = rows.reduce((s, r) => s + (Number(r.uppers_used) || 0), 0);

  return (
    <div>
      <PageHeader
        label="Production"
        title="Production"
        description="Record production — uppers consumed and ready shoes added automatically."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('production.csv',
              ['Date', 'Article', 'Size', 'Color', 'Bags', 'Pairs/bag', 'Pairs out'],
              rows.map((r) => [r.date, r.article?.code, r.size, r.color, r.input_bags, r.pairs_per_bag, r.output_pairs]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
            <Button onClick={() => setCreating(true)}><Plus size={15} /> New production</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Entries" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Uppers used" value={`${fmtNum(totalInput)} prs`} accent="teal" />
        <StatCard label="Pairs produced" value={`${fmtNum(totalOutput)} prs`} accent="ink" />
        <StatCard label="Yield" value={totalInput ? `${Math.round((totalOutput / totalInput) * 100)}%` : '—'} accent="copper" />
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(30)); setTo(today()); }} />

      <Card title="Production entries">
        {rows.length === 0 ? <Empty>No production recorded in this range.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Article</th><th>Size</th><th>Color</th><th className="text-right">Bags</th><th className="text-right">Pairs/bag</th><th className="text-right">Pairs out</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <ClickableRow key={r.id} onOpen={() => setDetail(r)}>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td>
                      <div className="num font-semibold">{r.article?.code}</div>
                      <div className="text-[11px] text-mutedfg">{r.article?.name}</div>
                    </td>
                    <td className="text-mutedfg">{r.size || '—'}</td>
                    <td className="text-mutedfg">{r.color || '—'}</td>
                    <td className="num text-right">{fmtNum(r.input_bags)}</td>
                    <td className="num text-right">{fmtNum(r.pairs_per_bag)}</td>
                    <td className="num text-right font-bold text-teal">{fmtNum(r.output_pairs)}</td>
                    <td><IconButton onClick={rowAction(() => remove(r))}><Trash2 size={14} /></IconButton></td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <Dialog title="New production entry" onClose={() => setCreating(false)} wide>
          <form onSubmit={submit} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Article *" className="col-span-2">
                <Select value={form.article_id} onChange={(e) => setForm({ ...form, article_id: e.target.value })} required>
                  <option value="">Select…</option>
                  {articles.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </Select>
              </Field>
              <Field label="Size"><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 42" /></Field>
              <Field label="Color"><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="e.g. Black" /></Field>
              <Field label="Bags *"><Input type="number" min="1" step="any" value={form.bags} onChange={(e) => setForm({ ...form, bags: e.target.value })} required /></Field>
              <Field label="Pairs per bag">
                <Select value={form.pairs_per_bag} onChange={(e) => setForm({ ...form, pairs_per_bag: e.target.value })}>
                  {bagOptions.map((n) => <option key={n} value={n}>{n} pairs/bag</option>)}
                </Select>
              </Field>
              <Field label="Production date"><Input type="date" value={form.production_date} onChange={(e) => setForm({ ...form, production_date: e.target.value })} /></Field>
              <Field label="Total pairs (auto)"><Input readOnly value={`${fmtNum(totalPairs)} prs`} className="font-bold" /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-mutedfg">
              This will deduct {fmtNum(totalPairs)} uppers from Raw Stock and add {fmtNum(totalPairs)} pairs to Ready Shoes.
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit">Record production</Button>
            </div>
          </form>
        </Dialog>
      )}

      {detail && (
        <RecordDialog
          title={`${detail.article?.code || ''} ${detail.article?.name || ''}`}
          subtitle={detail.date}
          onClose={() => setDetail(null)}
          fields={[
            ['Size', detail.size || '—'],
            ['Color', detail.color || '—'],
            ['Bags', fmtNum(detail.input_bags)],
            ['Pairs per bag', fmtNum(detail.pairs_per_bag)],
            ['Uppers used', `${fmtNum(detail.uppers_used)} prs`],
            ['Output pairs', `${fmtNum(detail.output_pairs)} prs`],
            ['Notes', detail.notes || '—'],
            ['Date', detail.date],
          ]}
        />
      )}
    </div>
  );
}
