import { useEffect, useState } from 'react';
import { fetchInvoices, fetchPurchases, fetchProduction, fetchPayments, fetchKharcha, fetchRoznamcha, fetchArticles, fetchReadyShoes, fetchRawStock, fetchParties, fetchLabour, supabase } from '../lib/services';
import { downloadCSV, fmtRs, fmtNum, today, daysAgo } from '../lib/utils';
import { Button, Card, Select, PageHeader, Empty, StatCard, DateRange, Badge } from '../components/ui';
import { Download, Printer } from 'lucide-react';

const REPORTS = [
  { id: 'stock', label: 'Raw Stock', desc: 'All raw material entries' },
  { id: 'ready', label: 'Ready Shoes', desc: 'Finished shoes inventory' },
  { id: 'production', label: 'Production', desc: 'Production entries' },
  { id: 'purchases', label: 'Purchases', desc: 'Supplier purchases' },
  { id: 'sales', label: 'Sales', desc: 'Invoice line items' },
  { id: 'invoices', label: 'Invoices', desc: 'All invoices' },
  { id: 'payments', label: 'Payments', desc: 'Customer & supplier payments' },
  { id: 'expenses', label: 'Expenses', desc: 'Kharcha entries' },
  { id: 'cashbook', label: 'Cashbook', desc: 'Roznamcha entries' },
  { id: 'customer_ledger', label: 'Customer Ledger', desc: 'Receivables by customer' },
  { id: 'supplier_ledger', label: 'Supplier Ledger', desc: 'Payables by supplier' },
  { id: 'labour', label: 'Labour', desc: 'Labour workforce and payments' },
];

export default function Reports() {
  const [report, setReport] = useState('invoices');
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today());
  const [data, setData] = useState([]);
  const [stats, setStats] = useState([]);
  const [columns, setColumns] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      let rows = [];
      let cols = [];
      let sts = [];

      if (report === 'invoices') {
        rows = await fetchInvoices(from, to);
        cols = ['Invoice', 'Date', 'Customer', 'Subtotal', 'Discount', 'Total', 'Received', 'Balance', 'Status'];
        rows = rows.map((r) => ({ Invoice: r.invoice_no, Date: r.date, Customer: r.customer?.name, Subtotal: r.subtotal, Discount: r.discount, Total: r.total, Received: r.received, Balance: r.balance, Status: r.status }));
        const total = rows.reduce((s, r) => s + (Number(r.Total) || 0), 0);
        const received = rows.reduce((s, r) => s + (Number(r.Received) || 0), 0);
        const outstanding = rows.reduce((s, r) => s + (Number(r.Balance) || 0), 0);
        sts = [{ label: 'Invoices', value: fmtNum(rows.length) }, { label: 'Total value', value: fmtRs(total) }, { label: 'Received', value: fmtRs(received) }, { label: 'Outstanding', value: fmtRs(outstanding) }];
      } else if (report === 'purchases') {
        rows = await fetchPurchases(from, to);
        cols = ['Date', 'Supplier', 'Item', 'Category', 'Quantity', 'Pairs', 'Amount'];
        rows = rows.map((r) => ({ Date: r.date, Supplier: r.supplier?.name, Item: r.item, Category: r.category_slug, Quantity: r.quantity, Pairs: r.total_pairs, Amount: r.amount }));
        const total = rows.reduce((s, r) => s + (Number(r.Amount) || 0), 0);
        sts = [{ label: 'Purchases', value: fmtNum(rows.length) }, { label: 'Total value', value: fmtRs(total) }];
      } else if (report === 'production') {
        rows = await fetchProduction(from, to);
        cols = ['Date', 'Article', 'Line', 'Operator', 'Pairs in', 'Pairs out'];
        rows = rows.map((r) => ({ Date: r.date, Article: r.article?.code, Line: r.line, Operator: r.operator, 'Pairs in': r.uppers_used, 'Pairs out': r.output_pairs }));
        sts = [{ label: 'Entries', value: fmtNum(rows.length) }, { label: 'Pairs produced', value: fmtNum(rows.reduce((s, r) => s + (Number(r['Pairs out']) || 0), 0)) }];
      } else if (report === 'payments') {
        rows = await fetchPayments(from, to);
        cols = ['Date', 'Type', 'Party', 'Amount', 'Method'];
        rows = rows.map((r) => ({ Date: r.date, Type: r.party_type, Party: r.party_name, Amount: r.amount, Method: r.method }));
        sts = [{ label: 'Payments', value: fmtNum(rows.length) }, { label: 'Total', value: fmtRs(rows.reduce((s, r) => s + (Number(r.Amount) || 0), 0)) }];
      } else if (report === 'expenses') {
        rows = await fetchKharcha(from, to);
        cols = ['Date', 'Category', 'Amount', 'Description'];
        rows = rows.map((r) => ({ Date: r.date, Category: r.category, Amount: r.amount, Description: r.description }));
        sts = [{ label: 'Expenses', value: fmtNum(rows.length) }, { label: 'Total', value: fmtRs(rows.reduce((s, r) => s + (Number(r.Amount) || 0), 0)) }];
      } else if (report === 'cashbook') {
        rows = await fetchRoznamcha(from, to);
        cols = ['Date', 'Type', 'Amount', 'Description'];
        rows = rows.map((r) => ({ Date: r.date, Type: r.type, Amount: r.amount, Description: r.description }));
        const tin = rows.filter((r) => r.Type === 'cash_in').reduce((s, r) => s + (Number(r.Amount) || 0), 0);
        const tout = rows.filter((r) => r.Type === 'cash_out').reduce((s, r) => s + (Number(r.Amount) || 0), 0);
        sts = [{ label: 'Cash in', value: fmtRs(tin) }, { label: 'Cash out', value: fmtRs(tout) }, { label: 'Net', value: fmtRs(tin - tout) }];
      } else if (report === 'stock') {
        rows = await fetchRawStock();
        cols = ['Item', 'Category', 'Quantity', 'Unit', 'Pairs', 'Amount', 'Date'];
        rows = rows.map((r) => ({ Item: r.item, Category: r.category_slug, Quantity: r.quantity, Unit: r.unit, Pairs: r.total_pairs, Amount: r.amount, Date: r.date }));
        sts = [{ label: 'Entries', value: fmtNum(rows.length) }, { label: 'Total pairs', value: fmtNum(rows.reduce((s, r) => s + (Number(r.Pairs) || 0), 0)) }, { label: 'Stock value', value: fmtRs(rows.reduce((s, r) => s + (Number(r.Amount) || 0), 0)) }];
      } else if (report === 'ready') {
        rows = await fetchReadyShoes();
        cols = ['Article', 'Carton type', 'Cartons', 'Pairs', 'Source', 'Date'];
        rows = rows.map((r) => ({ Article: r.article?.code, 'Carton type': r.pairs_per_carton, Cartons: r.cartons, Pairs: r.pairs, Source: r.source, Date: r.date }));
        sts = [{ label: 'Total pairs', value: fmtNum(rows.reduce((s, r) => s + (Number(r.Pairs) || 0), 0)) }, { label: 'Entries', value: fmtNum(rows.length) }];
      } else if (report === 'sales') {
        const { data: lines } = await supabase
          .from('invoice_lines')
          .select('*, invoice:invoices(invoice_no,date,customer:customers(name)), article:articles(code,name)')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
        rows = (lines || []).filter((l) => {
          if (!l.invoice) return false;
          if (from && l.invoice.date < from) return false;
          if (to && l.invoice.date > to) return false;
          return true;
        });
        cols = ['Invoice', 'Date', 'Customer', 'Article', 'Size', 'Color', 'Pairs', 'Rate', 'Amount'];
        rows = rows.map((r) => ({ Invoice: r.invoice?.invoice_no, Date: r.invoice?.date, Customer: r.invoice?.customer?.name, Article: r.article?.code, Size: r.size, Color: r.color, Pairs: r.pairs, Rate: r.rate, Amount: r.amount }));
        sts = [{ label: 'Line items', value: fmtNum(rows.length) }, { label: 'Pairs sold', value: fmtNum(rows.reduce((s, r) => s + (Number(r.Pairs) || 0), 0)) }, { label: 'Sales value', value: fmtRs(rows.reduce((s, r) => s + (Number(r.Amount) || 0), 0)) }];
      } else if (report === 'customer_ledger') {
        const customers = await fetchParties('customers');
        rows = customers.map((c) => ({ Name: c.name, Phone: c.phone, City: c.city, 'Opening balance': c.opening_balance, Balance: c.balance, Status: c.status }));
        cols = ['Name', 'Phone', 'City', 'Opening balance', 'Balance', 'Status'];
        sts = [{ label: 'Customers', value: fmtNum(rows.length) }, { label: 'Total receivable', value: fmtRs(customers.reduce((s, c) => s + (Number(c.balance) || 0), 0)) }];
      } else if (report === 'supplier_ledger') {
        const suppliers = await fetchParties('suppliers');
        rows = suppliers.map((s) => ({ Name: s.name, Phone: s.phone, City: s.city, 'Opening balance': s.opening_balance, Balance: s.balance, Status: s.status }));
        cols = ['Name', 'Phone', 'City', 'Opening balance', 'Balance', 'Status'];
        sts = [{ label: 'Suppliers', value: fmtNum(rows.length) }, { label: 'Total payable', value: fmtRs(suppliers.reduce((s, c) => s + (Number(c.balance) || 0), 0)) }];
      } else if (report === 'labour') {
        const labour = await fetchLabour();
        cols = ['Name', 'Phone', 'Type', 'Rate', 'Active'];
        rows = labour.map((l) => ({ Name: l.name, Phone: l.phone, Type: l.labour_type, Rate: l.rate, Active: l.is_active ? 'Yes' : 'No' }));
        sts = [{ label: 'Labour', value: fmtNum(rows.length) }, { label: 'Total rate', value: fmtRs(labour.reduce((s, l) => s + (Number(l.rate) || 0), 0)) }];
      }

      setData(rows);
      setColumns(cols);
      setStats(sts);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [report, from, to]);

  const exportCSV = () => {
    if (data.length === 0) return;
    downloadCSV(`${report}.csv`, columns, data.map((r) => columns.map((c) => r[c])));
  };

  return (
    <div>
      <PageHeader
        label="System"
        title="Reports"
        description="Generate reports across every module — filter by date and export to CSV or print."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCSV} disabled={data.length === 0}><Download size={13} /> CSV</Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer size={13} /> Print</Button>
          </>
        }
      />
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="microlabel mb-1">Report type</div>
          <Select value={report} onChange={(e) => setReport(e.target.value)} className="!w-56">
            {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>)}
          </Select>
        </div>
      </div>

      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onClear={() => { setFrom(daysAgo(90)); setTo(today()); }} />

      {stats.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard key={i} label={s.label} value={s.value} accent={i % 2 === 0 ? 'copper' : 'teal'} />
          ))}
        </div>
      )}

      <Card title={REPORTS.find((r) => r.id === report)?.label || 'Report'}>
        {loading ? <Empty>Loading…</Empty> : data.length === 0 ? <Empty>No data for this report in the selected range.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr>{columns.map((c) => <th key={c} className={c === 'Status' ? '' : 'text-right' === '' ? '' : ''}>{c}</th>)}</tr></thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => {
                      const v = r[c];
                      const isNum = typeof v === 'number' || (typeof v === 'string' && /^\d/.test(v) && c !== 'Date' && c !== 'Phone');
                      return <td key={c} className={isNum ? 'num text-right' : ''}>{isNum && c !== 'Quantity' && c !== 'Pairs' && c !== 'Cartons' && c !== 'Rate' ? fmtRs(v) : c === 'Pairs' || c === 'Quantity' || c === 'Cartons' ? fmtNum(v) : v ?? '—'}</td>;
                    })}
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
