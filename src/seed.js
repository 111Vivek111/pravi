const bcrypt = require('bcryptjs');
const db = require('./db');

function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const adminPassword = bcrypt.hashSync('Admin@123', 10);
    const inspectorPassword = bcrypt.hashSync('Inspector@123', 10);

    db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 'ADMIN', 1, datetime('now'), datetime('now'))
    `).run('System Admin', 'admin@gov.in', adminPassword);

    db.prepare(`
      INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 'INSPECTOR', 1, datetime('now'), datetime('now'))
    `).run('Field Inspector', 'inspector@gov.in', inspectorPassword);
  }

  const departmentCount = db.prepare('SELECT COUNT(*) AS count FROM departments').get().count;
  if (departmentCount === 0) {
    const departments = ['Water', 'Construction / PWD', 'Healthcare', 'Education'];
    const stmt = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)');
    for (const item of departments) {
      stmt.run(item, `${item} department`);
    }
  }

  const assetTypeCount = db.prepare('SELECT COUNT(*) AS count FROM asset_types').get().count;
  if (assetTypeCount === 0) {
    const types = ['Water Treatment Plant', 'Water Tank', 'Pipeline', 'Pump Station', 'Bridge', 'Road', 'Hospital', 'School'];
    const stmt = db.prepare('INSERT INTO asset_types (name, description) VALUES (?, ?)');
    for (const item of types) {
      stmt.run(item, `${item} asset type`);
    }
  }

  const assetCount = db.prepare('SELECT COUNT(*) AS count FROM assets').get().count;
  if (assetCount === 0) {
    const admin = db.prepare("SELECT id FROM users WHERE email = ?").get('admin@gov.in');
    const inspector = db.prepare("SELECT id FROM users WHERE email = ?").get('inspector@gov.in');
    const waterDepartment = db.prepare('SELECT id FROM departments WHERE name = ?').get('Water');
    const waterTankType = db.prepare('SELECT id FROM asset_types WHERE name = ?').get('Water Tank');

    db.prepare(`
      INSERT INTO assets (
        asset_code, name, description, department_id, asset_type_id, location, address, city, district,
        state, postal_code, current_lifecycle_status, current_condition, assigned_inspector_id,
        created_by, updated_by, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(
      'ASSET-1001',
      'Main Water Tank',
      'Regional water storage tank for municipal supply',
      waterDepartment.id,
      waterTankType.id,
      'North District',
      '12 Water Street',
      'Bengaluru',
      'North',
      'Karnataka',
      '560001',
      'PLANNING',
      'GOOD',
      inspector.id,
      admin.id,
      admin.id
    );
  }
}

module.exports = { seedDatabase };
