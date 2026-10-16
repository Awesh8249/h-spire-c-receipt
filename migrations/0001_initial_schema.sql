CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  bill_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  work_type TEXT NOT NULL,
  work_location TEXT NOT NULL,
  quantity REAL NOT NULL,
  rate REAL NOT NULL,
  moram_qty INTEGER NOT NULL DEFAULT 0,
  service_fee REAL NOT NULL DEFAULT 499,
  total REAL NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  bill_type TEXT NOT NULL DEFAULT 'Final Bill',
  project_ref TEXT NOT NULL DEFAULT '',
  previous_paid REAL NOT NULL DEFAULT 0,
  current_received REAL NOT NULL DEFAULT 0,
  request_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS bills_bill_number_unique ON bills (bill_number);
CREATE UNIQUE INDEX IF NOT EXISTS bills_request_key_unique ON bills (request_key);
CREATE INDEX IF NOT EXISTS bills_customer_mobile_idx ON bills (customer_mobile);
CREATE INDEX IF NOT EXISTS bills_project_ref_idx ON bills (project_ref);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  mobile TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  pin_hash TEXT,
  pin_salt TEXT,
  recovery_hash TEXT,
  recovery_salt TEXT,
  invite_hash TEXT,
  invite_expires_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS admins_mobile_unique ON admins (mobile);

CREATE TABLE IF NOT EXISTS login_security (
  mobile TEXT PRIMARY KEY NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  lock_level INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
