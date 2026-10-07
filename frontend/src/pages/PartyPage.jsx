import { useEffect, useState } from 'react';
import { fetchParties, saveParty, deleteParty, fetchPartyLedger } from '../lib/services';
import { fmtRs } from '../lib/utils';
import { Button, Card, Dialog, Field, Input, Textarea, Select, PageHeader, Badge, Empty, IconButton } from '../components/ui';
import { Pencil, Trash2, Plus, BookOpenText } from 'lucide-react';

export default function PartyPage({ kind, title }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');

  const load = () => fetchParties(kind).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.opening_balance = Number(body.opening_balance) || 0;
    try {
      if (editing.id) await saveParty(kind, { ...editing, ...body });
      else await saveParty(kind, body);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (row) => {
    if (!confirm(`Move "${row.name}" to the recycle bin?`)) return;
    await deleteParty(kind, row.id);
    load();
  };

  const showLedger = async (row) => {
    setLedger({ loading: true, party: row });
    try {
      const data = await fetchPartyLedger(kind, row.id);
      setLedger({ ...data, loading: false, party: row });
    } catch (e) {
      setLedger({ loading: false, party: row, error: e.message });
    }
  };

  const filtered = rows.filter((r) =>
    [r.name, r.phone, r.city].join(' ').toLowerCase().includes(q.toLowerCase()));

  const isCustomer = kind === 'customers';
  const balanceLabel = isCustomer ? 'Receivable (kata)' : 'Payable (kata)';

  return (
    <div>
      <PageHeader title={title} actions={
        <>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="!w-48" />
          <Button onClick={() => setEditing({ name: '', phone: '', address: '', city: '', product_details: '', opening_balance: '', status: 'active' })}>
            <Plus size={15} /> Add {isCustomer ? 'customer' : 'supplier'}
          </Button>
        </>
      } />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}
      <Card>
        {filtered.length === 0 ? <Empty>Nothing here yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Phone</th><th>City</th><th>Products</th><th className="text-right">Opening</th><th className="text-right">{balanceLabel}</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.name}</td>
                    <td className="num">{r.phone || '—'}</td>
                    <td className="text-mutedfg">{r.city || '—'}</td>
                    <td className="text-mutedfg">{r.product_details || '—'}</td>
                    <td className="num text-right">{fmtRs(r.opening_balance)}</td>
                    <td className="num text-right font-bold">{fmtRs(r.balance)}</td>
                    <td><Badge tone={r.status === 'active' ? 'active' : 'inactive'}>{r.status}</Badge></td>
                    <td className="whitespace-nowrap">
                      <IconButton onClick={() => showLedger(r)} title="Ledger"><BookOpenText size={14} /></IconButton>
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
        <Dialog title={editing.id ? `Edit ${editing.name}` : 'New entry'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *" className="col-span-2"><Input name="name" defaultValue={editing.name} required autoFocus /></Field>
              <Field label="Phone"><Input name="phone" defaultValue={editing.phone} /></Field>
              <Field label="City"><Input name="city" defaultValue={editing.city} /></Field>
              <Field label="Address" className="col-span-2"><Input name="address" defaultValue={editing.address} /></Field>
              <Field label="Product details" className="col-span-2"><Textarea name="product_details" defaultValue={editing.product_details} /></Field>
              <Field label="Opening balance (Rs)"><Input name="opening_balance" type="number" step="any" defaultValue={editing.opening_balance} /></Field>
              <Field label="Status"><Select name="status" defaultValue={editing.status}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </Select></Field>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Dialog>
      )}

      {ledger && (
        <Dialog title={`Ledger — ${ledger.party?.name}`} onClose={() => setLedger(null)} wide>
          <div className="p-5">
            {ledger.loading ? <Empty>Loading…</Empty> : ledger.error ? <Empty>{ledger.error}</Empty> : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-muted p-2"><div className="microlabel">Opening</div><div className="num font-bold">{fmtRs(ledger.opening_balance)}</div></div>
                  <div className="rounded-lg bg-muted p-2"><div className="microlabel">Balance</div><div className={`num font-bold ${ledger.balance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{fmtRs(ledger.balance)}</div></div>
                  <div className="rounded-lg bg-muted p-2"><div className="microlabel">Entries</div><div className="num font-bold">{ledger.lines?.length || 0}</div></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-borderc">
                  <table className="tbl">
                    <thead><tr><th>Date</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                    <tbody>
                      <tr><td colSpan={5} className="text-[11px] text-mutedfg italic">Opening balance: {fmtRs(ledger.opening_balance)}</td></tr>
                      {(ledger.lines || []).map((l, i) => (
                        <tr key={i}>
                          <td className="num text-mutedfg">{l.date}</td>
                          <td>{l.description}{l.ref ? <span className="text-mutedfg"> · {l.ref}</span> : ''}</td>
                          <td className="num text-right">{l.debit ? fmtRs(l.debit) : '—'}</td>
                          <td className="num text-right">{l.credit ? fmtRs(l.credit) : '—'}</td>
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
