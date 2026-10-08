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

const today = () => new Date().toISOString().slice(0, 10);

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

  const { data: existingArticles, error: codeError } = await supabase
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
    {
      p_article_id: data.article_id || null,
      p_article_name: data.article_name || null,
      p_size: data.size || null,
      p_color: data.color || null,
      p_bags: Number(data.bags) || 0,
      p_pairs_per_bag: Number(data.pairs_per_bag) || 0,
      p_notes: data.notes || null,
      p_production_date: data.production_date || today(),
    }
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
    {
      p_supplier_id: data.supplier_id || null,
      p_supplier_name: data.supplier_name || null,
      p_article_id: data.article_id || null,
      p_article_name: data.article_name || null,
      p_size: data.size || null,
      p_color: data.color || null,
      p_quantity: Number(data.quantity) || 0,
      p_rate: Number(data.rate) || 0,
      p_notes: data.notes || null,
      p_purchase_date: data.purchase_date || today(),
    }
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
  if (kind !== 'customers' && kind !== 'suppliers') {
    throw new Error('Invalid party type');
  }

  const functionName =
    kind === 'customers'
      ? 'get_customer_ledger'
      : 'get_supplier_ledger';

  const { data, error } = await supabase.rpc(functionName, {
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
    .select('*, customer:customers(name,phone,address)')
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
    .select('*, customer:customers(name,phone,address)')
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
    {
      p_customer_id: data.customer_id || null,
      p_lines: data.lines || [],
      p_discount: Number(data.discount) || 0,
      p_tax: Number(data.tax) || 0,
      p_received: Number(data.received) || 0,
      p_notes: data.notes || null,
      p_terms: data.terms || null,
      p_invoice_date: data.invoice_date || today(),
    }
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
    {
      p_payment_type: data.payment_type || null,
      p_party_id: data.party_id || null,
      p_person_name: data.person_name || null,
      p_amount: Number(data.amount) || 0,
      p_details: data.details || null,
      p_payment_date: data.payment_date || today(),
    }
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
    transaction_date: data.transaction_date || today(),
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
    {
      p_title: data.title || '',
      p_details: data.details || null,
      p_amount: Number(data.amount) || 0,
      p_expense_date: data.expense_date || today(),
    }
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
  const { workspaceId } = await getCurrentUserAndWorkspace();

  const updateData = {
    company_name: settings.company_name ?? null,
    company_phone: settings.company_phone ?? null,
    company_email: settings.company_email ?? null,
    company_address: settings.company_address ?? null,
    currency: settings.currency ?? 'PKR',
    pairs_per_carton:
      Number(settings.pairs_per_carton) || 0,
    production_bag_options:
      settings.production_bag_options ?? null,
    carton_options:
      settings.carton_options ?? null,
    invoice_start_number:
      Number(settings.invoice_start_number) || 100,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await supabase
    .from('settings')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    const { user } = await getCurrentUserAndWorkspace();

    const { data, error } = await supabase
      .from('settings')
      .insert({
        workspace_id: workspaceId,
        ...updateData,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  const { data, error } = await supabase
    .from('settings')
    .update(updateData)
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
  const { data, error } = await supabase.rpc(
    'get_recycle_bin'
  );

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
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}

// ─────────────────────────────────────────────────────────────────────
// Workspace Members / User Management
// ─────────────────────────────────────────────────────────────────────

export async function fetchWorkspaceMembers() {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
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
// Supabase export
// ─────────────────────────────────────────────────────────────────────

export { supabase };
