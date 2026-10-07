import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchDashboard } from '../lib/services';
import { fmtRs, fmtNum } from '../lib/utils';
import { Button, Card, PageHeader, StatCard, Badge, Empty } from '../components/ui';

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await fetchDashboard());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>;
  if (!d) return <div className="text-sm text-mutedfg">Loading…</div>;

  return (
    <div>
      <PageHeader
        label="HIKER+ Shoes Factory"
        title="Factory dashboard"
        description="Live stock, production and sales across every category — refreshed automatically."
        actions={
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setBusy(true); load(); }}>
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Refresh
          </Button>
        }
      />

      {d.low_stock && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
          Uppers stock is below the low-stock alert level — top up soon.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sales invoiced" value={fmtRs(d.sales_invoiced)} sub={`${fmtNum(d.invoice_count)} invoice(s)`} accent="copper" />
        <StatCard label="Pairs sold" value={`${fmtNum(d.pairs_sold)} prs`} sub="Through invoices" accent="teal" />
        <StatCard label="Pairs produced" value={`${fmtNum(d.production_recent)} prs`} sub={`${fmtNum(d.production_pairs)} prs all-time`} accent="ink" />
        <StatCard label="Ready shoes" value={`${fmtNum(d.ready_pairs)} prs`} sub="Available to invoice" accent="copper" />
        <StatCard label="Uppers in factory" value={`${fmtNum(d.uppers_pairs)} prs`} sub={`Raw stock value ${fmtRs(d.stock_value)}`} accent="teal" />
        <StatCard label="Receivable" value={fmtRs(d.receivables)} sub="Outstanding from customers" accent="ink" />
        <StatCard label="Payable" value={fmtRs(d.payables)} sub="Owed to suppliers" accent="copper" />
        <StatCard label="Cash in hand" value={fmtRs(d.cash)} sub={`In ${fmtRs(d.cash_in)} · Out ${fmtRs(d.cash_out)}`} accent="teal" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Recent stock activity">
          {!d.recent_stock?.length ? <Empty>No stock movements yet.</Empty> : (
            <div className="divide-y divide-borderc/70">
              {d.recent_stock.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">{s.item || s.description}</div>
                    <div className="text-[11px] text-mutedfg">{s.date}</div>
                  </div>
                  <Badge tone={s.direction === 'in' ? 'in' : 'out'}>{s.direction === 'in' ? '+' : '−'}{fmtNum(s.quantity)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent production">
          {!d.recent_production?.length ? <Empty>No production entries yet.</Empty> : (
            <div className="divide-y divide-borderc/70">
              {d.recent_production.slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">{p.article_code} {p.article_name}</div>
                    <div className="text-[11px] text-mutedfg">{p.date} · {p.operator || '—'}</div>
                  </div>
                  <span className="num text-[13px] font-bold text-teal">{fmtNum(p.output_pairs)} prs</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent sales">
          {!d.recent_sales?.length ? <Empty>No invoices yet.</Empty> : (
            <div className="divide-y divide-borderc/70">
              {d.recent_sales.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">{s.invoice_no}</div>
                    <div className="text-[11px] text-mutedfg">{s.customer_name} · {s.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="num text-[13px] font-bold">{fmtRs(s.total)}</span>
                    <Badge tone={s.status}>{s.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Article-wise ready shoes">
          {!d.article_ready?.length ? <Empty>No ready shoes yet.</Empty> : (
            <div className="divide-y divide-borderc/70">
              {d.article_ready.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">{a.code} {a.name}</div>
                    <div className="text-[11px] text-mutedfg">{a.category || '—'}</div>
                  </div>
                  <span className="num text-[13px] font-bold text-teal">{fmtNum(a.ready_pairs)} prs</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
