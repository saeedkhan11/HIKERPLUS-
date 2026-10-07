import { useEffect, useState } from 'react';
import { fetchAuditLogs } from '../lib/services';
import { downloadCSV, fmtNum } from '../lib/utils';
import { Button, Card, Select, PageHeader, Empty, StatCard } from '../components/ui';
import { Download, Printer } from 'lucide-react';

const ACTIONS = ['all', 'login', 'logout', 'create', 'update', 'delete', 'restore', 'permanent_delete', 'permission_change'];

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const load = () => fetchAuditLogs(200).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.action === filter);

  const actionTone = (action) => {
    if (action === 'create') return 'teal';
    if (action === 'delete' || action === 'permanent_delete') return 'unpaid';
    if (action === 'restore') return 'paid';
    if (action === 'login' || action === 'logout') return 'manual';
    if (action === 'permission_change') return 'partial';
    return 'neutral';
  };

  return (
    <div>
      <PageHeader
        label="System"
        title="Audit Logs"
        description="Every action is logged — who did what, when, and on which record. Passwords and PINs are never stored."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('audit-logs.csv',
              ['Timestamp', 'User', 'Action', 'Table', 'Record ID', 'Details'],
              filtered.map((r) => [r.created_at, r.user?.name || '—', r.action, r.table_name, r.record_id, JSON.stringify(r.details)]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total entries" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Filtered" value={fmtNum(filtered.length)} accent="teal" />
        <StatCard label="Creates" value={fmtNum(rows.filter((r) => r.action === 'create').length)} accent="ink" />
        <StatCard label="Deletes" value={fmtNum(rows.filter((r) => r.action === 'delete' || r.action === 'permanent_delete').length)} accent="copper" />
      </div>

      <div className="mb-4">
        <div className="microlabel mb-1">Filter by action</div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-56">
          {ACTIONS.map((a) => <option key={a}>{a}</option>)}
        </Select>
      </div>

      <Card title="Audit trail">
        {filtered.length === 0 ? <Empty>No audit entries yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Table</th><th>Record</th><th>Details</th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="num text-mutedfg">{new Date(r.created_at).toLocaleString('en-GB')}</td>
                    <td className="font-semibold">{r.user?.name || '—'}</td>
                    <td><Badge tone={actionTone(r.action)}>{r.action}</Badge></td>
                    <td className="text-mutedfg">{r.table_name || '—'}</td>
                    <td className="num text-mutedfg">{r.record_id ? String(r.record_id).slice(0, 8) + '…' : '—'}</td>
                    <td className="text-mutedfg">{r.details ? JSON.stringify(r.details).slice(0, 60) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
