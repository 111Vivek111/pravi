const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { transitionAsset } = require('../services/lifecycleService');

const router = express.Router();

function parseJsonField(value) {
  if (!value) return {};
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (error) {
    return {};
  }
}

router.get('/', authRequired, (req, res) => {
  let sql = `
    SELECT a.*, d.name AS department_name, t.name AS asset_type_name,
      u.name AS inspector_name
    FROM assets a
    LEFT JOIN departments d ON d.id = a.department_id
    LEFT JOIN asset_types t ON t.id = a.asset_type_id
    LEFT JOIN users u ON u.id = a.assigned_inspector_id
    WHERE a.is_active = 1
  `;

  const params = [];
  if (req.user.role === 'INSPECTOR') {
    sql += ' AND a.assigned_inspector_id = ?';
    params.push(req.user.id);
  }

  sql += ' ORDER BY a.created_at DESC';
  const assets = db.prepare(sql).all(...params);
  return res.json({ assets });
});

router.get('/masters', authRequired, requireRole('ADMIN'), (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
  const assetTypes = db.prepare('SELECT * FROM asset_types ORDER BY name ASC').all();
  const inspectors = db.prepare('SELECT id, name, email, role FROM users WHERE role = ? AND is_active = 1 ORDER BY name ASC').all('INSPECTOR');
  return res.json({ departments, assetTypes, inspectors });
});

function updateAssetMaster(req, res) {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const allowedFields = ['asset_code', 'name', 'description', 'department_id', 'asset_type_id', 'location', 'address', 'city', 'district', 'state', 'postal_code', 'current_condition', 'assigned_inspector_id'];
  const updates = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (!Object.keys(updates).length) {
    return res.json({ asset, message: 'No asset master changes to save' });
  }

  if (updates.asset_code && updates.asset_code !== asset.asset_code) {
    const exists = db.prepare('SELECT id FROM assets WHERE asset_code = ? AND id != ?').get(updates.asset_code, asset.id);
    if (exists) {
      return res.status(409).json({ message: 'Asset code already exists' });
    }
  }

  if (updates.current_condition && !['GOOD', 'FAIR', 'POOR', 'CRITICAL'].includes(updates.current_condition)) {
    return res.status(422).json({ message: 'Condition must be one of GOOD, FAIR, POOR, CRITICAL' });
  }

  if (updates.assigned_inspector_id) {
    const inspector = db.prepare('SELECT id FROM users WHERE id = ? AND role = ? AND is_active = 1').get(updates.assigned_inspector_id, 'INSPECTOR');
    if (!inspector) return res.status(404).json({ message: 'Assigned inspector not found or inactive' });
  }

  const setClauses = [];
  const values = [];
  for (const [field, value] of Object.entries(updates)) {
    setClauses.push(`${field} = ?`);
    values.push(value === '' ? null : value);
  }
  values.push(req.user.id, req.params.id);

  db.prepare(`UPDATE assets SET ${setClauses.join(', ')}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`).run(...values);

  const updatedAsset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  db.prepare(`INSERT INTO asset_history (asset_id, action, from_status, to_status, performed_by, remarks, metadata, performed_at)
    VALUES (?, 'Asset master updated', ?, ?, ?, 'Asset master information was updated', ?, datetime('now'))`).run(updatedAsset.id, updatedAsset.current_lifecycle_status, updatedAsset.current_lifecycle_status, req.user.id, JSON.stringify({ fields: Object.keys(updates) }));

  return res.json({ asset: updatedAsset, message: 'Asset updated successfully' });
}

router.put('/:id', authRequired, requireRole('ADMIN'), updateAssetMaster);
router.patch('/:id', authRequired, requireRole('ADMIN'), updateAssetMaster);

router.get('/:id', authRequired, (req, res) => {
  const asset = db.prepare(`
    SELECT a.*, d.name AS department_name, t.name AS asset_type_name, u.name AS inspector_name
    FROM assets a
    LEFT JOIN departments d ON d.id = a.department_id
    LEFT JOIN asset_types t ON t.id = a.asset_type_id
    LEFT JOIN users u ON u.id = a.assigned_inspector_id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!asset) return res.status(404).json({ message: 'Asset not found' });
  if (req.user.role === 'INSPECTOR' && asset.assigned_inspector_id !== req.user.id) {
    return res.status(403).json({ message: 'This asset is not assigned to you' });
  }

  const planning = db.prepare('SELECT * FROM asset_planning WHERE asset_id = ?').get(asset.id);
  const approval = db.prepare('SELECT * FROM asset_approvals WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1').get(asset.id);
  const tender = db.prepare('SELECT * FROM asset_tenders WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1').get(asset.id);
  const construction = db.prepare('SELECT * FROM asset_construction WHERE asset_id = ?').get(asset.id);
  const milestones = construction
    ? db.prepare('SELECT * FROM construction_milestones WHERE construction_id = ? ORDER BY created_at ASC').all(construction.id)
    : [];
  const inspections = db.prepare('SELECT * FROM asset_inspections WHERE asset_id = ? ORDER BY created_at DESC').all(asset.id);
  const maintenance = db.prepare('SELECT * FROM maintenance_tasks WHERE asset_id = ? ORDER BY created_at DESC').all(asset.id);
  const retirement = db.prepare('SELECT * FROM asset_retirement WHERE asset_id = ?').get(asset.id);
  const disposal = db.prepare('SELECT * FROM asset_disposal WHERE asset_id = ?').get(asset.id);
  const history = db.prepare('SELECT h.*, u.name AS performed_by_name FROM asset_history h LEFT JOIN users u ON u.id = h.performed_by WHERE h.asset_id = ? ORDER BY h.performed_at DESC').all(asset.id);

  return res.json({
    asset,
    planning,
    approval,
    tender,
    construction,
    milestones,
    inspections,
    maintenance,
    retirement,
    disposal,
    history
  });
});

router.post('/', authRequired, requireRole('ADMIN'), (req, res) => {
  const {
    asset_code,
    name,
    description,
    department_id,
    asset_type_id,
    location,
    address,
    city,
    district,
    state,
    postal_code,
    current_condition,
    assigned_inspector_id
  } = req.body || {};

  if (!asset_code || !name) {
    return res.status(400).json({ message: 'Asset code and name are required' });
  }

  const exists = db.prepare('SELECT id FROM assets WHERE asset_code = ?').get(asset_code);
  if (exists) {
    return res.status(409).json({ message: 'Asset code already exists' });
  }

  const asset = db.prepare(`
    INSERT INTO assets (
      asset_code, name, description, department_id, asset_type_id, location, address, city, district,
      state, postal_code, current_lifecycle_status, current_condition, assigned_inspector_id,
      created_by, updated_by, created_at, updated_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNING', ?, ?, ?, ?, datetime('now'), datetime('now'), 1)
  `).run(
    asset_code,
    name,
    description || '',
    department_id || null,
    asset_type_id || null,
    location || '',
    address || '',
    city || '',
    district || '',
    state || '',
    postal_code || '',
    current_condition || 'GOOD',
    assigned_inspector_id || null,
    req.user.id,
    req.user.id
  );

  const newAsset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset.lastInsertRowid);
  db.prepare(`INSERT INTO asset_history (asset_id, action, from_status, to_status, performed_by, remarks, metadata, performed_at)
    VALUES (?, 'Asset created', NULL, 'PLANNING', ?, 'Asset created by admin', ?, datetime('now'))`).run(newAsset.id, req.user.id, JSON.stringify({ source: 'api' }));

  return res.status(201).json(newAsset);
});

router.post('/:id/submit-planning', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { purpose, project_description, estimated_cost, expected_start_date, expected_completion_date, priority, remarks, supporting_document_url_or_path } = req.body || {};
  if (!purpose || !project_description || !expected_start_date || !expected_completion_date) {
    return res.status(400).json({ message: 'Planning details are incomplete' });
  }

  const existing = db.prepare('SELECT * FROM asset_planning WHERE asset_id = ?').get(asset.id);
  if (existing) {
    db.prepare(`
      UPDATE asset_planning SET purpose = ?, project_description = ?, estimated_cost = ?, expected_start_date = ?, expected_completion_date = ?, priority = ?, remarks = ?, supporting_document_url_or_path = ?, updated_at = datetime('now')
      WHERE asset_id = ?
    `).run(purpose, project_description, Number(estimated_cost || 0), expected_start_date, expected_completion_date, priority || 'MEDIUM', remarks || '', supporting_document_url_or_path || '', asset.id);
  } else {
    db.prepare(`
      INSERT INTO asset_planning (asset_id, purpose, project_description, estimated_cost, expected_start_date, expected_completion_date, priority, remarks, supporting_document_url_or_path, created_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(asset.id, purpose, project_description, Number(estimated_cost || 0), expected_start_date, expected_completion_date, priority || 'MEDIUM', remarks || '', supporting_document_url_or_path || '', req.user.id);
  }

  return res.json({ message: 'Planning saved successfully' });
});

router.post('/:id/submit-approval', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });
  if (asset.current_lifecycle_status !== 'PLANNING') {
    return res.status(400).json({ message: 'This asset is not in PLANNING status' });
  }

  const { approval_reference_number, approval_date, approving_authority, approved_amount, remarks, approval_document_url_or_path } = req.body || {};
  if (!approval_reference_number || !approval_date || !approving_authority || !approved_amount) {
    return res.status(400).json({ message: 'Approval reference, date, authority and amount are required' });
  }

  db.prepare(`
    INSERT INTO asset_approvals (asset_id, approval_reference_number, approval_date, approved_amount, approving_authority, status, remarks, approval_document_url_or_path, submitted_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, datetime('now'), datetime('now'))
  `).run(asset.id, approval_reference_number, approval_date, Number(approved_amount), approving_authority, remarks || '', approval_document_url_or_path || '', req.user.id);

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'PLANNING',
    toStatus: 'APPROVAL_PENDING',
    performedBy: req.user.id,
    action: 'Approval submitted',
    remarks: 'Planning submitted for approval',
    metadata: { by: req.user.id }
  });

  return res.json({ asset: updated, message: 'Approval submitted' });
});

router.post('/:id/approve', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });
  const approval = db.prepare('SELECT * FROM asset_approvals WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1').get(asset.id);
  if (!approval) return res.status(400).json({ message: 'No approval record exists' });

  const { approval_reference_number, approval_date, approving_authority, approved_amount } = req.body || {};
  if (!approval_reference_number || !approval_date || !approving_authority || !approved_amount) {
    return res.status(400).json({ message: 'Approval information is incomplete' });
  }

  db.prepare(`
    UPDATE asset_approvals SET approval_reference_number = ?, approval_date = ?, approving_authority = ?, approved_amount = ?, status = 'APPROVED', approved_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(approval_reference_number, approval_date, approving_authority, Number(approved_amount), req.user.id, approval.id);

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'APPROVAL_PENDING',
    toStatus: 'APPROVED',
    performedBy: req.user.id,
    action: 'Approval approved',
    remarks: 'Approval approved by admin',
    metadata: { approved_amount: Number(approved_amount) }
  });

  return res.json({ asset: updated, message: 'Asset approved' });
});

router.post('/:id/reject', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { rejection_reason } = req.body || {};
  if (!rejection_reason) return res.status(400).json({ message: 'Rejection reason is required' });
  const approval = db.prepare('SELECT * FROM asset_approvals WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1').get(asset.id);

  if (approval) {
    db.prepare(`UPDATE asset_approvals SET status = 'REJECTED', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`).run(rejection_reason, approval.id);
  }

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'APPROVAL_PENDING',
    toStatus: 'REJECTED',
    performedBy: req.user.id,
    action: 'Approval rejected',
    remarks: rejection_reason,
    metadata: { rejection_reason }
  });

  return res.json({ asset: updated, message: 'Asset rejected' });
});

router.post('/:id/start-tender', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const tenderData = req.body || {};
  const tender = db.prepare(`
    INSERT INTO asset_tenders (asset_id, tender_id, tender_notice_number, tender_type, publication_date, closing_date, estimated_tender_value, eligibility_criteria, number_of_bidders, selected_contractor, contract_amount, contract_start_date, contract_end_date, status, remarks, tender_document_url_or_path, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    asset.id,
    tenderData.tender_id || `TDR-${asset.id}`,
    tenderData.tender_notice_number || '',
    tenderData.tender_type || 'OPEN',
    tenderData.publication_date || new Date().toISOString().slice(0, 10),
    tenderData.closing_date || new Date().toISOString().slice(0, 10),
    Number(tenderData.estimated_tender_value || 0),
    tenderData.eligibility_criteria || '',
    Number(tenderData.number_of_bidders || 0),
    tenderData.selected_contractor || '',
    Number(tenderData.contract_amount || 0),
    tenderData.contract_start_date || null,
    tenderData.contract_end_date || null,
    tenderData.remarks || '',
    tenderData.tender_document_url_or_path || '',
    req.user.id
  );

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'APPROVED',
    toStatus: 'TENDER_PENDING',
    performedBy: req.user.id,
    action: 'Tender started',
    remarks: 'Tender process initiated',
    metadata: { tender_id: tender.lastInsertRowid }
  });

  return res.json({ asset: updated, tenderId: tender.lastInsertRowid, message: 'Tender created' });
});

router.post('/:id/complete-tender', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const tender = db.prepare('SELECT * FROM asset_tenders WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1').get(asset.id);
  if (!tender) return res.status(400).json({ message: 'No tender exists' });

  db.prepare(`UPDATE asset_tenders SET selected_contractor = ?, contract_amount = ?, contract_start_date = ?, contract_end_date = ?, status = 'COMPLETED', remarks = ?, updated_at = datetime('now') WHERE id = ?`).run(
    req.body.selected_contractor || tender.selected_contractor || '',
    Number(req.body.contract_amount || tender.contract_amount || 0),
    req.body.contract_start_date || tender.contract_start_date || null,
    req.body.contract_end_date || tender.contract_end_date || null,
    req.body.remarks || tender.remarks || '',
    tender.id
  );

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'TENDER_PENDING',
    toStatus: 'TENDER_COMPLETED',
    performedBy: req.user.id,
    action: 'Tender completed',
    remarks: 'Tender completed successfully',
    metadata: { selected_contractor: req.body.selected_contractor || tender.selected_contractor }
  });

  return res.json({ asset: updated, message: 'Tender completed' });
});

router.post('/:id/start-construction', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { construction_start_date, expected_completion_date, final_project_cost, remarks } = req.body || {};
  if (!construction_start_date || !expected_completion_date) {
    return res.status(400).json({ message: 'Construction dates are required' });
  }

  const existing = db.prepare('SELECT * FROM asset_construction WHERE asset_id = ?').get(asset.id);
  if (existing) {
    db.prepare(`UPDATE asset_construction SET construction_start_date = ?, expected_completion_date = ?, final_project_cost = ?, remarks = ?, status = 'IN_PROGRESS', updated_by = ?, updated_at = datetime('now') WHERE asset_id = ?`).run(
      construction_start_date, expected_completion_date, Number(final_project_cost || 0), remarks || '', req.user.id, asset.id
    );
  } else {
    db.prepare(`INSERT INTO asset_construction (asset_id, construction_start_date, expected_completion_date, progress_percentage, final_project_cost, status, remarks, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, 'IN_PROGRESS', ?, ?, ?, datetime('now'), datetime('now'))`).run(
      asset.id,
      construction_start_date,
      expected_completion_date,
      Number(final_project_cost || 0),
      remarks || '',
      req.user.id,
      req.user.id
    );
  }

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'TENDER_COMPLETED',
    toStatus: 'UNDER_CONSTRUCTION',
    performedBy: req.user.id,
    action: 'Construction started',
    remarks: 'Construction work has started',
    metadata: { construction_start_date }
  });

  return res.json({ asset: updated, message: 'Construction started' });
});

router.post('/:id/hold-construction', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { hold_reason, hold_date } = req.body || {};
  if (!hold_reason || !hold_date) return res.status(400).json({ message: 'Hold reason and date are required' });

  db.prepare(`UPDATE asset_construction SET status = 'ON_HOLD', hold_reason = ?, hold_date = ?, updated_by = ?, updated_at = datetime('now') WHERE asset_id = ?`).run(hold_reason, hold_date, req.user.id, asset.id);

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'UNDER_CONSTRUCTION',
    toStatus: 'CONSTRUCTION_ON_HOLD',
    performedBy: req.user.id,
    action: 'Construction on hold',
    remarks: hold_reason,
    metadata: { hold_reason, hold_date }
  });

  return res.json({ asset: updated, message: 'Construction put on hold' });
});

router.post('/:id/resume-construction', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { resume_date } = req.body || {};
  if (!resume_date) return res.status(400).json({ message: 'Resume date is required' });

  db.prepare(`UPDATE asset_construction SET status = 'IN_PROGRESS', resume_date = ?, updated_by = ?, updated_at = datetime('now') WHERE asset_id = ?`).run(resume_date, req.user.id, asset.id);

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'CONSTRUCTION_ON_HOLD',
    toStatus: 'UNDER_CONSTRUCTION',
    performedBy: req.user.id,
    action: 'Construction resumed',
    remarks: 'Construction resumed',
    metadata: { resume_date }
  });

  return res.json({ asset: updated, message: 'Construction resumed' });
});

router.post('/:id/complete-construction', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { actual_completion_date, progress_percentage, completion_certificate_number, remarks } = req.body || {};
  if (!actual_completion_date) return res.status(400).json({ message: 'Actual completion date is required' });

  db.prepare(`UPDATE asset_construction SET actual_completion_date = ?, progress_percentage = ?, completion_certificate_number = ?, status = 'COMPLETED', remarks = ?, updated_by = ?, updated_at = datetime('now') WHERE asset_id = ?`).run(
    actual_completion_date,
    Number(progress_percentage || 100),
    completion_certificate_number || '',
    remarks || '',
    req.user.id,
    asset.id
  );

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'UNDER_CONSTRUCTION',
    toStatus: 'CONSTRUCTION_COMPLETED',
    performedBy: req.user.id,
    action: 'Construction completed',
    remarks: 'Construction work completed',
    metadata: { actual_completion_date }
  });

  return res.json({ asset: updated, message: 'Construction completed' });
});

router.post('/:id/assign-inspector', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });
  const { inspector_id } = req.body || {};

  if (!inspector_id) return res.status(400).json({ message: 'Inspector ID is required' });
  const inspector = db.prepare('SELECT * FROM users WHERE id = ? AND role = ? AND is_active = 1').get(inspector_id, 'INSPECTOR');
  if (!inspector) return res.status(404).json({ message: 'Inspector not found' });

  db.prepare("UPDATE assets SET assigned_inspector_id = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?").run(inspector_id, req.user.id, asset.id);

  db.prepare(`INSERT INTO asset_history (asset_id, action, from_status, to_status, performed_by, remarks, metadata, performed_at)
    VALUES (?, 'Inspector assigned', ?, ?, ?, 'Inspector assigned to asset', ?, datetime('now'))`).run(asset.id, asset.current_lifecycle_status, asset.current_lifecycle_status, req.user.id, JSON.stringify({ inspector_id }));

  return res.json({ message: 'Inspector assigned successfully' });
});

function recordInspection(req, res) {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });
  if (asset.assigned_inspector_id !== req.user.id) {
    return res.status(403).json({ message: 'You cannot inspect this asset' });
  }

  const { inspection_date, physical_condition, safety_condition, structural_condition, equipment_condition, defects_found, remarks, inspection_result, supporting_document_url_or_path } = req.body || {};
  if (!inspection_date || !physical_condition || !safety_condition || !structural_condition || !equipment_condition || !inspection_result) {
    return res.status(400).json({ message: 'Inspection details are incomplete' });
  }

  db.prepare(`
    INSERT INTO asset_inspections (
      asset_id, inspector_id, inspection_date, physical_condition, safety_condition,
      structural_condition, equipment_condition, defects_found, remarks, inspection_result,
      supporting_document_url_or_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    asset.id,
    req.user.id,
    inspection_date,
    physical_condition,
    safety_condition,
    structural_condition,
    equipment_condition,
    defects_found || '',
    remarks || '',
    inspection_result,
    supporting_document_url_or_path || '',
  );

  if (inspection_result === 'PASS') {
    const updated = transitionAsset({
      assetId: asset.id,
      fromStatus: 'INSPECTION_PENDING',
      toStatus: 'INSPECTION_COMPLETED',
      performedBy: req.user.id,
      action: 'Inspection completed',
      remarks: 'Inspection passed',
      metadata: { inspection_result }
    });

    const operational = transitionAsset({
      assetId: asset.id,
      fromStatus: 'INSPECTION_COMPLETED',
      toStatus: 'OPERATIONAL',
      performedBy: req.user.id,
      action: 'Asset operational',
      remarks: 'Inspection passed and asset operational',
      metadata: { inspection_result }
    });

    return res.json({ asset: operational, message: 'Inspection completed and asset operational' });
  }

  const failed = transitionAsset({
    assetId: asset.id,
    fromStatus: 'INSPECTION_PENDING',
    toStatus: 'INSPECTION_COMPLETED',
    performedBy: req.user.id,
    action: 'Inspection failed',
    remarks: 'Inspection failed',
    metadata: { inspection_result }
  });

  const maintenance = transitionAsset({
    assetId: asset.id,
    fromStatus: 'INSPECTION_COMPLETED',
    toStatus: 'INSPECTION_FAILED',
    performedBy: req.user.id,
    action: 'Inspection failed',
    remarks: 'Inspection failed and maintenance required',
    metadata: { inspection_result }
  });

  return res.json({ asset: maintenance, message: 'Inspection failed; maintenance required' });
}

router.post('/:id/inspections', authRequired, requireRole('INSPECTOR'), recordInspection);
router.post('/:id/inspection', authRequired, requireRole('INSPECTOR'), recordInspection);

router.post('/:id/maintenance', authRequired, requireRole('INSPECTOR'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });
  if (asset.assigned_inspector_id !== req.user.id) {
    return res.status(403).json({ message: 'You cannot manage maintenance for this asset' });
  }

  const { maintenance_type, problem_description, priority, required_action, start_date, expected_completion_date, work_performed, material_used, cost, remarks, supporting_document_url_or_path } = req.body || {};
  if (!maintenance_type || !problem_description) {
    return res.status(400).json({ message: 'Maintenance type and problem description are required' });
  }

  const task = db.prepare(`
    INSERT INTO maintenance_tasks (
      asset_id, created_by, assigned_to, maintenance_type, problem_description, priority,
      required_action, start_date, expected_completion_date, work_performed, material_used, cost,
      status, remarks, supporting_document_url_or_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, datetime('now'), datetime('now'))
  `).run(
    asset.id,
    req.user.id,
    req.user.id,
    maintenance_type,
    problem_description,
    priority || 'MEDIUM',
    required_action || '',
    start_date || null,
    expected_completion_date || null,
    work_performed || '',
    material_used || '',
    Number(cost || 0),
    remarks || '',
    supporting_document_url_or_path || ''
  );

  db.prepare(`INSERT INTO asset_history (asset_id, action, from_status, to_status, performed_by, remarks, metadata, performed_at)
    VALUES (?, 'Maintenance created', ?, ?, ?, 'Maintenance task created', ?, datetime('now'))`).run(asset.id, asset.current_lifecycle_status, asset.current_lifecycle_status, req.user.id, JSON.stringify({ maintenance_task_id: task.lastInsertRowid }));

  if (asset.current_lifecycle_status === 'INSPECTION_FAILED' || asset.current_lifecycle_status === 'MAINTENANCE_REQUIRED') {
    transitionAsset({
      assetId: asset.id,
      fromStatus: 'INSPECTION_FAILED',
      toStatus: 'MAINTENANCE_REQUIRED',
      performedBy: req.user.id,
      action: 'Maintenance required',
      remarks: 'Maintenance task created',
      metadata: { maintenance_task_id: task.lastInsertRowid }
    });
  }

  return res.status(201).json({ message: 'Maintenance task created', taskId: task.lastInsertRowid });
});

router.post('/:id/retire', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { retirement_date, retirement_reason, asset_condition, retirement_approval_reference, estimated_remaining_value, remarks } = req.body || {};
  if (!retirement_date || !retirement_reason) return res.status(400).json({ message: 'Retirement date and reason are required' });

  db.prepare(`INSERT INTO asset_retirement (asset_id, retirement_date, retirement_reason, asset_condition, retirement_approval_reference, estimated_remaining_value, remarks, retired_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    asset.id,
    retirement_date,
    retirement_reason,
    asset_condition || 'GOOD',
    retirement_approval_reference || '',
    Number(estimated_remaining_value || 0),
    remarks || '',
    req.user.id
  );

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'OPERATIONAL',
    toStatus: 'RETIRED',
    performedBy: req.user.id,
    action: 'Asset retired',
    remarks: retirement_reason,
    metadata: { retirement_date, retirement_reason }
  });

  return res.json({ asset: updated, message: 'Asset retired successfully' });
});

router.post('/:id/dispose', authRequired, requireRole('ADMIN'), (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });

  const { disposal_date, disposal_method, disposal_authority, disposal_reference_number, disposal_value, remarks } = req.body || {};
  if (!disposal_date || !disposal_method || !disposal_authority) {
    return res.status(400).json({ message: 'Disposal date, method and authority are required' });
  }

  db.prepare(`INSERT INTO asset_disposal (asset_id, disposal_date, disposal_method, disposal_authority, disposal_reference_number, disposal_value, remarks, disposed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    asset.id,
    disposal_date,
    disposal_method,
    disposal_authority,
    disposal_reference_number || '',
    Number(disposal_value || 0),
    remarks || '',
    req.user.id
  );

  const updated = transitionAsset({
    assetId: asset.id,
    fromStatus: 'RETIRED',
    toStatus: 'DISPOSED',
    performedBy: req.user.id,
    action: 'Asset disposed',
    remarks: 'Asset disposed and marked terminal',
    metadata: { disposal_date, disposal_method }
  });

  return res.json({ asset: updated, message: 'Asset disposed successfully' });
});

router.get('/:id/history', authRequired, (req, res) => {
  const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Asset not found' });
  const items = db.prepare('SELECT h.*, u.name AS performed_by_name FROM asset_history h LEFT JOIN users u ON u.id = h.performed_by WHERE h.asset_id = ? ORDER BY h.performed_at DESC').all(asset.id);
  return res.json({ history: items });
});

module.exports = router;
