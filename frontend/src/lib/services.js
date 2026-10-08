import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────

async function getCurrentUserAndWorkspace() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  if (!user) {
    throw new Error('You are not logged in');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('workspace_id, role')
    .eq('id', user.id)
    .single();

  if (profileError) throw profileError;

  if (!profile?.workspace_id) {
    throw new Error('Workspace not found for current user');
  }

  return {
    user,
    workspaceId: profile.workspace_id,
    role: profile.role,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Articles
// ─────────────────────────────────────────────────────────────────────

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

  // Update existing article
  if (article.id) {
    const { data, error } = await supabase
      .from('articles')
      .update({
        code: article.code,
        name: article.name,
        details: article.details || null,
        sizes: article.sizes || null,
        colors: article.colors || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', article.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Find highest existing article number
  const { data: existingArticles, error: codeError } =
    await supabase
      .from('articles')
      .select('code')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

  if (codeError) throw codeError;

  let highest = 0;

  for (const row of existingArticles || []) {
    const match = String(row.code || '').match(/(\d+)$/);

    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }

  const nextCode = `ART-${String(highest + 1).padStart(3, '0')}`;

  const { data, error } = await supabase
    .from('articles')
    .insert({
      workspace_id: workspaceId,
      code: nextCode,
      name: article.name,
      details: article.details || null,
      sizes: article.sizes || null,
      colors: article.colors || null,
      is_deleted: false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteArticle(id) {
  const { error } = await supabase
    .from('articles')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Raw Stock
// ─────────────────────────────────────────────────────────────────────

export async function fetchRawStock() {
  const { data, error } = await supabase
    .from('raw_stock')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function saveRawStock(item) {
  const { user, workspaceId } = await getCurrentUserAndWorkspace();

  // Update existing record
  if (item.id) {
    const { data, error } = await supabase
      .from('raw_stock')
      .update({
        article_id: item.article_id || null,
        category: item.category || null,
        subcategory: item.subcategory || null,
        article_name: item.article_name || null,
        size: item.size || null,
        color: item.color || null,
        quantity: Number(item.quantity) || 0,
        unit: item.unit || null,
        movement_type: item.movement_type || null,
        reference_id: item.reference_id || null,
        notes: item.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Create new record
  const { data, error } = await supabase
    .from('raw_stock')
    .insert({
      workspace_id: workspaceId,
      article_id: item.article_id || null,
      category: item.category || null,
      subcategory: item.subcategory || null,
      article_name: item.article_name || null,
      size: item.size || null,
      color: item.color || null,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || null,
      movement_type: item.movement_type || 'IN',
      reference_id: item.reference_id || null,
      notes: item.notes || null,
      is_deleted: false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteRawStock(id) {
  const { error } = await supabase
    .from('raw_stock')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Ready Shoes
// ─────────────────────────────────────────────────────────────────────

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
  const { user, workspaceId } = await getCurrentUserAndWorkspace();

  // Update existing record
  if (item.id) {
    const { data, error } = await supabase
      .from('ready_shoes')
      .update({
        article_id: item.article_id || null,
        article_name: item.article_name || null,
        size: item.size || null,
        color: item.color || null,
        quantity: Number(item.quantity) || 0,
        movement_type: item.movement_type || null,
        reference_id: item.reference_id || null,
        notes: item.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Create new record
  const { data, error } = await supabase
    .from('ready_shoes')
    .insert({
      workspace_id: workspaceId,
      article_id: item.article_id || null,
      article_name: item.article_name || null,
      size: item.size || null,
      color: item.color || null,
      quantity: Number(item.quantity) || 0,
      movement_type: item.movement_type || 'IN',
      reference_id: item.reference_id || null,
      notes: item.notes || null,
      is_deleted: false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteReadyShoes(id) {
  const { error } = await supabase
    .from('ready_shoes')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Production
// ─────────────────────────────────────────────────────────────────────

export async function fetchProduction(from, to) {
  let q = supabase
    .from('production_entries')
    .select('*, article:articles(code,name)')
    .eq('is_deleted', false)
    .order('production_date', { ascending: false });

  if (from && to) {
    q = q
      .gte('production_date', from)
      .lte('production_date', to);
  }

  const { data, error } = await q;

  if (error) throw error;

  return data || [];
}

export async function createProduction(data) {
  const { data: result, error } = await supabase.rpc(
    'record_production',
    data
  );

  if (error) throw error;

  return result;
}

export async function deleteProduction(id) {
  const { error } = await supabase
    .from('production_entries')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Purchases
// ─────────────────────────────────────────────────────────────────────

export async function fetchPurchases(from, to) {
  let q = supabase
    .from('purchases')
    .select('*')
    .eq('is_deleted', false)
    .order('purchase_date', { ascending: false });

  if (from && to) {
    q = q
      .gte('purchase_date', from)
      .lte('purchase_date', to);
  }

  const { data, error } = await q;

  if (error) throw error;

  return data || [];
}

export async function createPurchase(data) {
  const { data: result, error } = await supabase.rpc(
    'record_purchase',
    data
  );

  if (error) throw error;

  return result;
}

export async function deletePurchase(id) {
  const { error } = await supabase
    .from('purchases')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Customers & Suppliers
// ─────────────────────────────────────────────────────────────────────

export async function fetchParties(kind) {
  if (kind !== 'customers' && kind !== 'suppliers') {
    throw new Error('Invalid party type');
  }

  const { data, error } = await supabase
    .from(kind)
    .select('*')
    .eq('is_deleted', false)
    .order('name');

  if (error) throw error;

  return data || [];
}

export async function saveParty(kind, party) {
  if (kind !== 'customers' && kind !== 'suppliers') {
    throw new Error('Invalid party type');
  }

  const { user, workspaceId } = await getCurrentUserAndWorkspace();

  // Update existing customer/supplier
  if (party.id) {
    const updateData = {
      name: party.name,
      phone: party.phone || null,
      address: party.address || null,
      opening_balance: Number(party.opening_balance) || 0,
      balance: Number(party.balance) || 0,
      notes: party.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(kind)
      .update(updateData)
      .eq('id', party.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Create new customer/supplier
  const insertData = {
    workspace_id: workspaceId,
    name: party.name,
    phone: party.phone || null,
    address: party.address || null,
    opening_balance: Number(party.opening_balance) || 0,
    balance: Number(party.balance) || 0,
    notes: party.notes || null,
    is_deleted: false,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from(kind)
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteParty(kind, id) {
  if (kind !== 'customers' && kind !== 'suppliers') {
    throw new Error('Invalid party type');
  }

  const { error } = await supabase
    .from(kind)
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchPartyLedger(kind, id) {
  const fn =
    kind === 'customers'
      ? 'get_customer_ledger'
      : 'get_supplier_ledger';

  const { data, error } = await supabase.rpc(fn, {
    p_party_id: id,
  });

  if (error) throw error;

  return data || [];
}

// ─────────────────────────────────────────────────────────────────────
// Invoices
// ─────────────────────────────────────────────────────────────────────

export async function fetchInvoices(from, to) {
  let q = supabase
    .from('invoices')
    .select(
      '*, customer:customers(name,phone,address)'
    )
    .eq('is_deleted', false)
    .order('invoice_date', { ascending: false });

  if (from && to) {
    q = q
      .gte('invoice_date', from)
      .lte('invoice_date', to);
  }

  const { data, error } = await q;

  if (error) throw error;

  return data || [];
}

export async function fetchInvoice(id) {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      '*, customer:customers(name,phone,address)'
    )
    .eq('id', id)
    .single();

  if (error) throw error;

  const { data: lines, error: linesError } = await supabase
    .from('invoice_lines')
    .select('*, article:articles(code,name)')
    .eq('invoice_id', id)
    .order('created_at');

  if (linesError) throw linesError;

  return {
    ...invoice,
    lines: lines || [],
  };
}

export async function createInvoice(data) {
  const { data: result, error } = await supabase.rpc(
    'create_invoice',
    data
  );

  if (error) throw error;

  return result;
}

export async function deleteInvoice(id) {
  const { error } = await supabase
    .from('invoices')
    .update({
      is_deleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────────────

export async function fetchPayments(from, to) {
  let q = supabase
    .from('payments')
    .select('*')
    .order('payment_date', { ascending: false });

  if (from && to) {
    q = q
      .gte('payment_date', from)
      .lte('payment_date', to);
  }

  const { data, error } = await q;

  if (error) throw error;

  return data || [];
}

export async function createPayment(data) {
  const { data: result, error } = await supabase.rpc(
    'record_payment',
    data
  );

  if (error) throw error;

  return result;
}

export async function deletePayment(id) {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Roznamcha
// ─────────────────────────────────────────────────────────────────────

export async function fetchRoznamcha(from, to) {
  let q = supabase
    .from('roznamcha')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (from && to) {
    q = q
      .gte('transaction_date', from)
      .lte('transaction_date', to);
  }

  const { data, error } = await q;

  if (error) throw error;

  return data || [];
}

export async function createRoznamchaEntry(data) {
  const { user, workspaceId } = await getCurrentUserAndWorkspace();

  const insertData = {
    workspace_id: workspaceId,
    transaction_type: data.transaction_type,
    description: data.description || null,
    amount: Number(data.amount) || 0,
    reference_id: data.reference_id || null,
    transaction_date:
      data.transaction_date ||
      new Date().toISOString().slice(0, 10),
    created_by: user.id,
  };

  const { data: result, error } = await supabase
    .from('roznamcha')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Kharcha / Expenses
// ─────────────────────────────────────────────────────────────────────

export async function fetchKharcha(from, to) {
  let q = supabase
    .from('kharcha')
    .select('*')
    .order('expense_date', { ascending: false });

  if (from && to) {
    q = q
      .gte('expense_date', from)
      .lte('expense_date', to);
  }

  const { data, error } = await q;

  if (error) throw error;

  return data || [];
}

export async function createKharcha(data) {
  const { data: result, error } = await supabase.rpc(
    'record_kharcha',
    data
  );

  if (error) throw error;

  return result;
}

export async function deleteKharcha(id) {
  const { error } = await supabase
    .from('kharcha')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();

  if (error) throw error;

  return data;
}

export async function saveSettings(settings) {
  const { data: existing, error: existingError } =
    await supabase
      .from('settings')
      .select('id')
      .single();

  if (existingError) throw existingError;

  if (!existing) {
    throw new Error('Settings not found');
  }

  const { data, error } = await supabase
    .from('settings')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ─────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────

export async function fetchDashboard() {
  const { data, error } = await supabase.rpc('get_dashboard');

  if (error) throw error;

  return data;
}

// ─────────────────────────────────────────────────────────────────────
// Recycle Bin
// ─────────────────────────────────────────────────────────────────────

export async function fetchRecycleBin() {
  const { data, error } = await supabase.rpc('get_recycle_bin');

  if (error) throw error;

  return data || [];
}

export async function restoreRecord(table, id) {
  const { error } = await supabase.rpc(
    'restore_record',
    {
      p_table: table,
      p_id: id,
    }
  );

  if (error) throw error;
}

export async function permanentlyDelete(table, id) {
  const { error } = await supabase.rpc(
    'permanent_delete',
    {
      p_table: table,
      p_id: id,
    }
  );

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Audit Logs
// ─────────────────────────────────────────────────────────────────────

export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(name,email)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}

// ─────────────────────────────────────────────────────────────────────
// User Management
// ─────────────────────────────────────────────────────────────────────

export async function fetchWorkspaceMembers() {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, profile:profiles(name,email)')
    .order('created_at');

  if (error) throw error;

  return data || [];
}

export async function updateMemberRole(memberId, role) {
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────
// Sales
// ─────────────────────────────────────────────────────────────────────

export async function fetchSalesItems(from, to) {
  const { data, error } = await supabase
    .from('invoice_lines')
    .select(
      '*, invoice:invoices(invoice_no,invoice_date,customer:customers(name)), article:articles(code,name)'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).filter((item) => {
    if (!item.invoice) return false;

    if (
      from &&
      item.invoice.invoice_date < from
    ) {
      return false;
    }

    if (
      to &&
      item.invoice.invoice_date > to
    ) {
      return false;
    }

    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────
// Re-export Supabase
// ─────────────────────────────────────────────────────────────────────

export { supabase };
