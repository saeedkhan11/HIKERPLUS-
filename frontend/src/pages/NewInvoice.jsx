import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Printer, ArrowLeft } from 'lucide-react';
import { fetchParties, fetchArticles, fetchSettings, createInvoice, saveParty } from '../lib/services';
import { fmtRs, fmtNum, today, CARTON_SIZES } from '../lib/utils';
import { Button, Card, Field, Input, Select, Textarea, PageHeader } from '../components/ui';
import InvoiceSheet from '../components/InvoiceSheet';

export default function NewInvoice() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    customer_id: '', new_name: '', new_phone: '', new_address: '',
    date: today(), lines: [], discount: '', received: '', payment_method: 'cash', notes: '',
  });

  useEffect(() => {
    fetchParties('customers').then((cs) => {
      setCustomers(cs);
      setForm((f) => ({ ...f, customer_id: f.customer_id || cs[0]?.id }));
    });
    fetchArticles().then((as) => {
      setArticles(as.filter((a) => a.status === 'active'));
      setForm((f) => ({
        ...f,
        lines: f.lines.length ? f.lines : [emptyLine(as.find((a) => a.status === 'active'))],
      }));
    });
    fetchSettings().then(setSettings).catch(() => {});
  }, []);

  const emptyLine = (article) => ({
    article_id: article?.id || '',
    size: '', color: '',
    pairs_per_carton: settings?.pairs_per_carton || 24,
    cartons: '',
    rate: article?.selling_price || '',
  });

  const setLine = (i, field, value) => {
    setForm((f) => {
      const lines = [...f.lines];
      const line = { ...lines[i], [field]: value };
      if (field === 'article_id') {
        const a = articles.find((x) => x.id === Number(value));
        if (a) line.rate = a.selling_price;
      }
      lines[i] = line;
      return { ...f, lines };
    });
  };

  const linePairs = (l) => (Number(l.cartons) || 0) * (Number(l.pairs_per_carton) || 0);
  const lineAmount = (l) => linePairs(l) * (Number(l.rate) || 0);
  const subtotal = form.lines.reduce((s, l) => s + lineAmount(l), 0);
  const discount = Number(form.discount) || 0;
  const total = Math.max(subtotal - discount, 0);
  const received = Math.min(Number(form.received) || 0, total);
  const balance = total - received;
  const totalCartons = form.lines.reduce((s, l) => s + (Number(l.cartons) || 0), 0);
  const totalPairs = form.lines.reduce((s, l) => s + linePairs(l), 0);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      let customerId = Number(form.customer_id);
      if (form.new_name.trim()) {
        const created = await saveParty('customers', { name: form.new_name.trim(), phone: form.new_phone, address: form.new_address, status: 'active', opening_balance: 0 });
        customerId = created.id;
      }
      const payload = {
        p_customer_id: customerId,
        p_date: form.date,
        p_lines: form.lines.map((l) => ({
          article_id: Number(l.article_id),
          size: l.size || '',
          color: l.color || '',
          pairs_per_carton: Number(l.pairs_per_carton) || 0,
          cartons: Number(l.cartons) || 0,
          rate: Number(l.rate) || 0,
        })),
        p_discount: discount,
        p_received: received,
        p_payment_method: form.payment_method,
        p_notes: form.notes,
      };
      await createInvoice(payload);
      navigate('/invoices');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const previewInvoice = {
    invoice_no: '(draft)',
    customer_name: form.new_name.trim() || customers.find((c) => c.id === Number(form.customer_id))?.name || '—',
    customer_address: form.new_address || customers.find((c) => c.id === Number(form.customer_id))?.address,
    customer_city: customers.find((c) => c.id === Number(form.customer_id))?.city,
    customer_phone: form.new_phone || customers.find((c) => c.id === Number(form.customer_id))?.phone,
    date: form.date,
    lines: form.lines.map((l) => ({
      article_code: articles.find((a) => a.id === Number(l.article_id))?.code || '',
      article_name: articles.find((a) => a.id === Number(l.article_id))?.name || '',
      size: l.size, color: l.color,
      pairs: linePairs(l), rate: Number(l.rate) || 0, amount: lineAmount(l),
    })),
    subtotal, discount, total, received, balance,
    payment_method: form.payment_method, notes: form.notes,
  };

  return (
    <div>
      <PageHeader
        label="Sales desk"
        title="New invoice"
        description="Cartons convert into pairs, stock is deducted and the customer kata is updated on save."
        actions={<Button variant="secondary" onClick={() => navigate('/invoices')}><ArrowLeft size={15} /> Back to invoices</Button>}
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card title="Customer">
            <div className="grid grid-cols-2 gap-x-3 p-4">
              <Field label="Existing customer" className="col-span-2">
                <Select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Or new customer name" className="col-span-2">
                <Input value={form.new_name} onChange={(e) => setForm({ ...form, new_name: e.target.value })} placeholder="Walk-in customer" />
              </Field>
              <Field label="Phone"><Input value={form.new_phone} onChange={(e) => setForm({ ...form, new_phone: e.target.value })} /></Field>
              <Field label="Address"><Input value={form.new_address} onChange={(e) => setForm({ ...form, new_address: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Payment method">
                <Select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="account">Account (bank transfer)</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Items">
            <div className="p-4">
              <p className="mb-3 text-[11px] text-mutedfg">Only articles with ready stock can be invoiced. Pairs follow the carton you pick: 12, 18 or 24.</p>
              <div className="space-y-2">
                {form.lines.map((l, i) => (
                  <div key={i} className="rounded-xl border border-borderc p-3">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 sm:col-span-6">
                        <Select value={l.article_id} onChange={(e) => setLine(i, 'article_id', e.target.value)}>
                          {articles.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </Select>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Input placeholder="Size" value={l.size} onChange={(e) => setLine(i, 'size', e.target.value)} />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Input placeholder="Color" value={l.color} onChange={(e) => setLine(i, 'color', e.target.value)} />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Select value={l.pairs_per_carton} onChange={(e) => setLine(i, 'pairs_per_carton', e.target.value)}>
                          {CARTON_SIZES.map((n) => <option key={n} value={n}>{n}-pair carton</option>)}
                        </Select>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Input type="number" min="0" value={l.cartons} onChange={(e) => setLine(i, 'cartons', e.target.value)} placeholder="Cartons" />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Input type="number" min="0" value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} placeholder="Rate" />
                      </div>
                      <div className="col-span-6 sm:col-span-2 flex items-center justify-end">
                        <span className="num text-[13px] font-bold text-teal">{fmtNum(linePairs(l))} prs</span>
                      </div>
                      <div className="col-span-6 sm:col-span-1 flex items-center justify-end">
                        {form.lines.length > 1 && (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))} className="text-red-500 hover:text-red-700">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-right text-[12px] font-semibold">{fmtRs(lineAmount(l))}</div>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine(articles[0])] }))}>
                  <Plus size={14} /> Add row
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Summary">
            <div className="grid grid-cols-2 gap-x-3 p-4">
              <Field label="Subtotal"><Input readOnly value={fmtRs(subtotal)} /></Field>
              <Field label="Discount (Rs)"><Input type="number" min="0" step="any" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></Field>
              <Field label="Grand total"><Input readOnly className="font-bold" value={fmtRs(total)} /></Field>
              <Field label="Payment received (Rs)"><Input type="number" min="0" step="any" value={form.received} onChange={(e) => setForm({ ...form, received: e.target.value })} /></Field>
              <Field label="Remaining balance"><Input readOnly className="font-bold text-copper" value={fmtRs(balance)} /></Field>
              <Field label="Total pairs"><Input readOnly value={`${fmtNum(totalPairs)} prs`} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2 px-4 pb-4">
              <Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={14} /> Preview</Button>
              <Button onClick={submit} disabled={busy}><Save size={15} /> {busy ? 'Saving…' : 'Save invoice'}</Button>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Invoice preview" accent="copper">
            <div className="p-4">
              <InvoiceSheet settings={settings || {}} invoice={previewInvoice} compact />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
