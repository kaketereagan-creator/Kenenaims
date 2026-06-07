-- ============================================================
-- KENENA FARM MANAGEMENT SYSTEM (KFMS)
-- PostgreSQL Database Schema v1.0
-- Kenena Farm, Kihura Sub-county, Uganda
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS & ROLES
-- ============================================================

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,  -- super_admin, farm_manager, accountant, storekeeper, worker
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  phone VARCHAR(30),
  role_id INTEGER REFERENCES roles(id),
  password_hash TEXT NOT NULL,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  profile_photo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE user_permissions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  module VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 2. AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100),
  record_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. EMPLOYEES & PAYROLL
-- ============================================================

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  national_id VARCHAR(50),
  phone VARCHAR(30),
  email VARCHAR(200),
  position VARCHAR(100),
  department VARCHAR(100),
  salary_type VARCHAR(20) CHECK (salary_type IN ('daily','weekly','monthly')),
  salary_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  hire_date DATE,
  mobile_money_number VARCHAR(30),
  mobile_money_provider VARCHAR(50),
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  photo TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE attendance (
  id BIGSERIAL PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  hours_worked NUMERIC(5,2),
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('present','absent','half_day','leave','holiday')),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payroll_periods (
  id SERIAL PRIMARY KEY,
  period_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_date DATE,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id INTEGER REFERENCES payroll_periods(id),
  employee_id UUID REFERENCES employees(id),
  base_pay NUMERIC(14,2) DEFAULT 0,
  overtime_pay NUMERIC(14,2) DEFAULT 0,
  bonus NUMERIC(14,2) DEFAULT 0,
  advance_deduction NUMERIC(14,2) DEFAULT 0,
  other_deductions NUMERIC(14,2) DEFAULT 0,
  gross_pay NUMERIC(14,2) DEFAULT 0,
  net_pay NUMERIC(14,2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  payslip_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salary_advances (
  id SERIAL PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  amount NUMERIC(14,2) NOT NULL,
  reason TEXT,
  request_date DATE,
  approved_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  repayment_period_id INTEGER REFERENCES payroll_periods(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. LIVESTOCK - CORE (shared structure)
-- ============================================================

CREATE TABLE animal_species (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,  -- rabbit, pig, poultry, cattle
  id_prefix VARCHAR(10) NOT NULL,    -- RBT, PIG, PLT, CAT
  id_sequence INTEGER DEFAULT 0
);

CREATE TABLE breeds (
  id SERIAL PRIMARY KEY,
  species_id INTEGER REFERENCES animal_species(id),
  name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE housing_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_code VARCHAR(50) UNIQUE NOT NULL,
  unit_name VARCHAR(100) NOT NULL,
  species_id INTEGER REFERENCES animal_species(id),
  unit_type VARCHAR(50),  -- pen, house, kraal, hutch
  capacity INTEGER,
  location TEXT,
  qr_code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE animals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id VARCHAR(50) UNIQUE NOT NULL,  -- RBT-000001
  species_id INTEGER REFERENCES animal_species(id),
  breed_id INTEGER REFERENCES breeds(id),
  name VARCHAR(100),
  sex VARCHAR(10) CHECK (sex IN ('male','female','unknown')),
  date_of_birth DATE,
  estimated_dob BOOLEAN DEFAULT FALSE,
  housing_unit_id UUID REFERENCES housing_units(id),
  mother_id UUID REFERENCES animals(id),
  father_id UUID REFERENCES animals(id),
  current_weight NUMERIC(8,2),
  weight_unit VARCHAR(5) DEFAULT 'kg',
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','sold','dead','transferred')),
  photo TEXT,
  qr_code TEXT,
  source VARCHAR(50),  -- born_on_farm, purchased
  purchase_price NUMERIC(14,2),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE animal_weights (
  id BIGSERIAL PRIMARY KEY,
  animal_id UUID REFERENCES animals(id),
  weight NUMERIC(8,2) NOT NULL,
  weight_unit VARCHAR(5) DEFAULT 'kg',
  recorded_date DATE NOT NULL,
  recorded_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. VACCINATIONS & HEALTH
-- ============================================================

CREATE TABLE vaccines (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  species_id INTEGER REFERENCES animal_species(id),
  frequency_days INTEGER,
  description TEXT
);

CREATE TABLE vaccination_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id),
  vaccine_id INTEGER REFERENCES vaccines(id),
  date_given DATE NOT NULL,
  next_due_date DATE,
  given_by VARCHAR(100),
  batch_number VARCHAR(50),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE health_treatments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id),
  diagnosis TEXT,
  treatment TEXT,
  medicine_used TEXT,
  dosage TEXT,
  vet_name VARCHAR(100),
  treatment_date DATE NOT NULL,
  follow_up_date DATE,
  outcome VARCHAR(50),
  cost NUMERIC(10,2),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. BREEDING
-- ============================================================

CREATE TABLE breeding_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  male_id UUID REFERENCES animals(id),
  female_id UUID REFERENCES animals(id),
  species_id INTEGER REFERENCES animal_species(id),
  mating_date DATE NOT NULL,
  expected_birth_date DATE,
  actual_birth_date DATE,
  litter_size INTEGER,
  live_births INTEGER,
  stillbirths INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','confirmed_pregnant','kindled','failed')),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE offspring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  breeding_record_id UUID REFERENCES breeding_records(id),
  animal_id UUID REFERENCES animals(id),
  birth_weight NUMERIC(6,2),
  sex VARCHAR(10),
  status VARCHAR(20) DEFAULT 'alive',
  notes TEXT
);

-- ============================================================
-- 7. PRODUCTION (Eggs & Milk)
-- ============================================================

CREATE TABLE egg_production (
  id BIGSERIAL PRIMARY KEY,
  housing_unit_id UUID REFERENCES housing_units(id),
  date DATE NOT NULL,
  eggs_collected INTEGER DEFAULT 0,
  broken_eggs INTEGER DEFAULT 0,
  good_eggs INTEGER DEFAULT 0,
  recorded_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE milk_production (
  id BIGSERIAL PRIMARY KEY,
  animal_id UUID REFERENCES animals(id),
  date DATE NOT NULL,
  morning_litres NUMERIC(6,2) DEFAULT 0,
  evening_litres NUMERIC(6,2) DEFAULT 0,
  total_litres NUMERIC(6,2) DEFAULT 0,
  quality_grade VARCHAR(20),
  recorded_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. FEED MANAGEMENT
-- ============================================================

CREATE TABLE feed_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  species_id INTEGER REFERENCES animal_species(id),
  unit VARCHAR(20) DEFAULT 'kg',
  description TEXT
);

CREATE TABLE feed_records (
  id BIGSERIAL PRIMARY KEY,
  animal_id UUID REFERENCES animals(id),
  housing_unit_id UUID REFERENCES housing_units(id),
  feed_type_id INTEGER REFERENCES feed_types(id),
  quantity NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'kg',
  feed_date DATE NOT NULL,
  recorded_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. ANIMAL DEATHS & SALES
-- ============================================================

CREATE TABLE animal_deaths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id),
  death_date DATE NOT NULL,
  cause VARCHAR(100),
  description TEXT,
  disposal_method VARCHAR(50),
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE animal_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id),
  sale_date DATE NOT NULL,
  buyer_name VARCHAR(200),
  buyer_phone VARCHAR(30),
  weight_at_sale NUMERIC(8,2),
  price_per_kg NUMERIC(10,2),
  total_price NUMERIC(14,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. CROP MANAGEMENT
-- ============================================================

CREATE TABLE fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_name VARCHAR(100) NOT NULL,
  field_code VARCHAR(50) UNIQUE,
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  acreage NUMERIC(10,2),
  soil_type VARCHAR(50),
  irrigation_type VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crop_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50),
  average_days_to_harvest INTEGER,
  description TEXT
);

CREATE TABLE crop_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES fields(id),
  crop_type_id INTEGER REFERENCES crop_types(id),
  season VARCHAR(50),
  planting_date DATE,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  expected_yield NUMERIC(12,2),
  actual_yield NUMERIC(12,2),
  yield_unit VARCHAR(20) DEFAULT 'kg',
  status VARCHAR(30) DEFAULT 'planted' CHECK (status IN ('planned','planted','growing','harvested','failed')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crop_activities (
  id BIGSERIAL PRIMARY KEY,
  crop_cycle_id UUID REFERENCES crop_cycles(id),
  activity_type VARCHAR(50),  -- planting, weeding, fertilizing, spraying, irrigation, harvesting
  activity_date DATE NOT NULL,
  labour_cost NUMERIC(12,2) DEFAULT 0,
  material_used TEXT,
  material_cost NUMERIC(12,2) DEFAULT 0,
  quantity NUMERIC(10,2),
  unit VARCHAR(20),
  performed_by VARCHAR(100),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crop_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_cycle_id UUID REFERENCES crop_cycles(id),
  sale_date DATE NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  unit VARCHAR(20),
  price_per_unit NUMERIC(10,2),
  total_amount NUMERIC(14,2) NOT NULL,
  buyer_name VARCHAR(200),
  buyer_phone VARCHAR(30),
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. INVENTORY MANAGEMENT
-- ============================================================

CREATE TABLE inventory_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,  -- feed, medicine, equipment, tools, other
  description TEXT
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(200),
  address TEXT,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code VARCHAR(50) UNIQUE,
  name VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES inventory_categories(id),
  unit VARCHAR(30),
  current_stock NUMERIC(12,2) DEFAULT 0,
  reorder_level NUMERIC(12,2) DEFAULT 0,
  unit_cost NUMERIC(10,2),
  expiry_date DATE,
  storage_location VARCHAR(100),
  supplier_id UUID REFERENCES suppliers(id),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  item_id UUID REFERENCES inventory_items(id),
  movement_type VARCHAR(20) CHECK (movement_type IN ('purchase','consumption','adjustment','return','disposal')),
  quantity NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(10,2),
  total_cost NUMERIC(14,2),
  reference_type VARCHAR(50),  -- animal_id, crop_cycle_id, etc.
  reference_id TEXT,
  movement_date DATE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  invoice_number VARCHAR(100),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 12. FINANCE SYSTEM
-- ============================================================

CREATE TABLE income_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE income_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id INTEGER REFERENCES income_categories(id),
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  reference_type VARCHAR(50),  -- animal_sale, crop_sale, etc.
  reference_id TEXT,
  transaction_date DATE NOT NULL,
  payment_method VARCHAR(50),
  received_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id INTEGER REFERENCES expense_categories(id),
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT NOT NULL,
  payee_name VARCHAR(200),
  transaction_date DATE NOT NULL,
  payment_method VARCHAR(50),
  approved_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 13. KENENA WALLET SYSTEM
-- ============================================================

CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  wallet_name VARCHAR(100) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'UGX',
  balance NUMERIC(18,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id INTEGER REFERENCES wallets(id),
  transaction_type VARCHAR(50) NOT NULL,  -- capital_injection, income, expense, payroll, transfer
  direction VARCHAR(10) CHECK (direction IN ('credit','debit')),
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  balance_before NUMERIC(18,2),
  balance_after NUMERIC(18,2),
  description TEXT,
  reference_id TEXT,
  reference_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'completed',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expense_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID REFERENCES users(id),
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  purpose TEXT NOT NULL,
  expense_category_id INTEGER REFERENCES expense_categories(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 14. LOANS & DEBT MANAGEMENT
-- ============================================================

CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_reference VARCHAR(50) UNIQUE,
  lender_name VARCHAR(200) NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  interest_rate NUMERIC(5,2) DEFAULT 0,
  start_date DATE,
  due_date DATE,
  outstanding_balance NUMERIC(18,2),
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loan_repayments (
  id SERIAL PRIMARY KEY,
  loan_id UUID REFERENCES loans(id),
  amount NUMERIC(18,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE debtors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  amount_owed NUMERIC(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  due_date DATE,
  description TEXT,
  status VARCHAR(20) DEFAULT 'outstanding',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 15. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50),  -- vaccination_due, low_stock, payroll_due, approval_required, mortality_spike
  reference_type VARCHAR(50),
  reference_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 16. QR CODE TRACKING
-- ============================================================

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_data TEXT UNIQUE NOT NULL,
  entity_type VARCHAR(50) NOT NULL,  -- animal, housing_unit, equipment, field
  entity_id TEXT NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_scanned TIMESTAMP,
  scan_count INTEGER DEFAULT 0
);

CREATE TABLE qr_scan_logs (
  id BIGSERIAL PRIMARY KEY,
  qr_code_id UUID REFERENCES qr_codes(id),
  scanned_by UUID REFERENCES users(id),
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_info TEXT,
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7)
);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Full system access, remote owner management'),
  ('farm_manager', 'Daily farm operations management'),
  ('accountant', 'Finance, payroll, and wallet management'),
  ('storekeeper', 'Inventory and stock management'),
  ('worker', 'Record submission and task viewing');

INSERT INTO animal_species (name, id_prefix, id_sequence) VALUES
  ('rabbit', 'RBT', 0),
  ('pig', 'PIG', 0),
  ('poultry', 'PLT', 0),
  ('cattle', 'CAT', 0);

INSERT INTO inventory_categories (name) VALUES
  ('feed'), ('medicine'), ('equipment'), ('tools'), ('other');

INSERT INTO income_categories (name) VALUES
  ('Rabbit Sales'), ('Pig Sales'), ('Poultry Sales'), ('Dairy Sales'),
  ('Crop Sales'), ('Manure Sales'), ('Egg Sales'), ('Milk Sales'), ('Other Income');

INSERT INTO expense_categories (name) VALUES
  ('Feed'), ('Veterinary'), ('Salaries'), ('Construction'), ('Fuel'),
  ('Utilities'), ('Equipment'), ('Seeds & Fertilizer'), ('Chemicals'), ('Miscellaneous');

INSERT INTO wallets (wallet_name, currency, balance) VALUES
  ('Main Farm Wallet (UGX)', 'UGX', 0),
  ('USD Wallet', 'USD', 0),
  ('GBP Wallet', 'GBP', 0),
  ('EUR Wallet', 'EUR', 0);

INSERT INTO crop_types (name, category) VALUES
  ('Banana/Matoke', 'staple'), ('Maize', 'cereal'), ('Beans', 'legume'),
  ('Cassava', 'root'), ('Sweet Potato', 'root'), ('Coffee', 'cash'),
  ('Sugarcane', 'cash'), ('Vegetables', 'horticulture');

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_animals_species ON animals(species_id);
CREATE INDEX idx_animals_status ON animals(status);
CREATE INDEX idx_animals_housing ON animals(housing_unit_id);
CREATE INDEX idx_vaccination_animal ON vaccination_records(animal_id);
CREATE INDEX idx_vaccination_due ON vaccination_records(next_due_date);
CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_inventory_item ON inventory_movements(item_id);
CREATE INDEX idx_inventory_date ON inventory_movements(movement_date);
CREATE INDEX idx_income_date ON income_transactions(transaction_date);
CREATE INDEX idx_expense_date ON expense_transactions(transaction_date);
CREATE INDEX idx_wallet_txn ON wallet_transactions(wallet_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_time ON audit_logs(created_at);
CREATE INDEX idx_breeding_status ON breeding_records(status);
CREATE INDEX idx_crop_cycles_status ON crop_cycles(status);

-- ============================================================
-- TASKS TABLE (for Ground Manager task feed)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('urgent','high','medium','low')),
  priority_order INTEGER DEFAULT 2,
  assigned_user_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  completion_notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_user_id);

-- ============================================================
-- ANIMAL TREATMENTS TABLE (for QR scanner treatment logging)
-- ============================================================
CREATE TABLE IF NOT EXISTS health_treatments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id),
  diagnosis TEXT,
  treatment TEXT,
  medicine_used TEXT,
  dosage TEXT,
  vet_name VARCHAR(100),
  treatment_date DATE NOT NULL,
  follow_up_date DATE,
  outcome VARCHAR(50),
  cost NUMERIC(10,2),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CROP CYCLES TABLE (for Crops page)
-- ============================================================
CREATE TABLE IF NOT EXISTS crop_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES fields(id),
  crop_type_id INTEGER REFERENCES crop_types(id),
  season VARCHAR(50),
  planting_date DATE,
  expected_harvest_date DATE,
  actual_harvest_date DATE,
  expected_yield NUMERIC(12,2),
  actual_yield NUMERIC(12,2),
  yield_unit VARCHAR(20) DEFAULT 'kg',
  revenue NUMERIC(14,2),
  status VARCHAR(30) DEFAULT 'planted' CHECK (status IN ('planned','planted','growing','harvested','failed')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample tasks for demo
INSERT INTO tasks (title, description, category, due_date, priority, priority_order, status)
SELECT 'Vaccinate Rabbit Litter B4', 'Apply RHD vaccine to 8 kits in Pen B4. Check weights first.', 'health', CURRENT_DATE, 'urgent', 0, 'pending'
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Vaccinate Rabbit Litter B4');
