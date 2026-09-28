const express = require('express');
const path = require('path');
const morgan = require('morgan');
const db = require('./db');
const { seedDatabase } = require('./seed');
const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const config = require('./config');
const { authRequired, requireRole } = require('./middleware/auth');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));

const port = Number(process.env.PORT || config.port || 6000);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

function getMasterData() {
  const departments = db.prepare('SELECT * FROM departments WHERE is_active IS NOT 0 ORDER BY name ASC').all();
  const assetTypes = db.prepare('SELECT * FROM asset_types WHERE is_active IS NOT 0 ORDER BY name ASC').all();
  const inspectors = db.prepare('SELECT id, name, email, role FROM users WHERE role = ? AND is_active = 1 ORDER BY name ASC').all('INSPECTOR');
  return { departments, assetTypes, inspectors };
}

app.get('/api/assets/masters', authRequired, requireRole('ADMIN'), (req, res) => {
  return res.json(getMasterData());
});

app.get('/api/departments', authRequired, requireRole('ADMIN'), (req, res) => {
  const items = db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
  return res.json({ items });
});

app.post('/api/departments', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, description, is_active = 1 } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Department name is required' });
  }

  const trimmed = String(name).trim();
  const existing = db.prepare('SELECT * FROM departments WHERE lower(name) = lower(?)').get(trimmed);
  if (existing) {
    return res.status(201).json(existing);
  }

  const row = db.prepare("INSERT INTO departments (name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(trimmed, description || '', Number(is_active) ? 1 : 0);
  const record = db.prepare('SELECT * FROM departments WHERE id = ?').get(row.lastInsertRowid);
  return res.status(201).json(record);
});

app.put('/api/departments/:id', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, description, is_active } = req.body || {};
  const department = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!department) return res.status(404).json({ message: 'Department not found' });

  const updatedName = name ? String(name).trim() : department.name;
  const duplicate = db.prepare('SELECT id FROM departments WHERE lower(name) = lower(?) AND id != ?').get(updatedName, department.id);
  if (duplicate) return res.status(409).json({ message: 'Department name already exists' });

  db.prepare("UPDATE departments SET name = ?, description = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?").run(updatedName, description !== undefined ? description : department.description || '', is_active === undefined ? department.is_active : Number(is_active) ? 1 : 0, department.id);
  const updated = db.prepare('SELECT * FROM departments WHERE id = ?').get(department.id);
  return res.json(updated);
});

app.get('/api/asset-types', authRequired, requireRole('ADMIN'), (req, res) => {
  const items = db.prepare('SELECT * FROM asset_types ORDER BY name ASC').all();
  return res.json({ items });
});

app.post('/api/asset-types', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, description, is_active = 1 } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Asset type name is required' });
  }

  const trimmed = String(name).trim();
  const existing = db.prepare('SELECT * FROM asset_types WHERE lower(name) = lower(?)').get(trimmed);
  if (existing) {
    return res.status(201).json(existing);
  }

  const row = db.prepare("INSERT INTO asset_types (name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(trimmed, description || '', Number(is_active) ? 1 : 0);
  const record = db.prepare('SELECT * FROM asset_types WHERE id = ?').get(row.lastInsertRowid);
  return res.status(201).json(record);
});

app.put('/api/asset-types/:id', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, description, is_active } = req.body || {};
  const type = db.prepare('SELECT * FROM asset_types WHERE id = ?').get(req.params.id);
  if (!type) return res.status(404).json({ message: 'Asset type not found' });

  const updatedName = name ? String(name).trim() : type.name;
  const duplicate = db.prepare('SELECT id FROM asset_types WHERE lower(name) = lower(?) AND id != ?').get(updatedName, type.id);
  if (duplicate) return res.status(409).json({ message: 'Asset type name already exists' });

  db.prepare("UPDATE asset_types SET name = ?, description = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?").run(updatedName, description !== undefined ? description : type.description || '', is_active === undefined ? type.is_active : Number(is_active) ? 1 : 0, type.id);
  const updated = db.prepare('SELECT * FROM asset_types WHERE id = ?').get(type.id);
  return res.json(updated);
});

app.use('/api/assets', assetRoutes);

app.use('/api/v1/auth', authRoutes);
app.get('/api/v1/assets/masters', authRequired, requireRole('ADMIN'), (req, res) => {
  return res.json(getMasterData());
});
app.get('/api/v1/departments', authRequired, requireRole('ADMIN'), (req, res) => {
  const items = db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
  return res.json({ items });
});
app.post('/api/v1/departments', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, description, is_active = 1 } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Department name is required' });
  }

  const trimmed = String(name).trim();
  const existing = db.prepare('SELECT * FROM departments WHERE lower(name) = lower(?)').get(trimmed);
  if (existing) {
    return res.status(201).json(existing);
  }

  const row = db.prepare("INSERT INTO departments (name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(trimmed, description || '', Number(is_active) ? 1 : 0);
  const record = db.prepare('SELECT * FROM departments WHERE id = ?').get(row.lastInsertRowid);
  return res.status(201).json(record);
});
app.get('/api/v1/asset-types', authRequired, requireRole('ADMIN'), (req, res) => {
  const items = db.prepare('SELECT * FROM asset_types ORDER BY name ASC').all();
  return res.json({ items });
});
app.post('/api/v1/asset-types', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, description, is_active = 1 } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Asset type name is required' });
  }

  const trimmed = String(name).trim();
  const existing = db.prepare('SELECT * FROM asset_types WHERE lower(name) = lower(?)').get(trimmed);
  if (existing) {
    return res.status(201).json(existing);
  }

  const row = db.prepare("INSERT INTO asset_types (name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(trimmed, description || '', Number(is_active) ? 1 : 0);
  const record = db.prepare('SELECT * FROM asset_types WHERE id = ?').get(row.lastInsertRowid);
  return res.status(201).json(record);
});
app.use('/api/v1/assets', assetRoutes);

app.get('/api/dashboard', (req, res) => {
  const counts = {
    total_assets: db.prepare('SELECT COUNT(*) AS count FROM assets').get().count,
    admin_users: db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = ?').get('ADMIN').count,
    inspector_users: db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = ?').get('INSPECTOR').count,
    inspection_records: db.prepare('SELECT COUNT(*) AS count FROM asset_inspections').get().count,
    maintenance_records: db.prepare('SELECT COUNT(*) AS count FROM maintenance_tasks').get().count
  };

  res.json({ counts });
});

app.get('/api/v1/dashboard', authRequired, requireRole('ADMIN'), (req, res) => {
  const counts = {
    total_assets: db.prepare('SELECT COUNT(*) AS count FROM assets').get().count,
    admin_users: db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = ?').get('ADMIN').count,
    inspector_users: db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = ?').get('INSPECTOR').count,
    inspection_records: db.prepare('SELECT COUNT(*) AS count FROM asset_inspections').get().count,
    maintenance_records: db.prepare('SELECT COUNT(*) AS count FROM maintenance_tasks').get().count
  };

  res.json({ counts });
});

app.get('/api/v1/inspections/my', authRequired, requireRole('INSPECTOR'), (req, res) => {
  const items = db.prepare('SELECT * FROM asset_inspections WHERE inspector_id = ? ORDER BY inspection_date DESC, created_at DESC').all(req.user.id);
  return res.json({ items });
});

app.get('/api/v1/inspections/pending', authRequired, requireRole('INSPECTOR'), (req, res) => {
  const assigned = db.prepare('SELECT * FROM assets WHERE assigned_inspector_id = ?').all(req.user.id);
  const ids = assigned.map((asset) => asset.id);
  if (!ids.length) return res.json({ items: [] });
  const items = db.prepare(`SELECT i.*, a.name AS asset_name FROM asset_inspections i LEFT JOIN assets a ON a.id = i.asset_id WHERE i.asset_id IN (${ids.map(() => '?').join(',')}) ORDER BY i.inspection_date DESC`).all(...ids);
  return res.json({ items });
});

app.get('/api/v1/inspections/completed', authRequired, requireRole('INSPECTOR'), (req, res) => {
  const items = db.prepare('SELECT * FROM asset_inspections WHERE inspector_id = ? AND inspection_result = ? ORDER BY inspection_date DESC').all(req.user.id, 'PASS');
  return res.json({ items });
});

app.get('/api/v1/maintenance', authRequired, requireRole('ADMIN'), (req, res) => {
  const items = db.prepare('SELECT * FROM maintenance_tasks ORDER BY created_at DESC').all();
  return res.json({ items });
});

app.get('/api/v1/maintenance/my', authRequired, requireRole('INSPECTOR'), (req, res) => {
  const items = db.prepare('SELECT * FROM maintenance_tasks WHERE assigned_to = ? ORDER BY created_at DESC').all(req.user.id);
  return res.json({ items });
});

app.get('/api/v1/maintenance/:id', authRequired, (req, res) => {
  const item = db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ message: 'Maintenance task not found' });
  return res.json({ item });
});

seedDatabase();

module.exports = app;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Government asset lifecycle backend running on port ${port}`);
  });
}
