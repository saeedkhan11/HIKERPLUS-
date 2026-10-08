-- ============================================================================
-- HIKER+ ERP — Migration 0002: Update RPC signatures, add columns, Labour
-- ============================================================================

-- ── Add missing columns to existing tables ──────────────────────────────

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms TEXT DEFAULT '';

ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS size TEXT DEFAULT '';
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '';
ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS article_id UUID;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS size TEXT DEFAULT '';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE settings ADD COLUMN IF NOT EXISTS production_bag_options TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS carton_options TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS invoice_start_number INTEGER DEFAULT 100;

-- ── Labour tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS labour (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT DEFAULT '',
  address       TEXT DEFAULT '',
  labour_type    TEXT DEFAULT '',
  rate          NUMERIC DEFAULT 0,
  notes         TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT true,
  is_deleted     BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labour_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  labour_id     UUID NOT NULL REFERENCES labour(id) ON DELETE CASCADE,
  amount        NUMERIC DEFAULT 0,
  payment_type  TEXT DEFAULT 'payment' CHECK (payment_type IN ('payment','advance')),
  date          TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  description   TEXT DEFAULT '',
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_labour_ws ON labour(workspace_id);
CREATE INDEX IF NOT EXISTS idx_labour_pay_ws ON labour_payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_labour_pay_labour ON labour_payments(labour_id);

-- ── RLS for labour ──────────────────────────────────────────────────────

ALTER TABLE labour ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_sel ON labour;
DROP POLICY IF EXISTS lab_ins ON labour;
DROP POLICY IF EXISTS lab_upd ON labour;
DROP POLICY IF EXISTS lab_del ON labour;
CREATE POLICY lab_sel ON labour FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY lab_ins ON labour FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY lab_upd ON labour FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY lab_del ON labour FOR DELETE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS labpay_sel ON labour_payments;
DROP POLICY IF EXISTS labpay_ins ON labour_payments;
DROP POLICY IF EXISTS labpay_upd ON labour_payments;
DROP POLICY IF EXISTS labpay_del ON labour_payments;
CREATE POLICY labpay_sel ON labour_payments FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY labpay_ins ON labour_payments FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY labpay_upd ON labour_payments FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY labpay_del ON labour_payments FOR DELETE USING (workspace_id = current_workspace_id());

-- ── Triggers for updated_at on labour tables ────────────────────────────

DROP TRIGGER IF EXISTS trg_labour_updated_at ON labour;
CREATE TRIGGER trg_labour_updated_at BEFORE UPDATE ON labour FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_labour_pay_updated_at ON labour_payments;
CREATE TRIGGER trg_labour_pay_updated_at BEFORE UPDATE ON labour_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Grants ──────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON labour, labour_payments TO anon, authenticated;

-- ============================================================================
-- UPDATED RPC FUNCTIONS (signatures per spec)
-- ============================================================================

-- Drop functions whose signatures change (PostgreSQL can't rename params via CREATE OR REPLACE)
DROP FUNCTION IF EXISTS create_invoice(UUID, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS record_production(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS record_purchase(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS record_payment(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS record_kharcha(TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_customer_ledger(UUID);
DROP FUNCTION IF EXISTS get_supplier_ledger(UUID);
DROP FUNCTION IF EXISTS get_dashboard();
DROP FUNCTION IF EXISTS get_recycle_bin();
DROP FUNCTION IF EXISTS setup_pin(UUID, TEXT);
DROP FUNCTION IF EXISTS verify_pin(UUID, TEXT);
DROP FUNCTION IF EXISTS change_pin(UUID, TEXT, TEXT);

-- ── create_invoice ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_invoice(
  p_customer_id  UUID,
  p_lines        JSONB,
  p_discount     NUMERIC DEFAULT 0,
  p_tax          NUMERIC DEFAULT 0,
  p_received     NUMERIC DEFAULT 0,
  p_notes        TEXT   DEFAULT '',
  p_terms        TEXT   DEFAULT '',
  p_invoice_date TEXT   DEFAULT (now()::date)::TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws   UUID;
  v_no   TEXT;
  v_id   UUID;
  v_sub  NUMERIC := 0;
  v_total NUMERIC;
  v_bal  NUMERIC;
  v_line JSONB;
  v_aid  UUID;
  v_pairs NUMERIC;
  v_amt  NUMERIC;
  v_avail NUMERIC;
  v_acode TEXT;
  v_aname TEXT;
  v_cname TEXT;
  v_start INTEGER;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(invoice_start_number, 100) INTO v_start FROM settings WHERE workspace_id = v_ws;
  SELECT COALESCE(MAX(invoice_no::INTEGER), v_start - 1) + 1 INTO v_no
  FROM invoices WHERE workspace_id = v_ws AND invoice_no ~ '^[0-9]+$';

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_aid := (v_line->>'article_id')::UUID;
    v_pairs := ((v_line->>'pairs_per_carton')::NUMERIC) * ((v_line->>'cartons')::NUMERIC);
    v_amt := v_pairs * ((v_line->>'rate')::NUMERIC);
    v_sub := v_sub + v_amt;

    SELECT COALESCE(SUM(pairs), 0) INTO v_avail
    FROM ready_shoes WHERE workspace_id = v_ws AND article_id = v_aid AND is_deleted = false;
    IF v_avail < v_pairs THEN
      SELECT code INTO v_acode FROM articles WHERE id = v_aid;
      RAISE EXCEPTION 'Insufficient ready stock for %: have %, need %', v_acode, v_avail, v_pairs;
    END IF;
  END LOOP;

  v_total := GREATEST(v_sub - p_discount + p_tax, 0);
  v_bal := v_total - LEAST(p_received, v_total);

  SELECT name INTO v_cname FROM customers WHERE id = p_customer_id;

  INSERT INTO invoices (workspace_id, invoice_no, customer_id, date, subtotal, discount, tax, total, received, balance, status, notes, terms)
  VALUES (v_ws, v_no::TEXT, p_customer_id, p_invoice_date, v_sub, p_discount, p_tax, v_total, p_received, v_bal,
    CASE WHEN v_bal <= 0 THEN 'paid' WHEN p_received > 0 THEN 'partial' ELSE 'unpaid' END,
    p_notes, p_terms)
  RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_aid := (v_line->>'article_id')::UUID;
    v_pairs := ((v_line->>'pairs_per_carton')::NUMERIC) * ((v_line->>'cartons')::NUMERIC);
    v_amt := v_pairs * ((v_line->>'rate')::NUMERIC);
    SELECT code, name INTO v_acode, v_aname FROM articles WHERE id = v_aid;

    INSERT INTO invoice_lines (workspace_id, invoice_id, article_id, article_code, article_name, size, color,
      pairs_per_carton, cartons, pairs, rate, amount, date)
    VALUES (v_ws, v_id, v_aid, v_acode, v_aname, v_line->>'size', v_line->>'color',
      (v_line->>'pairs_per_carton')::NUMERIC, (v_line->>'cartons')::NUMERIC, v_pairs, (v_line->>'rate')::NUMERIC, v_amt, p_invoice_date);

    INSERT INTO ready_shoes (workspace_id, article_id, carton_type, pairs_per_carton, cartons, pairs, source, date)
    VALUES (v_ws, v_aid, (v_line->>'pairs_per_carton')::TEXT, (v_line->>'pairs_per_carton')::NUMERIC,
      (v_line->>'cartons')::NUMERIC, -v_pairs, 'sale', p_invoice_date);
  END LOOP;

  UPDATE customers SET balance = balance + v_bal WHERE id = p_customer_id;

  IF p_received > 0 THEN
    INSERT INTO payments (workspace_id, party_type, party_id, party_name, amount, method, date, description, reference)
    VALUES (v_ws, 'customer', p_customer_id, v_cname, p_received, 'cash', p_invoice_date,
      'Payment for invoice ' || v_no, v_no::TEXT);

    INSERT INTO roznamcha (workspace_id, date, type, amount, description, reference_type, reference_id)
    VALUES (v_ws, p_invoice_date, 'cash_in', p_received, 'Invoice payment — ' || v_cname, 'invoice', v_id);
  END IF;

  PERFORM log_action('create', 'invoices', v_id, jsonb_build_object('invoice_no', v_no, 'total', v_total));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── record_production ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_production(
  p_article_id    UUID,
  p_article_name   TEXT   DEFAULT '',
  p_size           TEXT   DEFAULT '',
  p_color          TEXT   DEFAULT '',
  p_bags           NUMERIC DEFAULT 0,
  p_pairs_per_bag  NUMERIC DEFAULT 100,
  p_notes          TEXT   DEFAULT '',
  p_production_date TEXT   DEFAULT (now()::date)::TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws    UUID;
  v_id    UUID;
  v_pairs NUMERIC := p_bags * p_pairs_per_bag;
  v_acode TEXT;
  v_ppc  NUMERIC := 24;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  SELECT code INTO v_acode FROM articles WHERE id = p_article_id;
  SELECT COALESCE(pairs_per_carton, 24) INTO v_ppc FROM settings WHERE workspace_id = v_ws;

  INSERT INTO production_entries (workspace_id, article_id, date, line, shift, operator,
    input_bags, pairs_per_bag, uppers_used, carton_type, pairs_per_carton, output_cartons, output_pairs,
    size, color, notes)
  VALUES (v_ws, p_article_id, p_production_date, '', '', '',
    p_bags, p_pairs_per_bag, v_pairs, v_ppc::TEXT, v_ppc, CEIL(v_pairs / v_ppc), v_pairs,
    p_size, p_color, p_notes)
  RETURNING id INTO v_id;

  -- Deduct raw stock (uppers consumed)
  INSERT INTO raw_stock (workspace_id, item, category_slug, article_code, pack_type, pairs_per_pack,
    quantity, unit, unit_price, total_pairs, amount, date, notes)
  VALUES (v_ws, COALESCE(NULLIF(p_article_name, ''), 'Uppers consumed — ' || v_acode), 'uppers', v_acode, 'bag', p_pairs_per_bag,
    -p_bags, 'bags', 0, -v_pairs, 0, p_production_date, p_notes);

  -- Add ready shoes
  INSERT INTO ready_shoes (workspace_id, article_id, carton_type, pairs_per_carton, cartons, pairs, source, date)
  VALUES (v_ws, p_article_id, v_ppc::TEXT, v_ppc, CEIL(v_pairs / v_ppc), v_pairs, 'production', p_production_date);

  PERFORM log_action('create', 'production_entries', v_id, jsonb_build_object('article', v_acode, 'pairs', v_pairs));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── record_purchase ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_purchase(
  p_supplier_id    UUID,
  p_supplier_name  TEXT   DEFAULT '',
  p_article_id     UUID   DEFAULT NULL,
  p_article_name   TEXT   DEFAULT '',
  p_size           TEXT   DEFAULT '',
  p_color          TEXT   DEFAULT '',
  p_quantity       NUMERIC DEFAULT 0,
  p_rate           NUMERIC DEFAULT 0,
  p_notes          TEXT   DEFAULT '',
  p_purchase_date  TEXT   DEFAULT (now()::date)::TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws   UUID;
  v_id   UUID;
  v_amt  NUMERIC := p_quantity * p_rate;
  v_sname TEXT;
  v_acode TEXT;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  SELECT name INTO v_sname FROM suppliers WHERE id = p_supplier_id;
  IF p_article_id IS NOT NULL THEN
    SELECT code INTO v_acode FROM articles WHERE id = p_article_id;
  END IF;

  INSERT INTO purchases (workspace_id, supplier_id, item, category_slug, article_code, article_id,
    size, color, quantity, unit_price, amount, date, notes)
  VALUES (v_ws, p_supplier_id, COALESCE(NULLIF(p_article_name, ''), 'Purchase'), 'uppers',
    COALESCE(v_acode, ''), p_article_id, p_size, p_color, p_quantity, p_rate, v_amt, p_purchase_date, p_notes)
  RETURNING id INTO v_id;

  -- Add raw stock
  INSERT INTO raw_stock (workspace_id, item, category_slug, article_code, pack_type, pairs_per_pack,
    quantity, unit, unit_price, total_pairs, amount, supplier_id, date, notes)
  VALUES (v_ws, COALESCE(NULLIF(p_article_name, ''), 'Purchase'), 'uppers', COALESCE(v_acode, ''), 'bag', 0,
    p_quantity, 'pieces', p_rate, 0, v_amt, p_supplier_id, p_purchase_date, p_notes);

  -- Update supplier payable
  UPDATE suppliers SET balance = balance + v_amt WHERE id = p_supplier_id;

  PERFORM log_action('create', 'purchases', v_id, jsonb_build_object('item', p_article_name, 'amount', v_amt));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── record_payment ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_payment(
  p_payment_type  TEXT,
  p_party_id      UUID,
  p_person_name   TEXT   DEFAULT '',
  p_amount        NUMERIC DEFAULT 0,
  p_details       TEXT   DEFAULT '',
  p_payment_date  TEXT   DEFAULT (now()::date)::TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws   UUID;
  v_id   UUID;
  v_pname TEXT;
  v_rtype TEXT;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  IF p_payment_type = 'customer' THEN
    SELECT name INTO v_pname FROM customers WHERE id = p_party_id;
    v_rtype := 'cash_in';
    UPDATE customers SET balance = balance - p_amount WHERE id = p_party_id;
  ELSE
    SELECT name INTO v_pname FROM suppliers WHERE id = p_party_id;
    v_rtype := 'cash_out';
    UPDATE suppliers SET balance = balance - p_amount WHERE id = p_party_id;
  END IF;

  v_pname := COALESCE(NULLIF(p_person_name, ''), v_pname);

  INSERT INTO payments (workspace_id, party_type, party_id, party_name, amount, method, date, description, reference)
  VALUES (v_ws, p_payment_type, p_party_id, v_pname, p_amount, 'cash', p_payment_date, p_details, '')
  RETURNING id INTO v_id;

  INSERT INTO roznamcha (workspace_id, date, type, amount, description, reference_type, reference_id)
  VALUES (v_ws, p_payment_date, v_rtype, p_amount,
    CASE WHEN p_payment_type = 'customer' THEN 'Customer payment — ' ELSE 'Supplier payment — ' END || v_pname,
    'payment', v_id);

  PERFORM log_action('create', 'payments', v_id, jsonb_build_object('party', v_pname, 'amount', p_amount));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── record_kharcha ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_kharcha(
  p_title       TEXT,
  p_details     TEXT   DEFAULT '',
  p_amount      NUMERIC DEFAULT 0,
  p_expense_date TEXT   DEFAULT (now()::date)::TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws UUID;
  v_id UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  INSERT INTO kharcha (workspace_id, category, amount, date, description, reference)
  VALUES (v_ws, p_title, p_amount, p_expense_date, p_details, '')
  RETURNING id INTO v_id;

  INSERT INTO roznamcha (workspace_id, date, type, amount, description, reference_type, reference_id)
  VALUES (v_ws, p_expense_date, 'cash_out', p_amount,
    'Expense — ' || p_title || ': ' || p_details, 'kharcha', v_id);

  PERFORM log_action('create', 'kharcha', v_id, jsonb_build_object('category', p_title, 'amount', p_amount));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── get_customer_ledger (renamed param) ────────────────────────────────
CREATE OR REPLACE FUNCTION get_customer_ledger(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_opening NUMERIC;
  v_bal NUMERIC;
  v_lines JSON;
BEGIN
  SELECT opening_balance INTO v_opening FROM customers WHERE id = p_customer_id;

  WITH entries AS (
    SELECT date, description, debit, credit, created_at FROM (
      SELECT date, 'Invoice ' || invoice_no AS description, total AS debit, 0::NUMERIC AS credit, created_at
      FROM invoices WHERE customer_id = p_customer_id AND is_deleted = false
      UNION ALL
      SELECT date, COALESCE(description, 'Payment'), 0::NUMERIC AS debit, amount AS credit, created_at
      FROM payments WHERE party_id = p_customer_id AND party_type = 'customer' AND is_deleted = false
    ) e ORDER BY date, created_at
  ),
  wb AS (
    SELECT *, SUM(debit - credit) OVER (ORDER BY date, created_at) + v_opening AS balance FROM entries
  )
  SELECT COALESCE(SUM(debit - credit), 0) + v_opening INTO v_bal FROM wb;

  SELECT COALESCE(json_agg(json_build_object(
    'date', date, 'description', description, 'debit', debit, 'credit', credit, 'balance', balance
  )), '[]') INTO v_lines FROM wb;

  RETURN json_build_object('opening_balance', v_opening, 'balance', v_bal, 'lines', v_lines);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── get_supplier_ledger (renamed param) ────────────────────────────────
CREATE OR REPLACE FUNCTION get_supplier_ledger(p_supplier_id UUID)
RETURNS JSON AS $$
DECLARE
  v_opening NUMERIC;
  v_bal NUMERIC;
  v_lines JSON;
BEGIN
  SELECT opening_balance INTO v_opening FROM suppliers WHERE id = p_supplier_id;

  WITH entries AS (
    SELECT date, description, debit, credit, created_at FROM (
      SELECT date, COALESCE(description, 'Payment'), amount AS debit, 0::NUMERIC AS credit, created_at
      FROM payments WHERE party_id = p_supplier_id AND party_type = 'supplier' AND is_deleted = false
      UNION ALL
      SELECT date, item AS description, 0::NUMERIC AS debit, amount AS credit, created_at
      FROM purchases WHERE supplier_id = p_supplier_id AND is_deleted = false
    ) e ORDER BY date, created_at
  ),
  wb AS (
    SELECT *, SUM(credit - debit) OVER (ORDER BY date, created_at) + v_opening AS balance FROM entries
  )
  SELECT COALESCE(SUM(credit - debit), 0) + v_opening INTO v_bal FROM wb;

  SELECT COALESCE(json_agg(json_build_object(
    'date', date, 'description', description, 'debit', debit, 'credit', credit, 'balance', balance
  )), '[]') INTO v_lines FROM wb;

  RETURN json_build_object('opening_balance', v_opening, 'balance', v_bal, 'lines', v_lines);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── record_labour_payment ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_labour_payment(
  p_labour_id    UUID,
  p_amount       NUMERIC DEFAULT 0,
  p_payment_type TEXT   DEFAULT 'payment',
  p_date         TEXT   DEFAULT (now()::date)::TEXT,
  p_description  TEXT   DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  v_ws   UUID;
  v_id   UUID;
  v_lname TEXT;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  SELECT name INTO v_lname FROM labour WHERE id = p_labour_id;

  INSERT INTO labour_payments (workspace_id, labour_id, amount, payment_type, date, description)
  VALUES (v_ws, p_labour_id, p_amount, p_payment_type, p_date, p_description)
  RETURNING id INTO v_id;

  INSERT INTO roznamcha (workspace_id, date, type, amount, description, reference_type, reference_id)
  VALUES (v_ws, p_date, 'cash_out', p_amount,
    'Labour ' || p_payment_type || ' — ' || v_lname, 'labour', v_id);

  PERFORM log_action('create', 'labour_payments', v_id, jsonb_build_object('labour', v_lname, 'amount', p_amount));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── get_labour_balance ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_labour_balance(p_labour_id UUID)
RETURNS JSON AS $$
DECLARE
  v_rate   NUMERIC;
  v_paid   NUMERIC;
  v_adv    NUMERIC;
  v_bal    NUMERIC;
  v_lines  JSON;
BEGIN
  SELECT rate INTO v_rate FROM labour WHERE id = p_labour_id;

  WITH entries AS (
    SELECT date, description, debit, credit, created_at FROM (
      SELECT date, COALESCE(description, 'Advance') AS description, 0::NUMERIC AS debit, amount AS credit, created_at
      FROM labour_payments WHERE labour_id = p_labour_id AND payment_type = 'advance' AND is_deleted = false
      UNION ALL
      SELECT date, COALESCE(description, 'Payment') AS description, amount AS debit, 0::NUMERIC AS credit, created_at
      FROM labour_payments WHERE labour_id = p_labour_id AND payment_type = 'payment' AND is_deleted = false
    ) e ORDER BY date, created_at
  ),
  wb AS (
    SELECT *, SUM(credit - debit) OVER (ORDER BY date, created_at) AS balance FROM entries
  )
  SELECT COALESCE(SUM(credit), 0) INTO v_adv FROM wb;
  SELECT COALESCE(SUM(debit), 0) INTO v_paid FROM wb;
  v_bal := v_adv - v_paid;

  SELECT COALESCE(json_agg(json_build_object(
    'date', date, 'description', description, 'debit', debit, 'credit', credit, 'balance', balance
  )), '[]') INTO v_lines FROM wb;

  RETURN json_build_object('rate', v_rate, 'total_advance', v_adv, 'total_paid', v_paid, 'balance', v_bal, 'lines', v_lines);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Updated dashboard with article count + purchases + labour ──────────
CREATE OR REPLACE FUNCTION get_dashboard()
RETURNS JSON AS $$
DECLARE
  v_ws UUID;
BEGIN
  v_ws := current_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace'; END IF;

  RETURN json_build_object(
    'article_count', (SELECT COUNT(*) FROM articles WHERE workspace_id = v_ws AND is_deleted = false),
    'sales_invoiced', (SELECT COALESCE(SUM(total),0) FROM invoices WHERE workspace_id = v_ws AND is_deleted = false),
    'invoice_count', (SELECT COUNT(*) FROM invoices WHERE workspace_id = v_ws AND is_deleted = false),
    'pairs_sold', (SELECT COALESCE(SUM(pairs),0) FROM invoice_lines WHERE workspace_id = v_ws AND is_deleted = false),
    'production_recent', (SELECT COALESCE(SUM(output_pairs),0) FROM production_entries WHERE workspace_id = v_ws AND is_deleted = false AND date >= (now() - interval '30 days')::date::TEXT),
    'production_pairs', (SELECT COALESCE(SUM(output_pairs),0) FROM production_entries WHERE workspace_id = v_ws AND is_deleted = false),
    'ready_pairs', (SELECT COALESCE(SUM(pairs),0) FROM ready_shoes WHERE workspace_id = v_ws AND is_deleted = false),
    'uppers_pairs', (SELECT COALESCE(SUM(total_pairs),0) FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false AND category_slug = 'uppers'),
    'stock_value', (SELECT COALESCE(SUM(amount),0) FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false),
    'purchase_total', (SELECT COALESCE(SUM(amount),0) FROM purchases WHERE workspace_id = v_ws AND is_deleted = false),
    'receivables', (SELECT COALESCE(SUM(balance),0) FROM customers WHERE workspace_id = v_ws AND is_deleted = false),
    'payables', (SELECT COALESCE(SUM(balance),0) FROM suppliers WHERE workspace_id = v_ws AND is_deleted = false),
    'cash_in', (SELECT COALESCE(SUM(amount),0) FROM roznamcha WHERE workspace_id = v_ws AND type = 'cash_in' AND is_deleted = false),
    'cash_out', (SELECT COALESCE(SUM(amount),0) FROM roznamcha WHERE workspace_id = v_ws AND type = 'cash_out' AND is_deleted = false),
    'cash', (SELECT COALESCE(SUM(CASE WHEN type='cash_in' THEN amount ELSE -amount END),0) FROM roznamcha WHERE workspace_id = v_ws AND is_deleted = false),
    'labour_count', (SELECT COUNT(*) FROM labour WHERE workspace_id = v_ws AND is_deleted = false AND is_active = true),
    'labour_paid', (SELECT COALESCE(SUM(amount),0) FROM labour_payments WHERE workspace_id = v_ws AND payment_type = 'payment' AND is_deleted = false),
    'low_stock', (SELECT COALESCE(SUM(total_pairs),0) FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false AND category_slug = 'uppers') < 500,
    'recent_stock', COALESCE((SELECT json_agg(json_build_object('item', item, 'description', notes, 'date', date, 'direction', CASE WHEN total_pairs >= 0 THEN 'in' ELSE 'out' END, 'quantity', total_pairs)) FROM (SELECT * FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false ORDER BY created_at DESC LIMIT 8) t), '[]'),
    'recent_production', COALESCE((SELECT json_agg(json_build_object('article_code', a.code, 'article_name', a.name, 'date', p.date, 'operator', p.operator, 'output_pairs', p.output_pairs)) FROM (SELECT * FROM production_entries WHERE workspace_id = v_ws AND is_deleted = false ORDER BY created_at DESC LIMIT 8) p JOIN articles a ON a.id = p.article_id), '[]'),
    'recent_sales', COALESCE((SELECT json_agg(json_build_object('invoice_no', i.invoice_no, 'customer_name', c.name, 'date', i.date, 'total', i.total, 'status', i.status)) FROM (SELECT * FROM invoices WHERE workspace_id = v_ws AND is_deleted = false ORDER BY created_at DESC LIMIT 8) i JOIN customers c ON c.id = i.customer_id), '[]'),
    'article_ready', COALESCE((SELECT json_agg(json_build_object('code', a.code, 'name', a.name, 'category', a.category, 'ready_pairs', r.ready_pairs)) FROM (SELECT article_id, SUM(pairs) AS ready_pairs FROM ready_shoes WHERE workspace_id = v_ws AND is_deleted = false GROUP BY article_id HAVING SUM(pairs) > 0) r JOIN articles a ON a.id = r.article_id), '[]')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Updated recycle bin to include labour ──────────────────────────────
CREATE OR REPLACE FUNCTION get_recycle_bin()
RETURNS JSON AS $$
DECLARE
  v_ws UUID;
BEGIN
  v_ws := current_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace'; END IF;
  RETURN json_build_object(
    'articles', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', code || ' — ' || name, 'deleted_date', deleted_date)) FROM articles WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'raw_stock', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', item, 'deleted_date', deleted_date)) FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'ready_shoes', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', 'Ready shoes entry', 'deleted_date', deleted_date)) FROM ready_shoes WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'production_entries', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', 'Production entry', 'deleted_date', deleted_date)) FROM production_entries WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'purchases', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', item, 'deleted_date', deleted_date)) FROM purchases WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'customers', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', name, 'deleted_date', deleted_date)) FROM customers WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'suppliers', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', name, 'deleted_date', deleted_date)) FROM suppliers WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'invoices', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', invoice_no, 'deleted_date', deleted_date)) FROM invoices WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'payments', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', party_name || ' — ' || amount, 'deleted_date', deleted_date)) FROM payments WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'kharcha', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', category || ' — ' || description, 'deleted_date', deleted_date)) FROM kharcha WHERE workspace_id = v_ws AND is_deleted = true), '[]'),
    'labour', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', name, 'deleted_date', deleted_date)) FROM labour WHERE workspace_id = v_ws AND is_deleted = true), '[]')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Re-grant on new tables + functions ─────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON labour, labour_payments TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ── PIN functions: use auth.uid() instead of p_user_id parameter ────────
-- Ensure pgcrypto is available and search_path includes public for anon role
ALTER ROLE anon IN DATABASE postgres SET search_path TO auth, public, extensions;
ALTER ROLE authenticated IN DATABASE postgres SET search_path TO auth, public, extensions;

CREATE OR REPLACE FUNCTION setup_pin(p_pin TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) WHERE id = auth.uid();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_pin(p_pin TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND pin_hash IS NOT NULL
      AND pin_hash = extensions.crypt(p_pin, pin_hash)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION change_pin(p_old_pin TEXT, p_new_pin TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND pin_hash = extensions.crypt(p_old_pin, pin_hash)
  ) THEN
    RAISE EXCEPTION 'Old PIN is incorrect';
  END IF;
  UPDATE profiles SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf')) WHERE id = auth.uid();
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
