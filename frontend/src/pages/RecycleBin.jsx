import { useEffect, useState } from 'react';
import { fetchRecycleBin, restoreRecord, permanentlyDelete } from '../lib/services';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, PageHeader, Empty, IconButton, Badge } from '../components/ui';
import { RotateCcw, Trash2, ShieldAlert } from 'lucide-react';

const TABLES = [
  { key: 'articles', label: 'Articles' },
  { key: 'raw_stock', label: 'Raw Stock' },
  { key: 'ready_shoes', label: 'Ready Shoes' },
  { key: 'production_entries', label: 'Production' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'kharcha', label: 'Kharcha' },
];

export default function RecycleBin() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = profile?.workspace_members?.some((m) => m.role === 'admin') || profile?.role === 'admin';

  const load = () => fetchRecycleBin().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const restore = async (table, id) => {
    setBusy(true);
    try {
      await restoreRecord(table, id);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const permanentDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await permanentlyDelete(confirmDelete.table, confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const totalCount = data ? TABLES.reduce((s, t) => s + (data[t.key]?.length || 0), 0) : 0;

  return (
    <div>
      <PageHeader
        label="System"
        title="Recycle Bin"
        description="Restore accidentally deleted records or permanently remove them. Permanent deletion is admin-only."
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      {!isAdmin && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
          You need admin permission to permanently delete records. You can restore records.
        </div>
      )}

      {totalCount === 0 && !error ? (
        <Card><Empty title="Recycle bin is empty">Deleted records will appear here for restoration.</Empty></Card>
      ) : (
        <div className="space-y-4">
          {TABLES.map((t) => {
            const items = data?.[t.key] || [];
            if (items.length === 0) return null;
            return (
              <Card key={t.key} title={`${t.label} (${items.length})`}>
                <div className="divide-y divide-borderc/70">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{item.label || 'Unnamed'}</div>
                        <div className="text-[11px] text-mutedfg">Deleted: {item.deleted_date ? new Date(item.deleted_date).toLocaleString('en-GB') : '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => restore(t.key, item.id)} disabled={busy}>
                          <RotateCcw size={13} /> Restore
                        </Button>
                        {isAdmin && (
                          <Button variant="danger" size="sm" onClick={() => setConfirmDelete({ table: t.key, id: item.id, label: item.label })} disabled={busy}>
                            <Trash2 size={13} /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-xl border border-borderc bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <ShieldAlert size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-heading text-[14px] font-bold">Confirm permanent deletion</h3>
                <p className="text-[12px] text-mutedfg">This cannot be undone.</p>
              </div>
            </div>
            <p className="mb-4 text-[13px] text-fg">
              Are you absolutely sure you want to permanently delete <strong>{confirmDelete.label}</strong>? This action is irreversible and the record will be removed from the database.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={permanentDelete} disabled={busy}>Yes, delete permanently</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
