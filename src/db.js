const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'asset_lifecycle.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

function ensureColumn(tableName, columnName, definition) {
  const exists = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!exists.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function backfillLegacyColumns() {
  const tableChecks = [
    ['departments', 'is_active', 'INTEGER DEFAULT 1'],
    ['departments', 'updated_at', 'TEXT DEFAULT ""'],
    ['asset_types', 'is_active', 'INTEGER DEFAULT 1'],
    ['asset_types', 'updated_at', 'TEXT DEFAULT ""']
  ];

  for (const [tableName, columnName, definition] of tableChecks) {
    const exists = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!exists.some((column) => column.name === columnName)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  db.exec(`
    UPDATE departments SET is_active = 1 WHERE is_active IS NULL;
    UPDATE departments SET updated_at = datetime('now') WHERE updated_at IS NULL OR updated_at = '';
    UPDATE asset_types SET is_active = 1 WHERE is_active IS NULL;
    UPDATE asset_types SET updated_at = datetime('now') WHERE updated_at IS NULL OR updated_at = '';
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ADMIN','INSPECTOR')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    department_id INTEGER,
    asset_type_id INTEGER,
    location TEXT,
    address TEXT,
    city TEXT,
    district TEXT,
    state TEXT,
    postal_code TEXT,
    current_lifecycle_status TEXT NOT NULL DEFAULT 'PLANNING',
    current_condition TEXT NOT NULL DEFAULT 'GOOD',
    assigned_inspector_id INTEGER,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (asset_type_id) REFERENCES asset_types(id),
    FOREIGN KEY (assigned_inspector_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS asset_planning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL UNIQUE,
    purpose TEXT,
    project_description TEXT,
    estimated_cost REAL DEFAULT 0,
    expected_start_date TEXT,
    expected_completion_date TEXT,
    priority TEXT,
    remarks TEXT,
    supporting_document_url_or_path TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
  );

  CREATE TABLE IF NOT EXISTS asset_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    approval_reference_number TEXT,
    approval_date TEXT,
    approved_amount REAL,
    approving_authority TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    remarks TEXT,
    approval_document_url_or_path TEXT,
    submitted_by INTEGER,
    approved_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_tenders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    tender_id TEXT,
    tender_notice_number TEXT,
    tender_type TEXT,
    publication_date TEXT,
    closing_date TEXT,
    estimated_tender_value REAL,
    eligibility_criteria TEXT,
    number_of_bidders INTEGER,
    selected_contractor TEXT,
    contract_amount REAL,
    contract_start_date TEXT,
    contract_end_date TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    remarks TEXT,
    tender_document_url_or_path TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_construction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL UNIQUE,
    construction_start_date TEXT,
    expected_completion_date TEXT,
    actual_completion_date TEXT,
    progress_percentage REAL DEFAULT 0,
    final_project_cost REAL,
    completion_certificate_number TEXT,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED',
    hold_reason TEXT,
    hold_date TEXT,
    resume_date TEXT,
    remarks TEXT,
    completion_document_url_or_path TEXT,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS construction_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    construction_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    start_date TEXT,
    completion_date TEXT,
    remarks TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (construction_id) REFERENCES asset_construction(id)
  );

  CREATE TABLE IF NOT EXISTS asset_inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    inspector_id INTEGER NOT NULL,
    inspection_date TEXT,
    physical_condition TEXT,
    safety_condition TEXT,
    structural_condition TEXT,
    equipment_condition TEXT,
    defects_found TEXT,
    remarks TEXT,
    inspection_result TEXT,
    supporting_document_url_or_path TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (inspector_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    created_by INTEGER,
    assigned_to INTEGER,
    maintenance_type TEXT,
    problem_description TEXT,
    priority TEXT,
    required_action TEXT,
    start_date TEXT,
    expected_completion_date TEXT,
    actual_completion_date TEXT,
    work_performed TEXT,
    material_used TEXT,
    cost REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'CREATED',
    remarks TEXT,
    supporting_document_url_or_path TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_retirement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL UNIQUE,
    retirement_date TEXT,
    retirement_reason TEXT,
    asset_condition TEXT,
    retirement_approval_reference TEXT,
    estimated_remaining_value REAL,
    remarks TEXT,
    supporting_document_url_or_path TEXT,
    retired_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_disposal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL UNIQUE,
    disposal_date TEXT,
    disposal_method TEXT,
    disposal_authority TEXT,
    disposal_reference_number TEXT,
    disposal_value REAL,
    remarks TEXT,
    disposal_document_url_or_path TEXT,
    disposed_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    performed_by INTEGER,
    performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    metadata TEXT,
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    FOREIGN KEY (performed_by) REFERENCES users(id)
  );
`);

backfillLegacyColumns();

module.exports = db;
