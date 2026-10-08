-- ============================================================================
-- HIKER+ Shoes Factory ERP — Initial Schema Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================================

-- Extensions (supabase/postgres image installs pgcrypto in "extensions" schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS extensions;

-- Ensure anon/authenticated roles can find extension functions (pgcrypto lives in extensions schema)
ALTER ROLE anon IN DATABASE postgres SET search_path TO auth, public, extensions;
ALTER ROLE authenticated IN DATABASE postgres SET search_path TO auth, public, extensions;

-- auth.uid() — used by RLS policies (Supabase provides this; define for self-hosted)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::JSON ->> 'sub',
    ''
  )::UUID;
$$ LANGUAGE SQL STABLE;

-- Roles for PostgREST (anon + authenticated)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT 'My Factory',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT,
  pin_hash    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  company_name    TEXT DEFAULT 'HIKER+ Shoes Factory',
  tagline         TEXT DEFAULT 'SHOES FACTORY',
  address         TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  email           TEXT DEFAULT '',
  bank_name       TEXT DEFAULT '',
  account_title   TEXT DEFAULT '',
  account_no      TEXT DEFAULT '',
  iban            TEXT DEFAULT '',
  footer_note     TEXT DEFAULT 'Goods once sold are not returnable.',
  currency        TEXT DEFAULT 'Rs',
  pairs_per_carton INTEGER DEFAULT 24,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code          TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL,
  category      TEXT DEFAULT '',
  sizes         TEXT DEFAULT '',
  colors        TEXT DEFAULT '',
  upper_type    TEXT DEFAULT '',
  sole_type     TEXT DEFAULT '',
  cost_price    NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','discontinued')),
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_stock (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item          TEXT NOT NULL,
  category_slug TEXT DEFAULT 'other',
  article_code  TEXT DEFAULT '',
  pack_type     TEXT DEFAULT '',
  pairs_per_pack NUMERIC DEFAULT 0,
  quantity      NUMERIC DEFAULT 0,
  unit          TEXT DEFAULT 'pairs',
  unit_price    NUMERIC DEFAULT 0,
  total_pairs   NUMERIC DEFAULT 0,
  amount        NUMERIC DEFAULT 0,
  supplier_id   UUID,
  date          TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  notes         TEXT DEFAULT '',
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ready_shoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  article_id       UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  carton_type      TEXT DEFAULT '24',
  pairs_per_carton NUMERIC DEFAULT 24,
  cartons          NUMERIC DEFAULT 0,
  pairs            NUMERIC DEFAULT 0,
  source           TEXT DEFAULT 'manual' CHECK (source IN ('manual','production','sale')),
  date             TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  is_deleted       BOOLEAN DEFAULT false,
  deleted_date     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  article_id       UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  date             TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  line             TEXT DEFAULT '',
  shift            TEXT DEFAULT '',
  operator         TEXT DEFAULT '',
  input_bags       NUMERIC DEFAULT 0,
  pairs_per_bag    NUMERIC DEFAULT 100,
  uppers_used      NUMERIC DEFAULT 0,
  carton_type      TEXT DEFAULT '24',
  pairs_per_carton NUMERIC DEFAULT 24,
  output_cartons   NUMERIC DEFAULT 0,
  output_pairs     NUMERIC DEFAULT 0,
  is_deleted       BOOLEAN DEFAULT false,
  deleted_date     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL,
  item          TEXT NOT NULL,
  category_slug TEXT DEFAULT 'uppers',
  article_code  TEXT DEFAULT '',
  pack_type     TEXT DEFAULT 'bag',
  pairs_per_pack NUMERIC DEFAULT 0,
  quantity      NUMERIC DEFAULT 0,
  unit          TEXT DEFAULT 'bags',
  unit_price    NUMERIC DEFAULT 0,
  total_pairs   NUMERIC DEFAULT 0,
  amount        NUMERIC DEFAULT 0,
  date          TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT DEFAULT '',
  address         TEXT DEFAULT '',
  city            TEXT DEFAULT '',
  product_details TEXT DEFAULT '',
  opening_balance NUMERIC DEFAULT 0,
  balance         NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  is_deleted      BOOLEAN DEFAULT false,
  deleted_date    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT DEFAULT '',
  address         TEXT DEFAULT '',
  city            TEXT DEFAULT '',
  product_details TEXT DEFAULT '',
  opening_balance NUMERIC DEFAULT 0,
  balance         NUMERIC DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  is_deleted      BOOLEAN DEFAULT false,
  deleted_date    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_no    TEXT NOT NULL,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  date          TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  subtotal      NUMERIC DEFAULT 0,
  discount      NUMERIC DEFAULT 0,
  total         NUMERIC DEFAULT 0,
  received      NUMERIC DEFAULT 0,
  balance       NUMERIC DEFAULT 0,
  status        TEXT DEFAULT 'unpaid' CHECK (status IN ('paid','partial','unpaid')),
  payment_method TEXT DEFAULT 'cash',
  notes         TEXT DEFAULT '',
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  article_id       UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  article_code     TEXT DEFAULT '',
  article_name     TEXT DEFAULT '',
  size             TEXT DEFAULT '',
  color            TEXT DEFAULT '',
  pairs_per_carton NUMERIC DEFAULT 24,
  cartons          NUMERIC DEFAULT 0,
  pairs            NUMERIC DEFAULT 0,
  rate             NUMERIC DEFAULT 0,
  amount           NUMERIC DEFAULT 0,
  date             TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  is_deleted       BOOLEAN DEFAULT false,
  deleted_date     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  party_type    TEXT NOT NULL CHECK (party_type IN ('customer','supplier')),
  party_id      UUID,
  party_name    TEXT DEFAULT '',
  amount        NUMERIC DEFAULT 0,
  method        TEXT DEFAULT 'cash',
  date          TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  description   TEXT DEFAULT '',
  reference     TEXT DEFAULT '',
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roznamcha (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date          TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  type          TEXT NOT NULL CHECK (type IN ('cash_in','cash_out')),
  amount        NUMERIC DEFAULT 0,
  description   TEXT DEFAULT '',
  reference_type TEXT DEFAULT '',
  reference_id  UUID,
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kharcha (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date          TEXT NOT NULL DEFAULT (now()::date)::TEXT,
  category      TEXT DEFAULT 'general',
  amount        NUMERIC DEFAULT 0,
  description   TEXT DEFAULT '',
  reference     TEXT DEFAULT '',
  is_deleted    BOOLEAN DEFAULT false,
  deleted_date  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  table_name    TEXT DEFAULT '',
  record_id     UUID,
  details       JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_articles_ws ON articles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_raw_stock_ws ON raw_stock(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ready_shoes_ws ON ready_shoes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ready_shoes_article ON ready_shoes(article_id);
CREATE INDEX IF NOT EXISTS idx_production_ws ON production_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_purchases_ws ON purchases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_customers_ws ON customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_ws ON suppliers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_ws ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_ws ON invoice_lines(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_inv ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_ws ON payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_roznamcha_ws ON roznamcha(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kharcha_ws ON kharcha(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_ws ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_ws ON workspace_members(workspace_id);

-- ============================================================================
-- HELPER FUNCTIONS (RLS context)
-- ============================================================================

CREATE OR REPLACE FUNCTION current_workspace_id()
RETURNS UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create profile + workspace for first user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_ws UUID;
  v_count INTEGER;
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO v_count FROM workspaces;
  IF v_count = 0 THEN
    INSERT INTO workspaces (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'name','My Factory'))
    RETURNING id INTO v_ws;
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_ws, NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    SELECT id INTO v_ws FROM workspaces ORDER BY created_at LIMIT 1;
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_ws, NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-create settings for new workspace
CREATE OR REPLACE FUNCTION create_default_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings (workspace_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS workspaces_create_settings ON workspaces;
CREATE TRIGGER workspaces_create_settings
  AFTER INSERT ON workspaces FOR EACH ROW EXECUTE FUNCTION create_default_settings();

-- Auto-generate article code
CREATE OR REPLACE FUNCTION generate_article_code()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM articles WHERE workspace_id = NEW.workspace_id;
    NEW.code := 'HSF-' || lpad(v_count::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS articles_gen_code ON articles;
CREATE TRIGGER articles_gen_code
  BEFORE INSERT ON articles FOR EACH ROW EXECUTE FUNCTION generate_article_code();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','workspace_members','settings','articles','raw_stock','ready_shoes','production_entries','purchases','customers','suppliers','invoices','payments','kharcha'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- ============================================================================
-- RLS — Enable on all tables
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE ready_shoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roznamcha ENABLE ROW LEVEL SECURITY;
ALTER TABLE kharcha ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/update their own
CREATE POLICY profiles_sel ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_upd ON profiles FOR UPDATE USING (id = auth.uid());

-- Workspace members: visible within workspace, admin-managed
CREATE POLICY wm_sel ON workspace_members FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY wm_ins ON workspace_members FOR INSERT WITH CHECK (workspace_id = current_workspace_id() AND current_user_role() = 'admin');
CREATE POLICY wm_upd ON workspace_members FOR UPDATE USING (workspace_id = current_workspace_id() AND current_user_role() = 'admin');
CREATE POLICY wm_del ON workspace_members FOR DELETE USING (workspace_id = current_workspace_id() AND current_user_role() = 'admin');

-- Settings: visible within workspace, admin can update
CREATE POLICY settings_sel ON settings FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY settings_upd ON settings FOR UPDATE USING (workspace_id = current_workspace_id() AND current_user_role() = 'admin');

-- Generic business-table policies (workspace isolation)
-- Articles
CREATE POLICY art_sel ON articles FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY art_ins ON articles FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY art_upd ON articles FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY art_del ON articles FOR DELETE USING (workspace_id = current_workspace_id());

-- Raw stock
CREATE POLICY rs_sel ON raw_stock FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY rs_ins ON raw_stock FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY rs_upd ON raw_stock FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY rs_del ON raw_stock FOR DELETE USING (workspace_id = current_workspace_id());

-- Ready shoes
CREATE POLICY rsh_sel ON ready_shoes FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY rsh_ins ON ready_shoes FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY rsh_upd ON ready_shoes FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY rsh_del ON ready_shoes FOR DELETE USING (workspace_id = current_workspace_id());

-- Production
CREATE POLICY prod_sel ON production_entries FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY prod_ins ON production_entries FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY prod_upd ON production_entries FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY prod_del ON production_entries FOR DELETE USING (workspace_id = current_workspace_id());

-- Purchases
CREATE POLICY pur_sel ON purchases FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY pur_ins ON purchases FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY pur_upd ON purchases FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY pur_del ON purchases FOR DELETE USING (workspace_id = current_workspace_id());

-- Customers
CREATE POLICY cust_sel ON customers FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY cust_ins ON customers FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY cust_upd ON customers FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY cust_del ON customers FOR DELETE USING (workspace_id = current_workspace_id());

-- Suppliers
CREATE POLICY sup_sel ON suppliers FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY sup_ins ON suppliers FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY sup_upd ON suppliers FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY sup_del ON suppliers FOR DELETE USING (workspace_id = current_workspace_id());

-- Invoices
CREATE POLICY inv_sel ON invoices FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY inv_ins ON invoices FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY inv_upd ON invoices FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY inv_del ON invoices FOR DELETE USING (workspace_id = current_workspace_id());

-- Invoice lines
CREATE POLICY il_sel ON invoice_lines FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY il_ins ON invoice_lines FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY il_upd ON invoice_lines FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY il_del ON invoice_lines FOR DELETE USING (workspace_id = current_workspace_id());

-- Payments
CREATE POLICY pay_sel ON payments FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY pay_ins ON payments FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY pay_upd ON payments FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY pay_del ON payments FOR DELETE USING (workspace_id = current_workspace_id());

-- Roznamcha
CREATE POLICY roz_sel ON roznamcha FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY roz_ins ON roznamcha FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY roz_upd ON roznamcha FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY roz_del ON roznamcha FOR DELETE USING (workspace_id = current_workspace_id());

-- Kharcha
CREATE POLICY kh_sel ON kharcha FOR SELECT USING (workspace_id = current_workspace_id());
CREATE POLICY kh_ins ON kharcha FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY kh_upd ON kharcha FOR UPDATE USING (workspace_id = current_workspace_id()) WITH CHECK (workspace_id = current_workspace_id());
CREATE POLICY kh_del ON kharcha FOR DELETE USING (workspace_id = current_workspace_id());

-- Audit logs: read-only within workspace (writes only via SECURITY DEFINER functions)
CREATE POLICY aud_sel ON audit_logs FOR SELECT USING (workspace_id = current_workspace_id());

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- PIN management
CREATE OR REPLACE FUNCTION setup_pin(p_user_id UUID, p_pin TEXT)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_pin(p_user_id UUID, p_pin TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND pin_hash IS NOT NULL
      AND pin_hash = extensions.crypt(p_pin, pin_hash)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION change_pin(p_user_id UUID, p_old_pin TEXT, p_new_pin TEXT)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND pin_hash = extensions.crypt(p_old_pin, pin_hash)
  ) THEN
    RAISE EXCEPTION 'Old PIN is incorrect';
  END IF;
  UPDATE profiles SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf')) WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit helper
CREATE OR REPLACE FUNCTION log_action(p_action TEXT, p_table TEXT, p_record_id UUID, p_details JSONB DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (workspace_id, user_id, action, table_name, record_id, details)
  VALUES (current_workspace_id(), auth.uid(), p_action, p_table, p_record_id, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create invoice (atomic: number, lines, stock deduction, customer ledger, payment, roznamcha)
CREATE OR REPLACE FUNCTION create_invoice(
  p_customer_id UUID,
  p_date TEXT,
  p_lines JSONB,
  p_discount NUMERIC DEFAULT 0,
  p_received NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash',
  p_notes TEXT DEFAULT ''
)
RETURNS UUID AS $$
DECLARE
  v_ws UUID;
  v_no TEXT;
  v_id UUID;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC;
  v_balance NUMERIC;
  v_line JSONB;
  v_aid UUID;
  v_pairs NUMERIC;
  v_amt NUMERIC;
  v_avail NUMERIC;
  v_acode TEXT;
  v_aname TEXT;
  v_cname TEXT;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE;
  SELECT COALESCE(MAX(invoice_no::INTEGER), 99) + 1 INTO v_no
  FROM invoices WHERE workspace_id = v_ws AND invoice_no ~ '^[0-9]+$';

  -- Calculate subtotal and validate stock
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_aid := (v_line->>'article_id')::UUID;
    v_pairs := ((v_line->>'pairs_per_carton')::NUMERIC) * ((v_line->>'cartons')::NUMERIC);
    v_amt := v_pairs * ((v_line->>'rate')::NUMERIC);
    v_subtotal := v_subtotal + v_amt;

    SELECT COALESCE(SUM(pairs), 0) INTO v_avail
    FROM ready_shoes WHERE workspace_id = v_ws AND article_id = v_aid AND is_deleted = false;
    IF v_avail < v_pairs THEN
      SELECT code INTO v_acode FROM articles WHERE id = v_aid;
      RAISE EXCEPTION 'Insufficient ready stock for %: have %, need %', v_acode, v_avail, v_pairs;
    END IF;
  END LOOP;

  v_total := GREATEST(v_subtotal - p_discount, 0);
  v_balance := v_total - LEAST(p_received, v_total);

  SELECT name INTO v_cname FROM customers WHERE id = p_customer_id;

  INSERT INTO invoices (workspace_id, invoice_no, customer_id, date, subtotal, discount, total, received, balance, status, payment_method, notes)
  VALUES (v_ws, v_no::TEXT, p_customer_id, p_date, v_subtotal, p_discount, v_total, p_received, v_balance,
    CASE WHEN v_balance <= 0 THEN 'paid' WHEN p_received > 0 THEN 'partial' ELSE 'unpaid' END,
    p_payment_method, p_notes)
  RETURNING id INTO v_id;

  -- Insert lines + deduct stock
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_aid := (v_line->>'article_id')::UUID;
    v_pairs := ((v_line->>'pairs_per_carton')::NUMERIC) * ((v_line->>'cartons')::NUMERIC);
    v_amt := v_pairs * ((v_line->>'rate')::NUMERIC);
    SELECT code, name INTO v_acode, v_aname FROM articles WHERE id = v_aid;

    INSERT INTO invoice_lines (workspace_id, invoice_id, article_id, article_code, article_name, size, color,
      pairs_per_carton, cartons, pairs, rate, amount, date)
    VALUES (v_ws, v_id, v_aid, v_acode, v_aname, v_line->>'size', v_line->>'color',
      (v_line->>'pairs_per_carton')::NUMERIC, (v_line->>'cartons')::NUMERIC, v_pairs, (v_line->>'rate')::NUMERIC, v_amt, p_date);

    INSERT INTO ready_shoes (workspace_id, article_id, carton_type, pairs_per_carton, cartons, pairs, source, date)
    VALUES (v_ws, v_aid, (v_line->>'pairs_per_carton')::TEXT, (v_line->>'pairs_per_carton')::NUMERIC,
      (v_line->>'cartons')::NUMERIC, -v_pairs, 'sale', p_date);
  END LOOP;

  -- Update customer receivable
  UPDATE customers SET balance = balance + v_balance WHERE id = p_customer_id;

  -- Payment received at invoice time
  IF p_received > 0 THEN
    INSERT INTO payments (workspace_id, party_type, party_id, party_name, amount, method, date, description, reference)
    VALUES (v_ws, 'customer', p_customer_id, v_cname, p_received, p_payment_method, p_date,
      'Payment for invoice ' || v_no, v_no::TEXT);

    INSERT INTO roznamcha (workspace_id, date, type, amount, description, reference_type, reference_id)
    VALUES (v_ws, p_date, 'cash_in', p_received, 'Invoice payment — ' || v_cname, 'invoice', v_id);
  END IF;

  PERFORM log_action('create', 'invoices', v_id, jsonb_build_object('invoice_no', v_no, 'total', v_total));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record production (atomic: entry, raw stock deduction, ready shoes addition)
CREATE OR REPLACE FUNCTION record_production(
  p_article_id UUID,
  p_date TEXT,
  p_line TEXT,
  p_shift TEXT,
  p_operator TEXT,
  p_input_bags NUMERIC,
  p_pairs_per_bag NUMERIC,
  p_carton_type TEXT,
  p_pairs_per_carton NUMERIC,
  p_output_cartons NUMERIC
)
RETURNS UUID AS $$
DECLARE
  v_ws UUID;
  v_id UUID;
  v_uppers NUMERIC := p_input_bags * p_pairs_per_bag;
  v_out NUMERIC := p_output_cartons * p_pairs_per_carton;
  v_acode TEXT;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  SELECT code INTO v_acode FROM articles WHERE id = p_article_id;

  INSERT INTO production_entries (workspace_id, article_id, date, line, shift, operator,
    input_bags, pairs_per_bag, uppers_used, carton_type, pairs_per_carton, output_cartons, output_pairs)
  VALUES (v_ws, p_article_id, p_date, p_line, p_shift, p_operator,
    p_input_bags, p_pairs_per_bag, v_uppers, p_carton_type, p_pairs_per_carton, p_output_cartons, v_out)
  RETURNING id INTO v_id;

  -- Deduct raw stock (uppers consumed)
  INSERT INTO raw_stock (workspace_id, item, category_slug, article_code, pack_type, pairs_per_pack,
    quantity, unit, unit_price, total_pairs, amount, date, notes)
  VALUES (v_ws, 'Uppers consumed — ' || v_acode, 'uppers', v_acode, 'bag', p_pairs_per_bag,
    -p_input_bags, 'bags', 0, -v_uppers, 0, p_date, 'Production entry');

  -- Add ready shoes
  INSERT INTO ready_shoes (workspace_id, article_id, carton_type, pairs_per_carton, cartons, pairs, source, date)
  VALUES (v_ws, p_article_id, p_carton_type, p_pairs_per_carton, p_output_cartons, v_out, 'production', p_date);

  PERFORM log_action('create', 'production_entries', v_id, jsonb_build_object('article', v_acode, 'pairs', v_out));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record purchase (atomic: entry, raw stock addition, supplier ledger)
CREATE OR REPLACE FUNCTION record_purchase(
  p_supplier_id UUID,
  p_item TEXT,
  p_category_slug TEXT,
  p_article_code TEXT,
  p_pack_type TEXT,
  p_pairs_per_pack NUMERIC,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_unit_price NUMERIC,
  p_date TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws UUID;
  v_id UUID;
  v_tp NUMERIC := p_pairs_per_pack * p_quantity;
  v_amt NUMERIC := p_quantity * p_unit_price;
  v_sname TEXT;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  SELECT name INTO v_sname FROM suppliers WHERE id = p_supplier_id;

  INSERT INTO purchases (workspace_id, supplier_id, item, category_slug, article_code, pack_type,
    pairs_per_pack, quantity, unit, unit_price, total_pairs, amount, date)
  VALUES (v_ws, p_supplier_id, p_item, p_category_slug, p_article_code, p_pack_type,
    p_pairs_per_pack, p_quantity, p_unit, p_unit_price, v_tp, v_amt, p_date)
  RETURNING id INTO v_id;

  -- Add raw stock
  INSERT INTO raw_stock (workspace_id, item, category_slug, article_code, pack_type, pairs_per_pack,
    quantity, unit, unit_price, total_pairs, amount, supplier_id, date, notes)
  VALUES (v_ws, p_item, p_category_slug, p_article_code, p_pack_type, p_pairs_per_pack,
    p_quantity, p_unit, p_unit_price, v_tp, v_amt, p_supplier_id, p_date, 'Purchase from ' || v_sname);

  -- Update supplier payable
  UPDATE suppliers SET balance = balance + v_amt WHERE id = p_supplier_id;

  PERFORM log_action('create', 'purchases', v_id, jsonb_build_object('item', p_item, 'amount', v_amt));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record payment (atomic: payment, party ledger, roznamcha)
CREATE OR REPLACE FUNCTION record_payment(
  p_party_type TEXT,
  p_party_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_date TEXT,
  p_description TEXT,
  p_reference TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws UUID;
  v_id UUID;
  v_pname TEXT;
  v_rtype TEXT;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  IF p_party_type = 'customer' THEN
    SELECT name INTO v_pname FROM customers WHERE id = p_party_id;
    v_rtype := 'cash_in';
    UPDATE customers SET balance = balance - p_amount WHERE id = p_party_id;
  ELSE
    SELECT name INTO v_pname FROM suppliers WHERE id = p_party_id;
    v_rtype := 'cash_out';
    UPDATE suppliers SET balance = balance - p_amount WHERE id = p_party_id;
  END IF;

  INSERT INTO payments (workspace_id, party_type, party_id, party_name, amount, method, date, description, reference)
  VALUES (v_ws, p_party_type, p_party_id, v_pname, p_amount, p_method, p_date,
    COALESCE(p_description, ''), COALESCE(p_reference, ''))
  RETURNING id INTO v_id;

  INSERT INTO roznamcha (workspace_id, date, type, amount, description, reference_type, reference_id)
  VALUES (v_ws, p_date, v_rtype, p_amount,
    CASE WHEN p_party_type = 'customer' THEN 'Customer payment — ' ELSE 'Supplier payment — ' END || v_pname,
    'payment', v_id);

  PERFORM log_action('create', 'payments', v_id, jsonb_build_object('party', v_pname, 'amount', p_amount));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record kharcha / expense (atomic: entry, roznamcha)
CREATE OR REPLACE FUNCTION record_kharcha(
  p_category TEXT,
  p_amount NUMERIC,
  p_date TEXT,
  p_description TEXT,
  p_reference TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ws UUID;
  v_id UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace found'; END IF;

  INSERT INTO kharcha (workspace_id, category, amount, date, description, reference)
  VALUES (v_ws, p_category, p_amount, p_date, COALESCE(p_description,''), COALESCE(p_reference,''))
  RETURNING id INTO v_id;

  INSERT INTO roznamcha (workspace_id, date, type, amount, description, reference_type, reference_id)
  VALUES (v_ws, p_date, 'cash_out', p_amount,
    'Expense — ' || p_category || ': ' || COALESCE(p_description,''), 'kharcha', v_id);

  PERFORM log_action('create', 'kharcha', v_id, jsonb_build_object('category', p_category, 'amount', p_amount));
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get cash balance
CREATE OR REPLACE FUNCTION get_cash_balance()
RETURNS JSON AS $$
DECLARE
  v_ws UUID;
  v_in NUMERIC;
  v_out NUMERIC;
BEGIN
  v_ws := current_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace'; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_in FROM roznamcha WHERE workspace_id = v_ws AND type = 'cash_in' AND is_deleted = false;
  SELECT COALESCE(SUM(amount),0) INTO v_out FROM roznamcha WHERE workspace_id = v_ws AND type = 'cash_out' AND is_deleted = false;
  RETURN json_build_object('cash_in', v_in, 'cash_out', v_out, 'balance', v_in - v_out);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get customer ledger (kata)
CREATE OR REPLACE FUNCTION get_customer_ledger(p_party_id UUID)
RETURNS JSON AS $$
DECLARE
  v_opening NUMERIC;
  v_bal NUMERIC;
  v_lines JSON;
BEGIN
  SELECT opening_balance INTO v_opening FROM customers WHERE id = p_party_id;

  WITH entries AS (
    SELECT date, description, debit, credit, created_at FROM (
      SELECT date, 'Invoice ' || invoice_no AS description, total AS debit, 0::NUMERIC AS credit, created_at
      FROM invoices WHERE customer_id = p_party_id AND is_deleted = false
      UNION ALL
      SELECT date, COALESCE(description, 'Payment'), 0::NUMERIC AS debit, amount AS credit, created_at
      FROM payments WHERE party_id = p_party_id AND party_type = 'customer' AND is_deleted = false
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

-- Get supplier ledger (kata)
CREATE OR REPLACE FUNCTION get_supplier_ledger(p_party_id UUID)
RETURNS JSON AS $$
DECLARE
  v_opening NUMERIC;
  v_bal NUMERIC;
  v_lines JSON;
BEGIN
  SELECT opening_balance INTO v_opening FROM suppliers WHERE id = p_party_id;

  WITH entries AS (
    SELECT date, description, debit, credit, created_at FROM (
      SELECT date, COALESCE(description, 'Payment'), amount AS debit, 0::NUMERIC AS credit, created_at
      FROM payments WHERE party_id = p_party_id AND party_type = 'supplier' AND is_deleted = false
      UNION ALL
      SELECT date, item AS description, 0::NUMERIC AS debit, amount AS credit, created_at
      FROM purchases WHERE supplier_id = p_party_id AND is_deleted = false
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

-- Dashboard
CREATE OR REPLACE FUNCTION get_dashboard()
RETURNS JSON AS $$
DECLARE
  v_ws UUID;
BEGIN
  v_ws := current_workspace_id();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'No workspace'; END IF;

  RETURN json_build_object(
    'sales_invoiced', (SELECT COALESCE(SUM(total),0) FROM invoices WHERE workspace_id = v_ws AND is_deleted = false),
    'invoice_count', (SELECT COUNT(*) FROM invoices WHERE workspace_id = v_ws AND is_deleted = false),
    'pairs_sold', (SELECT COALESCE(SUM(pairs),0) FROM invoice_lines WHERE workspace_id = v_ws AND is_deleted = false),
    'production_recent', (SELECT COALESCE(SUM(output_pairs),0) FROM production_entries WHERE workspace_id = v_ws AND is_deleted = false AND date >= (now() - interval '30 days')::date::TEXT),
    'production_pairs', (SELECT COALESCE(SUM(output_pairs),0) FROM production_entries WHERE workspace_id = v_ws AND is_deleted = false),
    'ready_pairs', (SELECT COALESCE(SUM(pairs),0) FROM ready_shoes WHERE workspace_id = v_ws AND is_deleted = false),
    'uppers_pairs', (SELECT COALESCE(SUM(total_pairs),0) FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false AND category_slug = 'uppers'),
    'stock_value', (SELECT COALESCE(SUM(amount),0) FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false),
    'receivables', (SELECT COALESCE(SUM(balance),0) FROM customers WHERE workspace_id = v_ws AND is_deleted = false),
    'payables', (SELECT COALESCE(SUM(balance),0) FROM suppliers WHERE workspace_id = v_ws AND is_deleted = false),
    'cash_in', (SELECT COALESCE(SUM(amount),0) FROM roznamcha WHERE workspace_id = v_ws AND type = 'cash_in' AND is_deleted = false),
    'cash_out', (SELECT COALESCE(SUM(amount),0) FROM roznamcha WHERE workspace_id = v_ws AND type = 'cash_out' AND is_deleted = false),
    'cash', (SELECT COALESCE(SUM(CASE WHEN type='cash_in' THEN amount ELSE -amount END),0) FROM roznamcha WHERE workspace_id = v_ws AND is_deleted = false),
    'low_stock', (SELECT COALESCE(SUM(total_pairs),0) FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false AND category_slug = 'uppers') < 500,
    'recent_stock', COALESCE((SELECT json_agg(json_build_object('item', item, 'description', notes, 'date', date, 'direction', CASE WHEN total_pairs >= 0 THEN 'in' ELSE 'out' END, 'quantity', total_pairs)) FROM (SELECT * FROM raw_stock WHERE workspace_id = v_ws AND is_deleted = false ORDER BY created_at DESC LIMIT 8) t), '[]'),
    'recent_production', COALESCE((SELECT json_agg(json_build_object('article_code', a.code, 'article_name', a.name, 'date', p.date, 'operator', p.operator, 'output_pairs', p.output_pairs)) FROM (SELECT * FROM production_entries WHERE workspace_id = v_ws AND is_deleted = false ORDER BY created_at DESC LIMIT 8) p JOIN articles a ON a.id = p.article_id), '[]'),
    'recent_sales', COALESCE((SELECT json_agg(json_build_object('invoice_no', i.invoice_no, 'customer_name', c.name, 'date', i.date, 'total', i.total, 'status', i.status)) FROM (SELECT * FROM invoices WHERE workspace_id = v_ws AND is_deleted = false ORDER BY created_at DESC LIMIT 8) i JOIN customers c ON c.id = i.customer_id), '[]'),
    'article_ready', COALESCE((SELECT json_agg(json_build_object('code', a.code, 'name', a.name, 'category', a.category, 'ready_pairs', r.ready_pairs)) FROM (SELECT article_id, SUM(pairs) AS ready_pairs FROM ready_shoes WHERE workspace_id = v_ws AND is_deleted = false GROUP BY article_id HAVING SUM(pairs) > 0) r JOIN articles a ON a.id = r.article_id), '[]')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recycle bin
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
    'kharcha', COALESCE((SELECT json_agg(json_build_object('id', id, 'label', category || ' — ' || description, 'deleted_date', deleted_date)) FROM kharcha WHERE workspace_id = v_ws AND is_deleted = true), '[]')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore record
CREATE OR REPLACE FUNCTION restore_record(p_table TEXT, p_id UUID)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET is_deleted = false, deleted_date = NULL WHERE id = $1 AND workspace_id = $2', p_table)
  USING p_id, current_workspace_id();
  PERFORM log_action('restore', p_table, p_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permanent delete (admin only)
CREATE OR REPLACE FUNCTION permanent_delete(p_table TEXT, p_id UUID)
RETURNS void AS $$
BEGIN
  IF current_user_role() != 'admin' THEN RAISE EXCEPTION 'Admin permission required'; END IF;
  EXECUTE format('DELETE FROM %I WHERE id = $1 AND workspace_id = $2', p_table)
  USING p_id, current_workspace_id();
  PERFORM log_action('permanent_delete', p_table, p_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add workspace member (admin only)
CREATE OR REPLACE FUNCTION add_workspace_member(p_email TEXT, p_role TEXT)
RETURNS UUID AS $$
DECLARE
  v_uid UUID;
  v_ws UUID;
BEGIN
  IF current_user_role() != 'admin' THEN RAISE EXCEPTION 'Admin permission required'; END IF;
  SELECT id INTO v_uid FROM profiles WHERE email = p_email;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found. They must sign up first.'; END IF;
  v_ws := current_workspace_id();
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_ws, v_uid, p_role) ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = p_role;
  PERFORM log_action('permission_change', 'workspace_members', v_uid, jsonb_build_object('email', p_email, 'role', p_role));
  RETURN v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove workspace member (admin only)
CREATE OR REPLACE FUNCTION remove_workspace_member(p_member_id UUID)
RETURNS void AS $$
BEGIN
  IF current_user_role() != 'admin' THEN RAISE EXCEPTION 'Admin permission required'; END IF;
  DELETE FROM workspace_members WHERE id = p_member_id AND workspace_id = current_workspace_id();
  PERFORM log_action('permission_change', 'workspace_members', p_member_id, jsonb_build_object('action', 'remove'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS (must come after all tables and functions are created)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
