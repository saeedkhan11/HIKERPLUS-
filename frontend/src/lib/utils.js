export const fmtRs = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-US');
export const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-US');
export const today = () => new Date().toISOString().slice(0, 10);
export const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export const BAG_SIZES = [80, 100, 120, 150];
export const CARTON_SIZES = [12, 18, 24];
export const UNITS = ['pairs', 'pieces', 'kg', 'cartons', 'boxes', 'drums'];

export const isBag = (packType) => /^bags?$/i.test(String(packType || '').trim());

export function downloadCSV(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.map(esc).join(',')]
    .concat(rows.map((r) => r.map(esc).join(',')))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
