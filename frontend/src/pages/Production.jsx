import { useEffect, useState } from 'react';
import { fetchProduction, createProduction, deleteProduction, fetchArticles } from '../lib/services';
import { downloadCSV, fmtNum, fmtRs, today, daysAgo, BAG_SIZES, CARTON_SIZES } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Select, PageHeader, Empty, IconButton, StatCard, DateRange } from '../components/ui';
import { ClickableRow, rowAction, RecordDialog } from '../components/RecordDialog';
import { Trash2, Plus, Download, Printer } from 'lucide-react';

const BLANK = { article_id: '', date: today(), line: '', shift: '', operator: '', input_bags: '', pairs_per_bag: 100, carton_type: '24', pairs_per_carton: 24, output_cartons: '' };

export default function Production() {
  const [rows, setRows] = useState([]);
  const [articles, setArticles] = useState([]);
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
  }, [from, to]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createProduction({
        p_article_id: Number(form.article_id),
        p_date: form.date,
        p_line: form.line,
        p_shift: form.shift,
        p_operator: form.operator,
        p_input_bags: Number(form.input_bags) || 0,
        p_pairs_per_bag: Number(form.pairs_per_bag) || 0,
        p_carton_type: form.carton_type,
        p_pairs_per_carton: Number(form.pairs_per_carton) || 0,
        p_output_cartons: Number(form.output_cartons) || 0,
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
        description="Raw uppers go in, finished shoes come out. Stock is deducted and ready shoes added automatically."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('production.csv',
              ['Date', 'Article', 'Line', 'Operator', 'Bags in', 'Pairs in', 'Cartons out', 'Pairs out'],
              rows.map((r) => [r.date, r.article?.code, r.line, r.operator, r.input_bags, r.uppers_used, r.output_cartons, r.output_pairs]))}>
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
              <thead><tr><th>Date</th><th>Article</th><th>Line</th><th>Operator</th><th className="text-right">Bags in</th><th className="text-right">Pairs in</th><th className="text-right">Cartons out</th><th className="text-right">Pairs out</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <ClickableRow key={r.id} onOpen={() => setDetail(r)}>
                    <td className="num text-mutedfg">{r.date}</td>
                    <td>
                      <div className="num font-semibold">{r.article?.code}</div>
                      <div className="text-[11px] text-mutedfg">{r.article?.name}</div>
                    </td>
                    <td className="text-mutedfg">{r.line || '—'}</td>
                    <td className="text-mutedfg">{r.operator || '—'}</td>
                    <td className="num text-right">{fmtNum(r.input_bags)}</td>
                    <td className="num text-right">{fmtNum(r.uppers_used)}</td>
                    <td className="num text-right">{fmtNum(r.output_cartons)}</td>
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
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Line"><Input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} placeholder="Line A" /></Field>
              <Field label="Shift"><Input value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} placeholder="Morning" /></Field>
              <Field label="Operator"><Input value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} /></Field>
              <Field label="Input bags"><Input type="number" min="0" step="any" value={form.input_bags} onChange={(e) => setForm({ ...form, input_bags: e.target.value })} /></Field>
              <Field label="Pairs per bag">
                <Select value={form.pairs_per_bag} onChange={(e) => setForm({ ...form, pairs_per_bag: e.target.value })}>
                  {BAG_SIZES.map((n) => <option key={n} value={n}>{n} pairs/bag</option>)}
                </Select>
              </Field>
              <Field label="Output cartons"><Input type="number" min="0" step="any" value={form.output_cartons} onChange={(e) => setForm({ ...form, output_cartons: e.target.value })} /></Field>
              <Field label="Pairs per carton">
                <Select value={form.pairs_per_carton} onChange={(e) => setForm({ ...form, pairs_per_carton: e.target.value })}>
                  {CARTON_SIZES.map((n) => <option key={n} value={n}>{n} pairs/carton</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-mutedfg">
              Uppers used: {fmtNum((Number(form.input_bags) || 0) * (Number(form.pairs_per_bag) || 0))} pairs ·
              Output: {fmtNum((Number(form.output_cartons) || 0) * (Number(form.pairs_per_carton) || 0))} pairs
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
            ['Line', detail.line],
            ['Shift', detail.shift],
            ['Operator', detail.operator],
            ['Input bags', fmtNum(detail.input_bags)],
            ['Pairs per bag', fmtNum(detail.pairs_per_bag)],
            ['Uppers used', `${fmtNum(detail.uppers_used)} prs`],
            ['Carton type', `${detail.pairs_per_carton}-pair`],
            ['Output cartons', fmtNum(detail.output_cartons)],
            ['Output pairs', `${fmtNum(detail.output_pairs)} prs`],
            ['Date', detail.date],
          ]}
        />
      )}
    </div>
  );
}
