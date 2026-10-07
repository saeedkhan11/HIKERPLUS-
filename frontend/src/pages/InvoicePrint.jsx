import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { fetchInvoice, fetchSettings } from '../lib/services';
import { Button } from '../components/ui';
import InvoiceSheet from '../components/InvoiceSheet';

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvoice(id).then((i) => {
      setInvoice({
        ...i,
        customer_name: i.customer?.name,
        customer_address: i.customer?.address,
        customer_city: i.customer?.city,
        customer_phone: i.customer?.phone,
        lines: (i.lines || []).map((l) => ({
          ...l,
          article_code: l.article?.code,
          article_name: l.article?.name,
        })),
      });
    }).catch((e) => setError(e.message));
    fetchSettings().then(setSettings).catch(() => {});
  }, [id]);

  if (error) return <div className="p-6 text-sm font-semibold text-red-700">{error}</div>;
  if (!invoice) return <div className="p-6 text-sm text-mutedfg">Loading…</div>;

  return (
    <div>
      <div className="no-print mb-4 flex items-center gap-2">
        <Button variant="secondary" onClick={() => navigate('/invoices')}><ArrowLeft size={15} /> Back</Button>
        <Button onClick={() => window.print()}><Printer size={15} /> Print / PDF</Button>
      </div>
      <InvoiceSheet settings={settings || {}} invoice={invoice} />
    </div>
  );
}
