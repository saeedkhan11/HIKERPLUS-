import { supabase } from './supabase';

// ─── Helpers ───────────────────────────────────────────────────────────

async function getCurrentUserAndWorkspace() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('You are not logged in');
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('workspace_id, role')
    .eq('id', user.id)
    .single();
  if (pErr) throw pErr;
  if (!profile?.workspace_id) throw new Error('Workspace not found');
  return { user, workspaceId: profile.workspace_id, role: profile.role };
}

const today = () => new Date().toISOString().slice(0, 10);

// ─── Articles ──────────────────────────────────────────────────────────

export async function fetchArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('is_deleted', false)
    .order('code');
  if (error) throw error;
  return data || [];
}

export async function saveArticle(article) {
  const { user, workspaceId } = await getCurrentUserAndWorkspace();
  const payload = {
    code: article.code || '',
    name: article.name,
    category: article.category || '',
    sizes: article.sizes || '',
    colors: article.colors || '',
    upper_type: article.upper_type || '',
    sole_type: article.sole_type || '',
    cost_price: Number(article.cost_price) || 0,
    selling_price: Number(article.selling_price) || 0,
    status: article.status || 'active',
  };
  if (article.id) {
    const { data, error } = await supabase.from('articles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', article.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('articles').insert({ ...payload, workspace_id: workspaceId, is_deleted: false }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteArticle(id) {
  const { error } = await supabase.from('articles').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ─── Raw Stock ─────────────────────────────────────────────────────────

export async function fetchRawStock() {
  const { data, error } = await supabase
    .from('raw_stock')
    .select('*, supplier:suppliers(name)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveRawStock(item) {
  const { user, workspaceId } = await getCurrentUserAndWorkspace();
  if (!item.category_slug) throw new Error('Category is required');
  const payload = {
    item: item.item || '',
    category_slug: item.category_slug,
    article_code: item.article_code || '',
    pack_type: item.pack_type || '',
    pairs_per_pack: Number(item.pairs_per_pack) || 0,
    quantity: Number(item.quantity) || 0,
    unit: item.unit || 'pairs',
    unit_price: Number(item.unit_price) || 0,
    total_pairs: (Number(item.pairs_per_pack) || 0) * (Number(item.quantity) || 0),
    amount: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    supplier_id: item.supplier_id || null,
    date: item.date || today(),
    notes: item.notes || '',
  };
  if (item.id) {
    const { data, error } = await supabase.from('raw_stock').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', item.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('raw_stock').insert({ ...payload, workspace_id: workspaceId, is_deleted: false }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRawStock(id) {
  const { error } = await supabase.from('raw_stock').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ─── Ready Shoes ────────────────────────────────────────────────────────

export async function fetchReadyShoes() {
  const { data, error } = await supabase
    .from('ready_shoes')
    .select('*, article:articles(code,name)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveReadyShoes(item) {
  const { workspaceId } = await getCurrentUserAndWorkspace();
  const payload = {
    article_id: item.article_id,
    carton_type: String(item.pairs_per_carton || 24),
    pairs_per_carton: Number(item.pairs_per_carton) || 24,
    cartons: Number(item.cartons) || 0,
    pairs: Number(item.pairs) || (Number(item.cartons) || 0) * (Number(item.pairs_per_carton) || 24),
    source: item.source || 'manual',
    date: item.date || today(),
  };
  if (item.id) {
    const { data, error } = await supabase.from('ready_shoes').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', item.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('ready_shoes').insert({ ...payload, workspace_id: workspaceId, is_deleted: false }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteReadyShoes(id) {
  const { error } = await supabase.from('ready_shoes').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ─── Production ─────────────────────────────────────────────────────────

export async function fetchProduction(from, to) {
  let q = supabase.from('production_entries').select('*, article:articles(code,name)').eq('is_deleted', false).order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createProduction(data) {
  const { data: result, error } = await supabase.rpc('record_production', {
    p_article_id: data.article_id,
    p_article_name: data.article_name || '',
    p_size: data.size || '',
    p_color: data.color || '',
    p_bags: Number(data.bags) || 0,
    p_pairs_per_bag: Number(data.pairs_per_bag) || 0,
    p_notes: data.notes || '',
    p_production_date: data.production_date || today(),
  });
  if (error) throw error;
  return result;
}

export async function deleteProduction(id) {
  const { error } = await supabase.from('production_entries').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ─── Purchases ──────────────────────────────────────────────────────────

export async function fetchPurchases(from, to) {
  let q = supabase.from('purchases').select('*, supplier:suppliers(name)').eq('is_deleted', false).order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createPurchase(data) {
  const { data: result, error } = await supabase.rpc('record_purchase', {
    p_supplier_id: data.supplier_id,
    p_supplier_name: data.supplier_name || '',
    p_article_id: data.article_id || null,
    p_article_name: data.article_name || '',
    p_size: data.size || '',
    p_color: data.color || '',
    p_quantity: Number(data.quantity) || 0,
    p_rate: Number(data.rate) || 0,
    p_notes: data.notes || '',
    p_purchase_date: data.purchase_date || today(),
  });
  if (error) throw error;
  return result;
}

export async function deletePurchase(id) {
  const { error } = await supabase.from('purchases').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ─── Customers & Suppliers ─────────────────────────────────────────────

export async function fetchParties(kind) {
  const { data, error } = await supabase.from(kind).select('*').eq('is_deleted', false).order('name');
  if (error) throw error;
  return data || [];
}

export async function saveParty(kind, party) {
  const { workspaceId } = await getCurrentUserAndWorkspace();
  const payload = {
    name: party.name,
    phone: party.phone || '',
    address: party.address || '',
    city: party.city || '',
    product_details: party.product_details || '',
    opening_balance: Number(party.opening_balance) || 0,
    balance: Number(party.balance) || 0,
    status: party.status || 'active',
  };
  if (party.id) {
    const { data, error } = await supabase.from(kind).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', party.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from(kind).insert({ ...payload, workspace_id: workspaceId, is_deleted: false }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteParty(kind, id) {
  const { error } = await supabase.from(kind).update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function fetchPartyLedger(kind, id) {
  const functionName = kind === 'customers' ? 'get_customer_ledger' : 'get_supplier_ledger';
  const paramName = kind === 'customers' ? 'p_customer_id' : 'p_supplier_id';
  const { data, error } = await supabase.rpc(functionName, { [paramName]: id });
  if (error) throw error;
  return data || [];
}

// ─── Invoices ──────────────────────────────────────────────────────────

export async function fetchInvoices(from, to) {
  let q = supabase.from('invoices').select('*, customer:customers(name,phone,address)').eq('is_deleted', false).order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchInvoice(id) {
  const { data: invoice, error } = await supabase.from('invoices').select('*, customer:customers(name,phone,address)').eq('id', id).single();
  if (error) throw error;
  const { data: lines, error: lErr } = await supabase.from('invoice_lines').select('*, article:articles(code,name)').eq('invoice_id', id).order('created_at');
  if (lErr) throw lErr;
  return { ...invoice, lines: lines || [] };
}

export async function createInvoice(data) {
  const { data: result, error } = await supabase.rpc('create_invoice', {
    p_customer_id: data.customer_id,
    p_lines: data.lines || [],
    p_discount: Number(data.discount) || 0,
    p_tax: Number(data.tax) || 0,
    p_received: Number(data.received) || 0,
    p_notes: data.notes || '',
    p_terms: data.terms || '',
    p_invoice_date: data.invoice_date || today(),
  });
  if (error) throw error;
  return result;
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ─── Payments ──────────────────────────────────────────────────────────

export async function fetchPayments(from, to) {
  let q = supabase.from('payments').select('*').order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createPayment(data) {
  const { data: result, error } = await supabase.rpc('record_payment', {
    p_payment_type: data.payment_type,
    p_party_id: data.party_id,
    p_person_name: data.person_name || '',
    p_amount: Number(data.amount) || 0,
    p_details: data.details || '',
    p_payment_date: data.payment_date || today(),
  });
  if (error) throw error;
  return result;
}

export async function deletePayment(id) {
  const { error } = await supabase.from('payments').delete().eq('id', id);
  if (error) throw error;
}

// ─── Roznamcha ─────────────────────────────────────────────────────────

export async function fetchRoznamcha(from, to) {
  let q = supabase.from('roznamcha').select('*').order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createRoznamchaEntry(data) {
  const { workspaceId } = await getCurrentUserAndWorkspace();
  const { data: result, error } = await supabase.from('roznamcha').insert({
    workspace_id: workspaceId,
    date: data.date || today(),
    type: data.type || data.transaction_type,
    amount: Number(data.amount) || 0,
    description: data.description || '',
    reference_type: data.reference_type || '',
    reference_id: data.reference_id || null,
  }).select().single();
  if (error) throw error;
  return result;
}

// ─── Kharcha ───────────────────────────────────────────────────────────

export async function fetchKharcha(from, to) {
  let q = supabase.from('kharcha').select('*').order('date', { ascending: false });
  if (from && to) q = q.gte('date', from).lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createKharcha(data) {
  const { data: result, error } = await supabase.rpc('record_kharcha', {
    p_title: data.title || data.category || '',
    p_details: data.details || data.description || '',
    p_amount: Number(data.amount) || 0,
    p_expense_date: data.expense_date || data.date || today(),
  });
  if (error) throw error;
  return result;
}

export async function deleteKharcha(id) {
  const { error } = await supabase.from('kharcha').delete().eq('id', id);
  if (error) throw error;
}

// ─── Labour ────────────────────────────────────────────────────────────

export async function fetchLabour() {
  const { data, error } = await supabase.from('labour').select('*').eq('is_deleted', false).order('name');
  if (error) throw error;
  return data || [];
}

export async function saveLabour(labour) {
  const { workspaceId } = await getCurrentUserAndWorkspace();
  const payload = {
    name: labour.name,
    phone: labour.phone || '',
    address: labour.address || '',
    labour_type: labour.labour_type || '',
    rate: Number(labour.rate) || 0,
    notes: labour.notes || '',
    is_active: labour.is_active !== false,
  };
  if (labour.id) {
    const { data, error } = await supabase.from('labour').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', labour.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('labour').insert({ ...payload, workspace_id: workspaceId, is_deleted: false }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLabour(id) {
  const { error } = await supabase.from('labour').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function fetchLabourPayments(labourId) {
  let q = supabase.from('labour_payments').select('*').eq('is_deleted', false).order('date', { ascending: false });
  if (labourId) q = q.eq('labour_id', labourId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createLabourPayment(data) {
  const { data: result, error } = await supabase.rpc('record_labour_payment', {
    p_labour_id: data.labour_id,
    p_amount: Number(data.amount) || 0,
    p_payment_type: data.payment_type || 'payment',
    p_date: data.date || today(),
    p_description: data.description || '',
  });
  if (error) throw error;
  return result;
}

export async function fetchLabourBalance(labourId) {
  const { data, error } = await supabase.rpc('get_labour_balance', { p_labour_id: labourId });
  if (error) throw error;
  return data || {};
}

// ─── Settings ──────────────────────────────────────────────────────────

export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').single();
  if (error) throw error;
  return data;
}

export async function saveSettings(settings) {
  const { workspaceId } = await getCurrentUserAndWorkspace();
  const payload = {
    company_name: settings.company_name ?? null,
    tagline: settings.tagline ?? null,
    address: settings.address ?? null,
    phone: settings.phone ?? null,
    email: settings.email ?? null,
    bank_name: settings.bank_name ?? null,
    account_title: settings.account_title ?? null,
    account_no: settings.account_no ?? null,
    iban: settings.iban ?? null,
    footer_note: settings.footer_note ?? null,
    currency: settings.currency ?? 'Rs',
    pairs_per_carton: Number(settings.pairs_per_carton) || 24,
    production_bag_options: settings.production_bag_options ?? null,
    carton_options: settings.carton_options ?? null,
    invoice_start_number: Number(settings.invoice_start_number) || 100,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from('settings').select('id').eq('workspace_id', workspaceId).maybeSingle();
  if (!existing) {
    const { data, error } = await supabase.from('settings').insert({ workspace_id: workspaceId, ...payload }).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('settings').update(payload).eq('id', existing.id).select().single();
  if (error) throw error;
  return data;
}

// ─── Dashboard ────────────────────────────────────────────────────────

export async function fetchDashboard() {
  const { data, error } = await supabase.rpc('get_dashboard');
  if (error) throw error;
  return data;
}

// ─── Recycle Bin ───────────────────────────────────────────────────────

export async function fetchRecycleBin() {
  const { data, error } = await supabase.rpc('get_recycle_bin');
  if (error) throw error;
  return data || [];
}

export async function restoreRecord(table, id) {
  const { error } = await supabase.rpc('restore_record', { p_table: table, p_id: id });
  if (error) throw error;
}

export async function permanentlyDelete(table, id) {
  const { error } = await supabase.rpc('permanent_delete', { p_table: table, p_id: id });
  if (error) throw error;
}

// ─── Audit Logs ────────────────────────────────────────────────────────

export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// ─── Workspace Members ────────────────────────────────────────────────

export async function fetchWorkspaceMembers() {
  const { data, error } = await supabase.from('workspace_members').select('*').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function updateMemberRole(memberId, role) {
  const { error } = await supabase.from('workspace_members').update({ role }).eq('id', memberId);
  if (error) throw error;
}

// ─── Sales ─────────────────────────────────────────────────────────────

export async function fetchSalesItems(from, to) {
  const { data, error } = await supabase
    .from('invoice_lines')
    .select('*, invoice:invoices(invoice_no,date,customer:customers(name)), article:articles(code,name)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).filter((item) => {
    if (!item.invoice) return false;
    if (from && item.invoice.date < from) return false;
    if (to && item.invoice.date > to) return false;
    return true;
  });
}

export { supabase };
