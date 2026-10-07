import { useEffect, useState } from 'react';
import { fetchSalesItems } from '../lib/services';
import { downloadCSV, fmtRs, fmtNum, today, daysAgo } from '../lib/utils';
import { Button, Card, PageHeader, Empty, StatCard, DateRange } from '../components/ui';
import { Download, Printer } from 'lucide-react';

export default function Sales() {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [error, setError] = useState('');

  const load = () => fetchSalesItems(from, to).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [from, to]);

  const totalPairs = rows.reduce((s, r) => s + (Number(r.pairs) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const uniqueArticles = new Set(rows.map((r) => r.article_code)).size;

  return (
    <div>
      <PageHeader
        label="Sales desk"
        title="Sales"
        description="Every pair sold across all invoices — filter by date and export for analysis."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV('sales.csv',
              ['Invoice', 'Date', 'Customer', 'Article', 'Size', 'Color', 'Pairs', 'Rate', 'Amount'],
              rows.map((r) => [r.invoice?.invoice_no, r.invoice?.date, r.invoice?.customer?.name,
                r.article?.code, r.size, r.color, r.pairs, r.rate, r.amount]))}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Line items" value={fmtNum(rows.length)} accent="copper" />
        <StatCard label="Pairs sold" value={`${fmtNum(totalPairs)} prs`} accent="teal" />
        <StatCard label="Sales value" value={fmtRs(totalAmount)} accent="ink" />
        <StatCard label="Articles" value={fmtNum(uniqueArticles)} accent="copper" />
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(30)); setTo(today()); }} />

      <Card title="Sales register">
        {rows.length === 0 ? <Empty title="No sales in this range">Create an invoice to record a sale.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Article</th><th>Size</th><th>Color</th><th className="text-right">Pairs</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num font-semibold text-copper">{r.invoice?.invoice_no || '—'}</td>
                    <td className="num text-mutedfg">{r.invoice?.date || r.date || '—'}</td>
                    <td>{r.invoice?.customer?.name || '—'}</td>
                    <td>
                      <div className="num font-semibold">{r.article?.code || '—'}</div>
                      <div className="text-[11px] text-mutedfg">{r.article?.name}</div>
                    </td>
                    <td className="text-mutedfg">{r.size || '—'}</td>
                    <td className="text-mutedfg">{r.color || '—'}</td>
                    <td className="num text-right font-bold">{fmtNum(r.pairs)}</td>
                    <td className="num text-right">{fmtRs(r.rate)}</td>
                    <td className="num text-right font-bold">{fmtRs(r.amount)}</td>
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
