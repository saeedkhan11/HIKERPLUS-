import { supabase } from './supabase';

// ── Articles ──────────────────────────────────────────────────────────
export async function fetchArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('is_deleted', false)
    .order('code');
  if (error) throw error;
  return data;
}

export async function saveArticle(article) {
  if (article.id) {
    const { data, error } = await supabase
      .from('articles')
      .update({ ...article, updated_at: new Date().toISOString() })
      .eq('id', article.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('articles')
    .insert(article)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteArticle(id) {
  const { error } = await supabase
    .from('articles')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Raw Stock ─────────────────────────────────────────────────────────
export async function fetchRawStock() {
  const { data, error } = await supabase
    .from('raw_stock')
    .select('*, supplier:suppliers(name)')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveRawStock(item) {
  if (item.id) {
    const { data, error } = await supabase
      .from('raw_stock')
      .update(item)
      .eq('id', item.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('raw_stock')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRawStock(id) {
  const { error } = await supabase
    .from('raw_stock')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Ready Shoes ────────────────────────────────────────────────────────
export async function fetchReadyShoes() {
  const { data, error } = await supabase
    .from('ready_shoes')
    .select('*, article:articles(code,name)')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveReadyShoes(item) {
  if (item.id) {
    const { data, error } = await supabase
      .from('ready_shoes')
      .update(item)
      .eq('id', item.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('ready_shoes')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReadyShoes(id) {
  const { error } = await supabase
    .from('ready_shoes')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Production ─────────────────────────────────────────────────────────
export async function fetchProduction(from, to) {
  let q = supabase
    .from('production_entries')
    .select('*, article:articles(code,name)')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createProduction(data) {
  const { data: result, error } = await supabase.rpc('record_production', data);
  if (error) throw error;
  return result;
}

export async function deleteProduction(id) {
  const { error } = await supabase
    .from('production_entries')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Purchases ──────────────────────────────────────────────────────────
export async function fetchPurchases(from, to) {
  let q = supabase
    .from('purchases')
    .select('*, supplier:suppliers(name)')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createPurchase(data) {
  const { data: result, error } = await supabase.rpc('record_purchase', data);
  if (error) throw error;
  return result;
}

export async function deletePurchase(id) {
  const { error } = await supabase
    .from('purchases')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Customers & Suppliers ──────────────────────────────────────────────
export async function fetchParties(kind) {
  const { data, error } = await supabase
    .from(kind)
    .select('*')
    .eq('is_deleted', false)
    .order('name');
  if (error) throw error;
  return data;
}

export async function saveParty(kind, party) {
  if (party.id) {
    const { data, error } = await supabase
      .from(kind)
      .update({ ...party, updated_at: new Date().toISOString() })
      .eq('id', party.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from(kind)
    .insert(party)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteParty(kind, id) {
  const { error } = await supabase
    .from(kind)
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchPartyLedger(kind, id) {
  const fn = kind === 'customers' ? 'get_customer_ledger' : 'get_supplier_ledger';
  const { data, error } = await supabase.rpc(fn, { p_party_id: id });
  if (error) throw error;
  return data;
}

// ── Invoices ───────────────────────────────────────────────────────────
export async function fetchInvoices(from, to) {
  let q = supabase
    .from('invoices')
    .select('*, customer:customers(name,phone,address,city)')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function fetchInvoice(id) {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, customer:customers(name,phone,address,city)')
    .eq('id', id)
    .single();
  if (error) throw error;
  const { data: lines, error: lerr } = await supabase
    .from('invoice_lines')
    .select('*, article:articles(code,name)')
    .eq('invoice_id', id);
  if (lerr) throw lerr;
  return { ...invoice, lines: lines || [] };
}

export async function createInvoice(data) {
  const { data: result, error } = await supabase.rpc('create_invoice', data);
  if (error) throw error;
  return result;
}

export async function deleteInvoice(id) {
  const { error } = await supabase
    .from('invoices')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Payments ───────────────────────────────────────────────────────────
export async function fetchPayments(from, to) {
  let q = supabase
    .from('payments')
    .select('*')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createPayment(data) {
  const { data: result, error } = await supabase.rpc('record_payment', data);
  if (error) throw error;
  return result;
}

export async function deletePayment(id) {
  const { error } = await supabase
    .from('payments')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Roznamcha ──────────────────────────────────────────────────────────
export async function fetchRoznamcha(from, to) {
  let q = supabase
    .from('roznamcha')
    .select('*')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createRoznamchaEntry(data) {
  const { data: result, error } = await supabase
    .from('roznamcha')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ── Kharcha / Expenses ─────────────────────────────────────────────────
export async function fetchKharcha(from, to) {
  let q = supabase
    .from('kharcha')
    .select('*')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createKharcha(data) {
  const { data: result, error } = await supabase.rpc('record_kharcha', data);
  if (error) throw error;
  return result;
}

export async function deleteKharcha(id) {
  const { error } = await supabase
    .from('kharcha')
    .update({ is_deleted: true, deleted_date: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Settings ───────────────────────────────────────────────────────────
export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').single();
  if (error) throw error;
  return data;
}

export async function saveSettings(settings) {
  const { data, error } = await supabase
    .from('settings')
    .update(settings)
    .eq('id', 1)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Dashboard ──────────────────────────────────────────────────────────
export async function fetchDashboard() {
  const { data, error } = await supabase.rpc('get_dashboard');
  if (error) throw error;
  return data;
}

// ── Recycle Bin ────────────────────────────────────────────────────────
export async function fetchRecycleBin() {
  const { data, error } = await supabase.rpc('get_recycle_bin');
  if (error) throw error;
  return data;
}

export async function restoreRecord(table, id) {
  const { error } = await supabase.rpc('restore_record', { p_table: table, p_id: id });
  if (error) throw error;
}

export async function permanentlyDelete(table, id) {
  const { error } = await supabase.rpc('permanent_delete', { p_table: table, p_id: id });
  if (error) throw error;
}

// ── Audit Logs ──────────────────────────────────────────────────────────
export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(name,email)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ── User Management ────────────────────────────────────────────────────
export async function fetchWorkspaceMembers() {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, profile:profiles(name,email)')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function updateMemberRole(memberId, role) {
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId);
  if (error) throw error;
}

// ── Sales (invoice line items) ──────────────────────────────────────────
export async function fetchSalesItems(from, to) {
  let q = supabase
    .from('invoice_lines')
    .select('*, invoice:invoices(invoice_no,date,customer:customers(name)), article:articles(code,name)')
    .eq('is_deleted', false)
    .order('date', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
